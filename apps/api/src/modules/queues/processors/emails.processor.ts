import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger }             from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { Job }                from 'bullmq';
import * as nodemailer        from 'nodemailer';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { QueueName, JobName } from '@shared/enums';
import { Order }              from '../../../domains/orders/entities/order.entity';

interface EmailJobData {
  orderId:     string;
  userEmail:   string;
  userName:    string;
  totalAmount: number;
}

@Processor(QueueName.EMAILS)
export class EmailsProcessor extends WorkerHost {
  private readonly logger     = new Logger(EmailsProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly config: ConfigService,

    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
  ) {
    super();

    this.transporter = nodemailer.createTransport({
      host:   config.get('MAIL_HOST', 'smtp.gmail.com'),
      port:   config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: config.get('MAIL_USER'),
        pass: config.get('MAIL_PASS'),
      },
    });
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    if (job.name === JobName.SEND_ORDER_EMAIL) {
      await this.sendOrderConfirmation(job.data);
    }
  }

  private async sendOrderConfirmation(data: EmailJobData): Promise<void> {
    const { orderId, userEmail, userName, totalAmount } = data;
    this.logger.log(`Enviando email de confirmación para orden ${orderId} → ${userEmail}`);

    // Cargar orden con items para el cuerpo del email
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    const itemsHtml = order?.items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${item.productNameSnapshot}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">$${(item.unitPriceInCents / 100).toFixed(2)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">$${(item.subtotalInCents / 100).toFixed(2)}</td>
        </tr>`,
      )
      .join('') ?? '';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

    <!-- HEADER -->
    <tr>
      <td style="background:linear-gradient(135deg,#1a21be,#3b42d4);padding:32px 40px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:-0.5px">TechsStore</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px">Tu tecnología, entregada.</p>
      </td>
    </tr>

    <!-- CUERPO -->
    <tr>
      <td style="padding:36px 40px">
        <h2 style="color:#1a21be;margin:0 0 8px">¡Gracias por tu compra, ${userName}! 🎉</h2>
        <p style="color:#555;margin:0 0 24px;line-height:1.6">
          Hemos recibido tu pago exitosamente. Tu orden <strong>${order?.orderNumber ?? ''}</strong> está siendo procesada.
        </p>

        <!-- TABLA DE PRODUCTOS -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
          <thead>
            <tr style="background:#f0f2ff">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#1a21be;text-transform:uppercase">Producto</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#1a21be;text-transform:uppercase">Cant.</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#1a21be;text-transform:uppercase">Precio</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#1a21be;text-transform:uppercase">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:12px;text-align:right;font-weight:bold;color:#333">TOTAL:</td>
              <td style="padding:12px;text-align:right;font-weight:bold;font-size:16px;color:#1a21be">$${(totalAmount / 100).toFixed(2)} USD</td>
            </tr>
          </tfoot>
        </table>

        <!-- AVISO DE FACTURA -->
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:24px">
          <p style="margin:0;color:#0369a1;font-size:13px">
            📄 <strong>Tu factura PDF</strong> será enviada en un correo adicional en los próximos minutos.
          </p>
        </div>

        <p style="color:#555;font-size:13px;line-height:1.6">
          Si tienes alguna pregunta, escríbenos a 
          <a href="mailto:soporte@techsstore.com" style="color:#1a21be">soporte@techsstore.com</a>
        </p>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee">
        <p style="margin:0;color:#aaa;font-size:11px">
          © ${new Date().getFullYear()} TechsStore · Todos los derechos reservados
        </p>
      </td>
    </tr>

  </table>
</body>
</html>`;

    await this.transporter.sendMail({
      from:    this.config.get('MAIL_FROM', '"TechsStore" <noreply@techsstore.com>'),
      to:      userEmail,
      subject: `✅ Orden confirmada ${order?.orderNumber ?? ''} — TechsStore`,
      html,
    });

    this.logger.log(`✅ Email enviado a ${userEmail} para orden ${orderId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Email fallido: job ${job.id} — ${error.message}`);
  }
}
