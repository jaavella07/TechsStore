import { Injectable, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource }       from 'typeorm';
import * as fs              from 'fs';
import * as path            from 'path';

import { User }     from '../../domains/users/entities/user.entity';
import { UserRole } from '@shared/enums';

@Injectable()
export class SeedService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async runSeed(): Promise<{ message: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Seed no disponible en producción');
    }

    const sqlPath = this.resolveSqlPath();
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Divide por ';', descarta vacíos, BEGIN y COMMIT (el QueryRunner los gestiona)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const withoutComments = s.replace(/--[^\n]*/g, '').trim();
        if (!withoutComments) return false;
        const upper = withoutComments.toUpperCase();
        return upper !== 'BEGIN' && upper !== 'COMMIT';
      });

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      for (const stmt of statements) {
        await runner.query(stmt);
      }
      await runner.commitTransaction();
    } catch (err) {
      await runner.rollbackTransaction();
      throw new InternalServerErrorException(
        `Error ejecutando seed: ${(err as Error).message}`,
      );
    } finally {
      await runner.release();
    }

    // ── Usuario AGENT (idempotente, usa repo para que @BeforeInsert hashee la password) ──
    const usersRepo = this.dataSource.getRepository(User);
    const agentEmail    = process.env.SEED_AGENT_EMAIL    ?? 'agent@techsstore.com';
    const agentPassword = process.env.SEED_AGENT_PASSWORD ?? 'AgentPass123';

    const existing = await usersRepo.findOne({ where: { email: agentEmail } });
    if (!existing) {
      await usersRepo.save(
        usersRepo.create({
          name:     'Conversational Agent',
          email:    agentEmail,
          password: agentPassword,
          role:     UserRole.AGENT,
        }),
      );
    }

    return { message: 'Seed multisector ejecutado exitosamente' };
  }

  private resolveSqlPath(): string {
    const candidates = [
      // Dev (ts-node): __dirname apunta al directorio fuente
      path.join(__dirname, 'seed-multisector.sql'),
      // Prod (Docker): NestJS CLI copia assets relativos a sourceRoot
      path.join(process.cwd(), 'dist/apps/api/common/seeds/seed-multisector.sql'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }

    throw new Error(
      `seed-multisector.sql no encontrado. Rutas intentadas:\n  ${candidates.join('\n  ')}`,
    );
  }
}
