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
import { CreateOrderDto, UpdateOrderStatusDto, AdminOrdersFilterDto, MyOrdersFilterDto, AgentOrderView } from '../dto/order.dto';
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

  //  Crear orden desde el carrito activo 
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

  //  Marcar orden como PAGADA (llamado por webhook) 
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

    //  ACCIÓN INMEDIATA: actualizar estado 
    order.status                = OrderStatus.PAID;
    order.stripePaymentIntentId = paymentIntentId;
    const savedOrder = await this.ordersRepo.save(order);

    //  ACCIÓN ASÍNCRONA: confirmar stock y disparar cola 
    await this.dataSource.transaction(async (manager) => {
      for (const item of order.items) {
        await this.inventoryService.confirmSale(item.product.id, item.quantity, manager);
      }
    });

    // Limpiar carrito del usuario (las reservas ya fueron confirmadas)
    await this.cartService.removeAfterPurchase(order.user.id);

    //  ENCOLAR TAREAS ASÍNCRONAS (BullMQ) 
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

  //  Asignar Stripe Session ID a una orden 
  async attachStripeSession(orderId: string, sessionId: string): Promise<void> {
    await this.ordersRepo.update(orderId, { stripeSessionId: sessionId });
  }

  //  Listar órdenes del usuario autenticado
  async findMyOrders(userId: string, dto: MyOrdersFilterDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 10, status } = dto;
    const where: Record<string, unknown> = { user: { id: userId } };
    if (status) where['status'] = status;

    const [data, total] = await this.ordersRepo.findAndCount({
      where,
      order:   { createdAt: 'DESC' },
      skip:    (page - 1) * limit,
      take:    limit,
      // Cargar imágenes de producto por defecto (evita render roto si la UI las muestra)
      relations: ['items', 'items.product', 'items.product.images'],
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  //  Ver detalle de una orden
  async findOne(orderId: string, userId: string, userRole: UserRole): Promise<Order> {
    const order = await this.ordersRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.items',          'items')
      .leftJoinAndSelect('items.product',        'product')
      .leftJoinAndSelect('product.images',       'pImages')
      // B2: proyección mínima de usuario (sin PII innecesaria)
      .leftJoin('order.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email'])
      .where('order.id = :id', { id: orderId })
      .getOne();

    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

    // Un CLIENT solo puede ver sus propias órdenes
    if (userRole !== UserRole.ADMIN && order.user.id !== userId) {
      throw new ForbiddenException('No tienes permiso para ver esta orden');
    }

    return order;
  }

  //  Listar todas las órdenes (ADMIN completo / AGENT proyectado sin PII)
  async findAll(
    dto: AdminOrdersFilterDto,
    role: UserRole,
  ): Promise<PaginatedResult<Order | AgentOrderView>> {
    const { page = 1, limit = 10, orderNumber, email, trackingNumber, status } = dto;
    const isAgent = role === UserRole.AGENT;

    // ── Paso 1: contar con filtros (sin joins pesados) ────────
    const countQb = this.ordersRepo.createQueryBuilder('order');
    if (email) countQb.leftJoin('order.user', 'user');
    if (orderNumber)    countQb.andWhere('order.orderNumber = :orderNumber', { orderNumber });
    if (email)          countQb.andWhere('user.email = :email', { email });
    if (trackingNumber) countQb.andWhere('order.trackingNumber = :trackingNumber', { trackingNumber });
    if (status)         countQb.andWhere('order.status = :status', { status });

    const total      = await countQb.getCount();
    const totalPages = Math.ceil(total / limit);

    if (total === 0) return { data: [], total, page, limit, totalPages };

    // ── Paso 2: IDs paginados ──────────────────────────────────
    // Seleccionar también createdAt para que el ORDER BY no genere SELECT DISTINCT inválido
    // cuando el filtro email añade un JOIN (Postgres exige ORDER BY en el SELECT si hay DISTINCT)
    const idsQb = this.ordersRepo.createQueryBuilder('order')
      .select(['order.id', 'order.createdAt'])
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (email) idsQb.leftJoin('order.user', 'user');
    if (orderNumber)    idsQb.andWhere('order.orderNumber = :orderNumber', { orderNumber });
    if (email)          idsQb.andWhere('user.email = :email', { email });
    if (trackingNumber) idsQb.andWhere('order.trackingNumber = :trackingNumber', { trackingNumber });
    if (status)         idsQb.andWhere('order.status = :status', { status });

    const ids = (await idsQb.getMany()).map(o => o.id);
    if (!ids.length) return { data: [], total, page, limit, totalPages };

    // ── Paso 3: hidratar relaciones para esos IDs ─────────────
    const dataQb = this.ordersRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.id IN (:...ids)', { ids })
      .orderBy('order.createdAt', 'DESC');

    // AGENT: sin datos de usuario. ADMIN: proyección mínima {id, name, email} (B2).
    if (!isAgent) {
      dataQb.leftJoin('order.user', 'user').addSelect(['user.id', 'user.name', 'user.email']);
    }

    const data = await dataQb.getMany();

    // Proyectar a shape mínimo cuando el llamador es AGENT.
    const result: (Order | AgentOrderView)[] = isAgent
      ? data.map<AgentOrderView>(o => ({
          orderNumber:    o.orderNumber,
          status:         o.status,
          trackingNumber: o.trackingNumber ?? null,
          createdAt:      o.createdAt,
          items: (o.items ?? []).map(i => ({
            productNameSnapshot: i.productNameSnapshot,
            quantity:            i.quantity,
            unitPriceInCents:    i.unitPriceInCents,
          })),
        }))
      : data;

    return { data: result, total, page, limit, totalPages };
  }

  //  Actualizar estado de orden (ADMIN) 
  async updateStatus(orderId: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

    order.status = dto.status;
    if (dto.trackingNumber) order.trackingNumber = dto.trackingNumber;

    return this.ordersRepo.save(order);
  }

  //  Actualizar URL de factura PDF (llamado por procesador)
  async updateInvoiceUrl(orderId: string, url: string): Promise<void> {
    await this.ordersRepo.update(orderId, { invoicePdfUrl: url });
  }

  //  Helper: número de orden legible 
  private generateOrderNumber(): string {
    const date = new Date();
    const ymd  = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${ymd}-${rand}`;
  }
}
