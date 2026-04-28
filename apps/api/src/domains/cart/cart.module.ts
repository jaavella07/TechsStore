import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { Cart }           from './entities/cart.entity';
import { CartItem }       from './entities/cart.entity';
import { CartService }    from './services/cart.service';
import { CartController } from './controllers/cart.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    ScheduleModule.forRoot(),
    ProductsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
