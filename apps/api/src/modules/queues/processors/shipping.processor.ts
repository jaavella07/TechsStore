import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger }             from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import { Job }                from 'bullmq';

import { QueueName, JobName, OrderStatus } from '@shared/enums';
import { Order }              from '../../../domains/orders/entities/order.entity';

interface ShippingJobData {
  orderId: string;
  userId:  string;
}

/**
 * PROCESADOR DE ENVÍOS
 *
 * En producción integrarías aquí con tu proveedor de logística:
 * DHL, FedEx, Estafeta, Sendcloud, EasyPost, etc.
 *
 * Por ahora simula la notificación y actualiza el estado a PROCESSING.
 */
@Processor(QueueName.SHIPPING)
export class ShippingProcessor extends WorkerHost {
  private readonly logger = new Logger(ShippingProcessor.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
  ) {
    super();
  }

  async process(job: Job<ShippingJobData>): Promise<void> {
    if (job.name === JobName.NOTIFY_SHIPPING) {
      await this.notifyShipping(job.data);
    }
  }

  private async notifyShipping(data: ShippingJobData): Promise<void> {
    const { orderId } = data;
    this.logger.log(`Notificando sistema de envíos para orden ${orderId}...`);

    const order = await this.ordersRepo.findOne({
      where:     { id: orderId },
      relations: ['items', 'items.product', 'user'],
    });

    if (!order) {
      throw new Error(`Orden ${orderId} no encontrada para notificar envío`);
    }

    // ── PAYLOAD para el proveedor de logística ───────────
    const shippingPayload = {
      reference:    order.orderNumber,
      recipient: {
        name:    order.user?.name,
        email:   order.user?.email,
        address: order.shippingAddress,
      },
      packages: order.items.map((item) => ({
        description: item.productNameSnapshot,
        quantity:    item.quantity,
        // En producción: weight, dimensions, etc.
      })),
      createdAt: new Date().toISOString(),
    };

    // TODO: llamar a la API del proveedor de logística
    // const trackingNumber = await shippingProvider.createShipment(shippingPayload);
    this.logger.debug(`Payload de envío: ${JSON.stringify(shippingPayload, null, 2)}`);

    // Generar tracking simulado
    const trackingNumber = `TRK-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;

    // Actualizar orden a estado PROCESSING con número de tracking
    await this.ordersRepo.update(orderId, {
      status:         OrderStatus.PROCESSING,
      trackingNumber,
    });

    this.logger.log(`✅ Envío notificado para ${order.orderNumber} — Tracking: ${trackingNumber}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Shipping fallido: job ${job.id} — ${error.message}`);
  }
}
