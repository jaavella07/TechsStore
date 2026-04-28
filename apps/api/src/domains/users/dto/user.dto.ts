import {
  IsEmail, IsString, MinLength, MaxLength,
  IsOptional, IsEnum, Matches, IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '@shared/enums';


// ─── Registro de cliente ──────────────────────────────────────
export class CreateUserDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'juan@techsstore.com' })
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email: string;

  /**
   * Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.
   * Ejemplo válido: Password1
   */
  @ApiProperty({ example: 'Password1' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
  })
  password: string;

  @ApiPropertyOptional({ example: '+521234567890' })
  @IsOptional()
  @IsString()
  phone?: string;
}

// ─── Actualización de perfil ──────────────────────────────────
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// ─── Cambiar rol (solo ADMIN) ─────────────────────────────────
export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

// ─── Paginación ───────────────────────────────────────────────
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  limit?: number = 10;
}
