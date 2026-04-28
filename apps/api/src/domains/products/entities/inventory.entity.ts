import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Product }  from './product.entity';
//import { InventoryReservationStatus } from '@shared/enums';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  totalStock: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  reservedStock: number;

  @Column({ type: 'int', unsigned: true, default: 5 })
  lowStockThreshold: number;

  @ManyToOne(() => Product, (p) => p.inventories, { onDelete: 'CASCADE' })
  product: Product;

  get availableStock(): number {
    return Math.max(0, this.totalStock - this.reservedStock);
  }

  get isLowStock(): boolean {
    return this.availableStock <= this.lowStockThreshold;
  }

  get isOutOfStock(): boolean {
    return this.availableStock === 0;
  }
}
