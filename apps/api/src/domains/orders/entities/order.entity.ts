import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, JoinColumn,
} from 'typeorm';
import { User }       from '../../users/entities/user.entity';
import { Product }    from '../../products/entities/product.entity';
import { OrderStatus } from '@shared/enums';


// ─── Order ────────────────────────────────────────────────────
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número de orden legible por humanos: ORD-20240122-XXXX */
  @Column({ unique: true })
  orderNumber: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  /** Total en centavos */
  @Column({ type: 'int', unsigned: true })
  totalInCents: number;

  // ─── Stripe ───────────────────────────────────────────────
  @Column({ nullable: true })
  stripeSessionId: string;

  @Column({ nullable: true })
  stripePaymentIntentId: string;

  // ─── Dirección de envío (snapshot en JSON) ────────────────
  @Column({ type: 'jsonb', nullable: true })
  shippingAddress: {
    street:   string;
    city:     string;
    state:    string;
    country:  string;
    zipCode:  string;
  };

  // ─── PDF de factura ───────────────────────────────────────
  @Column({ nullable: true })
  invoicePdfUrl: string;

  // ─── Metadata de tracking ─────────────────────────────────
  @Column({ nullable: true })
  trackingNumber: string;

  // ─── Relaciones ───────────────────────────────────────────
  @ManyToOne(() => User, (u) => u.orders, { eager: false })
  @JoinColumn()
  user: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// ─── OrderItem ────────────────────────────────────────────────
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  /** Precio unitario al momento de la compra (inmutable) */
  @Column({ type: 'int', unsigned: true })
  unitPriceInCents: number;

  /** Snapshot del nombre del producto (por si cambia en el futuro) */
  @Column({ length: 200 })
  productNameSnapshot: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => Product, { eager: true, nullable: true, onDelete: 'SET NULL' })
  product: Product;

  get subtotalInCents(): number {
    return this.unitPriceInCents * this.quantity;
  }
}
