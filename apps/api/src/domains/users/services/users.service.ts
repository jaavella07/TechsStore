import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository }          from '@nestjs/typeorm';
import { Repository }                from 'typeorm';
import { User }                      from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto, ChangeRoleDto, PaginationDto } from '../dto/user.dto';
import { PaginatedResult } from '@shared/interfaces';


@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  // ── Registro ─────────────────────────────────────────────
  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException(`El email ${dto.email} ya está registrado`);
    }
    const user = this.usersRepo.create(dto);
    return this.usersRepo.save(user);
  }

  // ── Listado paginado (ADMIN) ──────────────────────────────
  async findAll(dto: PaginationDto): Promise<PaginatedResult<User>> {
    const { page = 1, limit = 10 } = dto;
    const [data, total] = await this.usersRepo.findAndCount({
      skip:  (page - 1) * limit,
      take:  limit,
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Buscar por ID ─────────────────────────────────────────
  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  // ── Buscar por email (usado por Auth) ─────────────────────
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  // ── Actualizar perfil ─────────────────────────────────────
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (dto.email && dto.email !== user.email) {
      const emailTaken = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (emailTaken) throw new ConflictException('El email ya está en uso');
    }

    // El @BeforeUpdate hook en la entidad se encarga de re-hashear si hay nueva contraseña
    Object.assign(user, dto);
    return this.usersRepo.save(user);
  }

  // ── Cambiar rol (solo ADMIN) ──────────────────────────────
  async changeRole(id: string, dto: ChangeRoleDto, requesterId: string): Promise<User> {
    if (id === requesterId) {
      throw new ForbiddenException('No puedes cambiar tu propio rol');
    }
    const user = await this.findById(id);
    user.role  = dto.role;
    return this.usersRepo.save(user);
  }

  // ── Desactivar usuario (soft delete) ─────────────────────
  async deactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    await this.usersRepo.save(user);
  }

  // ── Guardar (uso interno, ej.: refresh token) ─────────────
  async save(user: User): Promise<User> {
    return this.usersRepo.save(user);
  }
}
