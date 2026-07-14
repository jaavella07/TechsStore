import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

// Paginación por página (page + limit) — usada por orders y users
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;
}

// Paginación por offset (offset + limit) — usada por products
export class OffsetPaginationDto {
  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 100, description: 'Número de resultados por página' })
  @IsOptional()
  @IsPositive()
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ default: 0, description: 'Número de resultados a saltar' })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
