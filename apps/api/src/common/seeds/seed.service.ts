import { Injectable, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource }       from 'typeorm';
import * as fs              from 'fs';
import * as path            from 'path';

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

    const sqlPath = path.join(__dirname, 'seed-multisector.sql');
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

    return { message: 'Seed multisector ejecutado exitosamente' };
  }
}
