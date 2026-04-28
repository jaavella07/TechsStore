import {
  Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue }       from '@nestjs/bullmq';
import { Queue }             from 'bullmq';

import { Order }             from '../entities/order.entity';
import { OrderItem }         from '../entities/order.entity';
import { CartService }       from '../../cart/services/cart.service';
import { InventoryService }  from '../../products/services/inventory.service';
import { CreateOrderDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { PaginationDto }     from '../../users/dto/user.dto';
import { JobName, OrderStatus, QueueName, UserRole } from '@shared/enums';
import { OrderPaidJobData, PaginatedResult } from '@shared/interfaces';


@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemsRepo: Repository<OrderItem>,

    private readonly cartService:     CartService,
    private readonly inventoryService: InventoryService,
    private readonly dataSource:      DataSource,

    @InjectQueue(QueueName.ORDERS)
    private readonly ordersQueue: Queue,
  ) {}

  // ── Crear orden desde el carrito activo ──────────────────
  async createFromCart(userId: string, dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const cart = await this.cartService.getOrCreateCart(userId);

      if (!cart.items?.length) {
        throw new BadRequestException('El carrito está vacío');
      }
      if (cart.isExpired) {
        throw new BadRequestException('El carrito ha expirado. Por favor, vuelve a añadir tus productos.');
      }

      // Crear la orden
      const orderNumber = this.generateOrderNumber();
      const order = manager.create(Order, {
        orderNumber,
        status:          OrderStatus.PENDING,
        totalInCents:    cart.totalInCents,
        shippingAddress: dto.shippingAddress,
        user:            { id: userId },
      });

      const savedOrder = await manager.save(Order, order);

      // Crear ítems de la orden (snapshot inmutable)
      const orderItems = cart.items.map(cartItem =>
        manager.create(OrderItem, {
          order:              savedOrder,
          product:            cartItem.product,
          quantity:           cartItem.quantity,
          unitPriceInCents:   cartItem.priceSnapshotInCents,
          productNameSnapshot: cartItem.product.name,
        }),
      );

      await manager.save(OrderItem, orderItems);

      this.logger.log(`Orden creada: ${orderNumber} (${savedOrder.id}) por usuario ${userId}`);
      return savedOrder;
    });
  }

  // ── Marcar orden como PAGADA (llamado por webhook) ────────
  async markAsPaid(stripeSessionId: string, paymentIntentId: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({
      where: { stripeSessionId },
      relations: ['user', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException(`Orden con session ${stripeSessionId} no encontrada`);
    }

    if (order.status !== OrderStatus.PENDING) {
      this.logger.warn(`Orden ${order.id} ya fue procesada (estado: ${order.status}). Ignorando.`);
      return order;
    }

    // ── ACCIÓN INMEDIATA: actualizar estado ───────────────
    order.status                = OrderStatus.PAID;
    order.stripePaymentIntentId = paymentIntentId;
    const savedOrder = await this.ordersRepo.save(order);

    // ── ACCIÓN ASÍNCRONA: confirmar stock y disparar cola ─
    await this.dataSource.transaction(async (manager) => {
      for (const item of order.items) {
        await this.inventoryService.confirmSale(item.product.id, item.quantity, manager);
      }
    });

    // Limpiar carrito del usuario (las reservas ya fueron confirmadas)
    await this.cartService.removeAfterPurchase(order.user.id);

    // ── ENCOLAR TAREAS ASÍNCRONAS (BullMQ) ───────────────
    const jobData: OrderPaidJobData = {
      orderId:         savedOrder.id,
      userId:          order.user.id,
      userEmail:       order.user.email,
      userName:        order.user.name,
      totalAmount:     savedOrder.totalInCents,
      stripeSessionId,
    };

    await this.ordersQueue.add(JobName.PROCESS_ORDER_PAID, jobData, {
      priority: 1,
    });

    this.logger.log(`Orden ${savedOrder.orderNumber} marcada como PAGADA. Jobs encolados.`);
    return savedOrder;
  }

  // ── Asignar Stripe Session ID a una orden ─────────────────
  async attachStripeSession(orderId: string, sessionId: string): Promise<void> {
    await this.ordersRepo.update(orderId, { stripeSessionId: sessionId });
  }

  // ── Listar órdenes del usuario autenticado ────────────────
  async findMyOrders(userId: string, dto: PaginationDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 10 } = dto;
    const [data, total] = await this.ordersRepo.findAndCount({
      where:   { user: { id: userId } },
      order:   { createdAt: 'DESC' },
      skip:    (page - 1) * limit,
      take:    limit,
      relations: ['items'],
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Ver detalle de una orden ──────────────────────────────
  async findOne(orderId: string, userId: string, userRole: UserRole): Promise<Order> {
    const order = await this.ordersRepo.findOne({
      where:     { id: orderId },
      relations: ['user', 'items', 'items.product'],
    });

    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

    // Un CLIENT solo puede ver sus propias órdenes
    if (userRole !== UserRole.ADMIN && order.user.id !== userId) {
      throw new ForbiddenException('No tienes permiso para ver esta orden');
    }

    return order;
  }

  // ── Listar todas las órdenes (ADMIN) ──────────────────────
  async findAll(dto: PaginationDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 10 } = dto;
    const [data, total] = await this.ordersRepo.findAndCount({
      order:     { createdAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['user', 'items'],
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Actualizar estado de orden (ADMIN) ────────────────────
  async updateStatus(orderId: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

    order.status = dto.status;
    if (dto.trackingNumber) order.trackingNumber = dto.trackingNumber;

    return this.ordersRepo.save(order);
  }

  // ── Actualizar URL de factura PDF (llamado por procesador) ─
  async updateInvoiceUrl(orderId: string, url: string): Promise<void> {
    await this.ordersRepo.update(orderId, { invoicePdfUrl: url });
  }

  // ── Helper: número de orden legible ──────────────────────
  private generateOrderNumber(): string {
    const date = new Date();
    const ymd  = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${ymd}-${rand}`;
  }
}
