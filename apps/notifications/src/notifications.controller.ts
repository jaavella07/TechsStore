import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MailService }     from './mail/mail.service';
import { NotificationType } from '../../../shared/enums';

interface NotificationPayload {
  type:       NotificationType;
  email?:     string;
  name?:      string;
  orderId?:   string;
  orderNumber?: string;
  trackingNumber?: string;
  invoiceUrl?: string;
}

@Controller()
export class NotificationsController {
  constructor(
    private readonly mailService: MailService,
  ) {}

  // ── Patrón TCP que escucha el API principal ───────────────
  @MessagePattern({ cmd: 'send_notification' })
  async handleNotification(@Payload() payload: NotificationPayload): Promise<{ sent: boolean }> {
    const { type, email } = payload;

    switch (type) {
      case NotificationType.ORDER_CONFIRMED:
        if (email) await this.mailService.sendOrderConfirmed(email, payload.name!, payload.orderNumber!);
        break;

      case NotificationType.ORDER_SHIPPED:
        if (email) await this.mailService.sendOrderShipped(email, payload.name!, payload.trackingNumber!);
        break;

      case NotificationType.INVOICE_READY:
        if (email) await this.mailService.sendInvoice(email, payload.name!, payload.invoiceUrl!);
        break;

      case NotificationType.WELCOME:
        if (email) await this.mailService.sendWelcome(email, payload.name!);
        break;

      default:
        break;
    }

    return { sent: true };
  }
}
