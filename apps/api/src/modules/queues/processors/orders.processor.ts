import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject }                        from '@nestjs/common';
import { Job, Queue }                            from 'bullmq';
import { InjectQueue }                           from '@nestjs/bullmq';

import { QueueName, JobName }    from '@shared/enums';
import { OrderPaidJobData }      from '@shared/interfaces';

/**
 * PROCESADOR PRINCIPAL DE ÓRDENES
 *
 * Orquesta el flujo post-pago. Cuando recibe un job PROCESS_ORDER_PAID,
 * dispara sub-jobs en las colas especializadas (invoices, emails, shipping).
 *
 * Ventaja: si el servicio de emails falla, BullMQ lo reintenta
 * automáticamente sin afectar la experiencia del usuario ni el resto del flujo.
 */
@Processor(QueueName.ORDERS)
export class OrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(
    @InjectQueue(QueueName.INVOICES) private readonly invoicesQueue: Queue,
    @InjectQueue(QueueName.EMAILS)   private readonly emailsQueue:   Queue,
    @InjectQueue(QueueName.SHIPPING) private readonly shippingQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<OrderPaidJobData>): Promise<void> {
    this.logger.log(`Procesando job: ${job.name} | Orden: ${job.data.orderId}`);

    switch (job.name) {
      case JobName.PROCESS_ORDER_PAID:
        await this.handleOrderPaid(job.data);
        break;
      default:
        this.logger.warn(`Job desconocido: ${job.name}`);
    }
  }

  private async handleOrderPaid(data: OrderPaidJobData): Promise<void> {
    const { orderId, userId, userEmail, userName, totalAmount } = data;

    // ── 1. Generar factura PDF ────────────────────────────
    await this.invoicesQueue.add(
      JobName.GENERATE_INVOICE,
      { orderId, userEmail, userName, totalAmount },
      { priority: 1, delay: 0 },
    );

    // ── 2. Enviar email de confirmación ───────────────────
    await this.emailsQueue.add(
      JobName.SEND_ORDER_EMAIL,
      { orderId, userEmail, userName, totalAmount },
      { priority: 2, delay: 500 }, // pequeño delay para que la factura esté lista
    );

    // ── 3. Notificar al sistema de logística ──────────────
    await this.shippingQueue.add(
      JobName.NOTIFY_SHIPPING,
      { orderId, userId },
      { priority: 3, delay: 2000 },
    );

    this.logger.log(`Jobs sub-encolados para orden ${orderId}: invoice + email + shipping`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Job completado: ${job.name} (${job.id})`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job fallido: ${job.name} (${job.id}) — ${error.message}`);
  }
}
