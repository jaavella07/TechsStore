import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_attributes')
export class ProductAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ejemplo: "Color", "Almacenamiento", "RAM" */
  @Column({ length: 100 })
  key: string;

  /** Ejemplo: "Negro", "256 GB", "16 GB" */
  @Column({ length: 200 })
  value: string;

  @ManyToOne(() => Product, (p) => p.attributes, { onDelete: 'CASCADE' })
  product: Product;
}
