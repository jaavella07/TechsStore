import { Module }        from '@nestjs/common';
import { BullModule }    from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QueueName }     from '@shared/enums';
import { Order }         from '../../domains/orders/entities/order.entity';

import { OrdersProcessor }   from './processors/orders.processor';
import { InvoicesProcessor } from './processors/invoices.processor';
import { EmailsProcessor }   from './processors/emails.processor';
import { ShippingProcessor } from './processors/shipping.processor';
import { OrdersModule }      from '../../domains/orders/orders.module';

@Module({
  imports: [
    // ── Registrar las 4 colas ─────────────────────────────
    BullModule.registerQueue(
      { name: QueueName.ORDERS   },
      { name: QueueName.INVOICES },
      { name: QueueName.EMAILS   },
      { name: QueueName.SHIPPING },
    ),

    // ── Entidades necesarias en los processors ────────────
    TypeOrmModule.forFeature([Order]),

    // ── Servicios usados por los processors ───────────────
    OrdersModule,
  ],
  providers: [
    OrdersProcessor,
    InvoicesProcessor,
    EmailsProcessor,
    ShippingProcessor,
  ],
  exports: [BullModule],
})
export class QueuesModule {}
