import {
  IsString, IsOptional, ValidateNested, IsEnum,
  MaxLength, IsPostalCode,
} from 'class-validator';
import { Type }         from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@shared/enums';


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

  @ApiProperty({ example: 'MX' })
  @IsString() @MaxLength(2)
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
