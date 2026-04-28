import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'ID de la orden a pagar (creada previamente con POST /orders)' })
  @IsUUID()
  orderId: string;
}
