import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index, JoinColumn,
} from 'typeorm';
import { Category }          from './category.entity';
import { ProductAttribute }  from './product-attribute.entity';
import { ProductImage }      from './product-image.entity';
import { Inventory }         from './inventory.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 220 })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  /**
   * Precio base en centavos (entero) para evitar problemas de punto flotante.
   * Ejemplo: $29.99 → 2999
   */
  @Column({ type: 'int', unsigned: true })
  priceInCents: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  discountPercent: number; // 0-100

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, length: 100 })
  sku: string;

  @Column({ nullable: true, length: 100 })
  brand: string;

  // ─── Relaciones ───────────────────────────────────────────
  @ManyToOne(() => Category, (c) => c.products, { eager: false, nullable: true })
  @JoinColumn()
  category: Category;

  @OneToMany(() => ProductAttribute, (a) => a.product, { cascade: true, eager: true })
  attributes: ProductAttribute[];

  @OneToMany(() => ProductImage, (i) => i.product, { cascade: true, eager: true })
  images: ProductImage[];

  @OneToMany(() => Inventory, (inv) => inv.product, { cascade: true })
  inventories: Inventory[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  // ─── Precio final calculado ───────────────────────────────
  get finalPriceInCents(): number {
    return Math.round(this.priceInCents * (1 - this.discountPercent / 100));
  }

  get priceFormatted(): string {
    return `$${(this.finalPriceInCents / 100).toFixed(2)}`;
  }
}
