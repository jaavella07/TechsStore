import {
  IsString, IsOptional, ValidateNested, IsEnum,
  MaxLength,
} from 'class-validator';
import { Type }         from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@shared/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';


// ─── Shape read-only para el rol AGENT (sin PII ni datos financieros) ────────
export interface AgentOrderItemView {
  productNameSnapshot: string;
  quantity:            number;
  unitPriceInCents:    number;
}

export interface AgentOrderView {
  orderNumber:    string;
  status:         OrderStatus;
  trackingNumber: string | null;
  createdAt:      Date;
  items:          AgentOrderItemView[];
}


export class ShippingAddressDto {
  @ApiProperty({ example: 'Av. Insurgentes Sur 1234' })
  @IsString() @MaxLength(200)
  street: string;

  @ApiProperty({ example: 'Ciudad de México' })
  @IsString() @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'CDMX' })
  @IsString() @MaxLength(100)
  state: string;

  @ApiProperty({ example: 'Colombia' })
  @IsString() @MaxLength(100)
  country: string;

  @ApiProperty({ example: '06600' })
  @IsString() @MaxLength(20)
  zipCode: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ example: 'MX-DHL-12345' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

// ─── DTO para el filtro de /orders/me (cliente) ───────────────────────────────
export class MyOrdersFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING })
  @IsOptional() @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class AdminOrdersFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'ORD-20240515-A3K9' })
  @IsOptional() @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional() @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'MX-DHL-12345' })
  @IsOptional() @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING })
  @IsOptional() @IsEnum(OrderStatus)
  status?: OrderStatus;
}
