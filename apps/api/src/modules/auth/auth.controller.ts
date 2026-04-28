import {
  Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { AuthService }        from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { CreateUserDto }      from '../../domains/users/dto/user.dto';
import { JwtAuthGuard }       from './guards/jwt-auth.guard';
import { JwtRefreshGuard }    from './guards/jwt-refresh.guard';
import { CurrentUser }        from './decorators/current-user.decorator';
import { User }               from '../../domains/users/entities/user.entity';
import { JwtRefreshPayload } from '@shared/interfaces';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/register ───────────────────────────────────
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario y obtener tokens' })
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  // ── POST /auth/login ──────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión — devuelve accessToken + refreshToken' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ── POST /auth/refresh ────────────────────────────────────
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando el refresh token' })
  refresh(@CurrentUser() payload: JwtRefreshPayload) {
    return this.authService.refreshTokens(payload.sub, payload.refreshToken!);
  }

  // ── POST /auth/logout ─────────────────────────────────────
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesión — revoca todos los refresh tokens' })
  logout(@CurrentUser() user: User) {
    return this.authService.logout(user.id);
  }

  // ── GET /auth/me ──────────────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verificar token y obtener usuario actual' })
  me(@CurrentUser() user: User) {
    return user;
  }
}
