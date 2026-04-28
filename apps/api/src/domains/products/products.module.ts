import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';

import { Product }         from './entities/product.entity';
import { Category }        from './entities/category.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { ProductImage }    from './entities/product-image.entity';
import { Inventory }       from './entities/inventory.entity';

import { ProductsService } from './services/products.service';
import { InventoryService } from './services/inventory.service';
import { ProductsController } from './controllers/products.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product, Category, ProductAttribute, ProductImage, Inventory,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, InventoryService],
  exports: [ProductsService, InventoryService, TypeOrmModule],
})
export class ProductsModule {}
