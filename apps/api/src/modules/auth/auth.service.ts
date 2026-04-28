import {
  Injectable, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { JwtService }         from '@nestjs/jwt';
import { ConfigService }      from '@nestjs/config';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import * as bcrypt            from 'bcryptjs';
import { v4 as uuidv4 }       from 'uuid';

import { UsersService }       from '../../domains/users/services/users.service';
import { User }               from '../../domains/users/entities/user.entity';
import { RefreshToken }       from '../../domains/users/entities/refresh-token.entity';
import { CreateUserDto }      from '../../domains/users/dto/user.dto';
import { LoginDto }           from './dto/auth.dto';
import { JwtPayload } from '@shared/interfaces';


@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService:   JwtService,
    private readonly config:       ConfigService,

    @InjectRepository(RefreshToken)
    private readonly rtRepo: Repository<RefreshToken>,
  ) {}

  // ── Registro ────────────────────────────────────────────
  async register(dto: CreateUserDto) {
    const user   = await this.usersService.create(dto);
    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);
    return { user, ...tokens };
  }

  // ── Login ────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);
    return { user, ...tokens };
  }

  // ── Refresh tokens ───────────────────────────────────────
  async refreshTokens(userId: string, rawRefreshToken: string) {
    const tokenHash = await bcrypt.hash(rawRefreshToken, 10);

    // Buscar un token válido del usuario
    const stored = await this.rtRepo
      .createQueryBuilder('rt')
      .where('rt.userId = :userId', { userId })
      .andWhere('rt.revoked = false')
      .andWhere('rt.expiresAt > :now', { now: new Date() })
      .getMany();

    // Verificar contra todos los tokens almacenados (rotación segura)
    let validToken: RefreshToken | undefined;
    for (const rt of stored) {
      const matches = await bcrypt.compare(rawRefreshToken, rt.tokenHash);
      if (matches) { validToken = rt; break; }
    }

    if (!validToken) {
      // Posible robo de token: revocar todos
      await this.revokeAllUserTokens(userId);
      throw new ForbiddenException('Refresh token inválido o revocado');
    }

    // Revocar el token usado (rotación: un token de un solo uso)
    validToken.revoked = true;
    await this.rtRepo.save(validToken);

    const user   = await this.usersService.findById(userId);
    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);
    return tokens;
  }

  // ── Logout ───────────────────────────────────────────────
  async logout(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  // ── Validar credenciales ─────────────────────────────────
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await user.comparePassword(password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');
    return user;
  }

  // ── Generar par de tokens ────────────────────────────────
  private async generateTokens(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:    this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret:    this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // ── Guardar refresh token (hasheado) ────────────────────
  private async storeRefreshToken(user: User, rawToken: string): Promise<void> {
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    const rt    = this.rtRepo.create({ tokenHash, expiresAt, user });
    await this.rtRepo.save(rt);
  }

  // ── Revocar todos los tokens del usuario ─────────────────
  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.rtRepo.update({ user: { id: userId }, revoked: false }, { revoked: true });
  }
}
