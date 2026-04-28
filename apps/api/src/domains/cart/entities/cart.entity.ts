import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, JoinColumn,
} from 'typeorm';
import { User }    from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

// ─── Cart ─────────────────────────────────────────────────────
@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Fecha de expiración del carrito — al expirar se liberan las reservas */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @ManyToOne(() => User, (u) => u.carts, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: true, eager: true })
  items: CartItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  get totalInCents(): number {
    return this.items?.reduce((sum, item) => sum + item.subtotalInCents, 0) ?? 0;
  }

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}

// ─── CartItem ─────────────────────────────────────────────────
@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  /** Precio capturado al momento de agregar al carrito (en centavos) */
  @Column({ type: 'int', unsigned: true })
  priceSnapshotInCents: number;

  @ManyToOne(() => Cart, (c) => c.items, { onDelete: 'CASCADE' })
  cart: Cart;

  @ManyToOne(() => Product, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn()
  product: Product;

  get subtotalInCents(): number {
    return this.priceSnapshotInCents * this.quantity;
  }
}
