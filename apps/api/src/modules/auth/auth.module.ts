import { Module }        from '@nestjs/common';
import { JwtModule }     from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule }  from '@nestjs/config';

import { UsersModule }   from '../../domains/users/users.module';
import { AuthService }   from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy }   from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard }  from './guards/jwt-auth.guard';
import { RolesGuard }    from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule sin secret fijo — cada signAsync usa su propio secret vía options
    JwtModule.register({}),
    UsersModule, // Provee UsersService + TypeOrmModule con RefreshToken
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
