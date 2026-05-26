import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPositive, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 10, description: 'How many rows do you need' })
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ default: 0, description: 'How many rows do you want to skip' })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
