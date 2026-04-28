import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UsersService }               from '../services/users.service';
import { CreateUserDto, UpdateUserDto, ChangeRoleDto, PaginationDto } from '../dto/user.dto';
import { JwtAuthGuard }               from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard }                 from '../../../modules/auth/guards/roles.guard';
import { Roles }                      from '../../../modules/auth/decorators/roles.decorator';
import { CurrentUser }                from '../../../modules/auth/decorators/current-user.decorator';

import { User }                       from '../entities/user.entity';
import { UserRole } from '@shared/enums';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Registro público ────────────────────────────────────
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo cliente' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // ── Listado (solo ADMIN) ────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Listar todos los usuarios' })
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  // ── Perfil propio ───────────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obtener mi perfil' })
  getMe(@CurrentUser() user: User) {
    return this.usersService.findById(user.id);
  }

  // ── Ver un usuario (ADMIN) ──────────────────────────────
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Ver usuario por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  // ── Actualizar perfil ───────────────────────────────────
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  // ── Cambiar rol (ADMIN) ──────────────────────────────────
  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Cambiar rol de usuario' })
  changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() admin: User,
  ) {
    return this.usersService.changeRole(id, dto, admin.id);
  }

  // ── Desactivar (ADMIN) ───────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Desactivar usuario' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }
}
