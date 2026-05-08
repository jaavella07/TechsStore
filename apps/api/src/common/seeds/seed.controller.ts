import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags }              from '@nestjs/swagger';

import { SeedService }   from './seed.service';
import { JwtAuthGuard }  from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard }    from '../../modules/auth/guards/roles.guard';
import { Roles }         from '../../modules/auth/decorators/roles.decorator';
import { UserRole }      from '@shared/enums';

@ApiTags('Seed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('run')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Poblar la base de datos con datos de prueba (solo ADMIN, no producción)' })
  run() {
    return this.seedService.runSeed();
  }
}
