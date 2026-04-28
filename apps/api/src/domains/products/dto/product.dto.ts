import {
  IsString, IsInt, IsOptional, IsBoolean, IsArray, ValidateNested,
  Min, Max, MinLength, MaxLength, IsUrl, IsUUID, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ─── Atributo de producto ──────────────────────────────────────
export class ProductAttributeDto {
  @ApiProperty({ example: 'Color' })
  @IsString() @MinLength(1) @MaxLength(100)
  key: string;

  @ApiProperty({ example: 'Negro' })
  @IsString() @MinLength(1) @MaxLength(200)
  value: string;
}

// ─── Crear producto ───────────────────────────────────────────
export class CreateProductDto {
  @ApiProperty({ example: 'iPhone 15 Pro Max' })
  @IsString() @MinLength(2) @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'Descripción detallada del producto...' })
  @IsString() @MinLength(10)
  description: string;

  /**
   * Precio en CENTAVOS (entero). Ejemplo: $1299.99 → 129999
   * Rechaza negativos y decimales automáticamente.
   */
  @ApiProperty({ example: 129999, description: 'Precio en centavos (ej: $12.99 → 1299)' })
  @IsInt({ message: 'priceInCents debe ser un número entero' })
  @Min(1, { message: 'El precio no puede ser 0 o negativo' })
  priceInCents: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt() @Min(0) @Max(100)
  discountPercent?: number = 0;

  @ApiPropertyOptional({ example: 'APPL-IP15PM-BLK-256' })
  @IsOptional()
  @IsString() @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: 'Apple' })
  @IsOptional()
  @IsString() @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({ example: 'uuid-de-categoria' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [ProductAttributeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  attributes?: ProductAttributeDto[];

  @ApiPropertyOptional({ example: 100, description: 'Stock inicial' })
  @IsOptional()
  @IsInt() @Min(0)
  initialStock?: number = 0;
}

// ─── Actualizar producto ──────────────────────────────────────
export class UpdateProductDto extends PartialType(CreateProductDto) {}

// ─── Ajuste de inventario ─────────────────────────────────────
export class AdjustStockDto {
  @ApiProperty({ example: 50, description: 'Cantidad a sumar (positivo) o restar (negativo)' })
  @IsInt()
  quantity: number;

  @ApiPropertyOptional({ example: 'Reposición de proveedor' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

// ─── Crear categoría ──────────────────────────────────────────
export class CreateCategoryDto {
  @ApiProperty({ example: 'Smartphones' })
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Teléfonos inteligentes de última generación' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'UUID de categoría padre (para subcategorías)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

// ─── Filtros de búsqueda ──────────────────────────────────────
export class ProductFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Precio mínimo en centavos' })
  @IsOptional() @IsInt() @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Precio máximo en centavos' })
  @IsOptional() @IsInt() @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 12 }) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number = 12;

  @ApiPropertyOptional({ enum: ['price_asc', 'price_desc', 'newest', 'name'] })
  @IsOptional() @IsString()
  sortBy?: string = 'newest';
}
