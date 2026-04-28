import {
  Injectable, NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Cron, CronExpression }  from '@nestjs/schedule';

import { Cart }             from '../entities/cart.entity';
import { CartItem }         from '../entities/cart.entity';
import { AddToCartDto, UpdateCartItemDto } from '../dto/cart.dto';
import { ProductsService }  from '../../products/services/products.service';
import { InventoryService } from '../../products/services/inventory.service';
import { Product }          from '../../products/entities/product.entity';

const CART_TTL_MINUTES = 30;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,

    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,

    private readonly productsService:  ProductsService,
    private readonly inventoryService: InventoryService,
    private readonly dataSource:       DataSource,
  ) {}

  // ── Obtener o crear carrito activo ────────────────────────
  async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepo.findOne({
      where:     { user: { id: userId } },
      relations: ['items', 'items.product', 'items.product.inventories'],
      order:     { createdAt: 'DESC' },
    });

    if (!cart || cart.isExpired) {
      if (cart?.isExpired) {
        await this.releaseCartReservations(cart);
        await this.cartRepo.remove(cart);
      }
      cart = await this.createNewCart(userId);
    }

    return cart;
  }

  // ── Añadir producto al carrito ────────────────────────────
  // FIX: No usamos dataSource.transaction() aquí para evitar mezclar
  // el manager de la transacción con this.cartRepo.
  // Cada operación atómica (reserva de stock) usa su propio transaction.
  async addItem(userId: string, dto: AddToCartDto): Promise<Cart> {
    const cart    = await this.getOrCreateCart(userId);
    const product = await this.productsService.findById(dto.productId);

    const existingItem = cart.items?.find(i => i.product.id === dto.productId);

    if (existingItem) {
      // Reservar solo la diferencia adicional
      await this.inventoryService.reserve(dto.productId, dto.quantity);
      existingItem.quantity += dto.quantity;
      await this.cartItemRepo.save(existingItem);
    } else {
      // Reservar stock y crear el ítem
      await this.inventoryService.reserve(dto.productId, dto.quantity);

      const item = this.cartItemRepo.create({
        cart:                 { id: cart.id } as Cart,    // ← solo la referencia (no el objeto completo)
        product:              { id: product.id } as Product, // ← ídem
        quantity:             dto.quantity,
        priceSnapshotInCents: product.finalPriceInCents,
      });
      await this.cartItemRepo.save(item);
    }

    // FIX CLAVE: usar update() en lugar de save(cart)
    // save(cart) con cascade:true + cart.items=[] borraba los ítems recién guardados.
    // update() solo toca el campo indicado — no dispara cascade en items.
    await this.cartRepo.update(cart.id, { expiresAt: this.newExpiry() });

    this.logger.log(`Item añadido: user=${userId} product=${dto.productId} qty=${dto.quantity}`);

    // Releer el carrito desde la DB para obtener los ítems actualizados
    return this.getOrCreateCart(userId);
  }

  // ── Actualizar cantidad de un ítem ────────────────────────
  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items?.find(i => i.id === itemId);

    if (!item) throw new NotFoundException(`Ítem ${itemId} no encontrado en el carrito`);

    const delta = dto.quantity - item.quantity;

    if (delta > 0) {
      await this.inventoryService.reserve(item.product.id, delta);
    } else if (delta < 0) {
      await this.inventoryService.release(item.product.id, Math.abs(delta));
    }

    item.quantity = dto.quantity;
    await this.cartItemRepo.save(item);

    // FIX: update() en lugar de save(cart) para evitar cascade
    await this.cartRepo.update(cart.id, { expiresAt: this.newExpiry() });

    return this.getOrCreateCart(userId);
  }

  // ── Eliminar ítem del carrito ─────────────────────────────
  async removeItem(userId: string, itemId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items?.find(i => i.id === itemId);

    if (!item) throw new NotFoundException(`Ítem ${itemId} no encontrado`);

    await this.inventoryService.release(item.product.id, item.quantity);
    await this.cartItemRepo.remove(item);

    // FIX: update() en lugar de save(cart)
    await this.cartRepo.update(cart.id, { expiresAt: this.newExpiry() });

    return this.getOrCreateCart(userId);
  }

  // ── Vaciar carrito completo ────────────────────────────────
  async clearCart(userId: string): Promise<void> {
    const cart = await this.getOrCreateCart(userId);
    await this.releaseCartReservations(cart);
    await this.cartRepo.remove(cart);
  }

  // ── Limpiar carrito TRAS compra exitosa ───────────────────
  async removeAfterPurchase(userId: string): Promise<void> {
    const cart = await this.cartRepo.findOne({ where: { user: { id: userId } } });
    if (cart) await this.cartRepo.remove(cart);
  }

  // ── CRON: liberar carritos expirados ─────────────────────
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredCarts(): Promise<void> {
    const expiredCarts = await this.cartRepo
      .createQueryBuilder('cart')
      .leftJoinAndSelect('cart.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('cart.expiresAt < NOW()')
      .getMany();

    if (expiredCarts.length === 0) return;

    this.logger.log(`Liberando ${expiredCarts.length} carritos expirados...`);

    for (const cart of expiredCarts) {
      try {
        await this.releaseCartReservations(cart);
        await this.cartRepo.remove(cart);
      } catch (err) {
        this.logger.error(`Error liberando carrito ${cart.id}: ${err.message}`);
      }
    }
  }

  // ── Helper: liberar reservas de un carrito ────────────────
  async releaseCartReservations(cart: Cart): Promise<void> {
    if (!cart.items?.length) return;
    for (const item of cart.items) {
      try {
        await this.inventoryService.release(item.product.id, item.quantity);
      } catch (err) {
        this.logger.warn(`No se pudo liberar reserva item=${item.id}: ${err.message}`);
      }
    }
  }

  private newExpiry(): Date {
    const d = new Date();
    d.setMinutes(d.getMinutes() + CART_TTL_MINUTES);
    return d;
  }

  private async createNewCart(userId: string): Promise<Cart> {
    const cart = this.cartRepo.create({
      user:      { id: userId },
      expiresAt: this.newExpiry(),
      // FIX: NO inicializar items: [] aquí — TypeORM lo trata como "cascade vacío"
    });
    return this.cartRepo.save(cart);
  }
}
