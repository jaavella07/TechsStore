import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('MAIL_HOST', 'smtp.gmail.com'),
      port: config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: config.get('MAIL_USER'),
        pass: config.get('MAIL_PASS'),
      },
    });
    this.from = config.get('MAIL_FROM', '"TechsStore" <noreply@techsstore.com>');
  }

  // ── Orden confirmada ─────────────────────────────────────
  async sendOrderConfirmed(to: string, name: string, orderNumber: string): Promise<void> {
    await this.send(
      to,
      `✅ Orden ${orderNumber} confirmada — TechsStore`,
      this.wrapLayout(`
        <h2 style="color:#1a21be">¡Hola ${name}!</h2>
        <p>Tu orden <strong>${orderNumber}</strong> ha sido confirmada y está siendo preparada.</p>
        <p>Te notificaremos cuando sea enviada.</p>
      `),
    );
    this.logger.log(`Email ORDER_CONFIRMED → ${to}`);
  }

  // ── Orden enviada ────────────────────────────────────────
  async sendOrderShipped(to: string, name: string, trackingNumber: string): Promise<void> {
    await this.send(
      to,
      `🚚 Tu pedido está en camino — TechsStore`,
      this.wrapLayout(`
        <h2 style="color:#1a21be">¡Tu pedido salió, ${name}!</h2>
        <p>Tu número de rastreo es: <strong style="font-size:18px;color:#1a21be">${trackingNumber}</strong></p>
        <p>Puedes rastrear tu paquete en el sitio de tu proveedor de envíos.</p>
      `),
    );
    this.logger.log(`Email ORDER_SHIPPED → ${to}`);
  }

  // ── Factura lista ────────────────────────────────────────
  async sendInvoice(to: string, name: string, invoiceUrl: string): Promise<void> {
    await this.send(
      to,
      `📄 Tu factura está lista — TechsStore`,
      this.wrapLayout(`
        <h2 style="color:#1a21be">Hola ${name}, tu factura está lista.</h2>
        <p>Puedes descargarla haciendo clic en el botón de abajo:</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${invoiceUrl}"
             style="background:#1a21be;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-weight:bold;font-size:15px">
            Descargar Factura PDF
          </a>
        </div>
      `),
    );
    this.logger.log(`Email INVOICE_READY → ${to}`);
  }

  // ── Bienvenida ───────────────────────────────────────────
  async sendWelcome(to: string, name: string): Promise<void> {
    await this.send(
      to,
      `👋 ¡Bienvenido a TechsStore, ${name}!`,
      this.wrapLayout(`
        <h2 style="color:#1a21be">¡Hola ${name}! Bienvenido a TechsStore 🎉</h2>
        <p>Estamos felices de tenerte con nosotros. Explora nuestro catálogo de tecnología 
           y encuentra la mejor oferta para ti.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${this.config.get('FRONTEND_URL', 'http://localhost:4200')}"
             style="background:#1a21be;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-weight:bold;font-size:15px">
            Explorar Catálogo
          </a>
        </div>
      `),
    );
    this.logger.log(`Email WELCOME → ${to}`);
  }

  // ── Envío genérico ───────────────────────────────────────
  // private async send(to: string, subject: string, html: string): Promise<void> {
  //   try {
  //     await this.transporter.sendMail({ from: this.from, to, subject, html });
  //   } catch (err) {
  //     this.logger.error(`Error enviando email a ${to}: ${err.message}`);
  //     throw err; // BullMQ reintentará el job
  //   }
  // }
  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : JSON.stringify(err);

      this.logger.error(`Error enviando email a ${to}: ${message}`);
      throw err;
    }
  }
  // ── Layout base del email ────────────────────────────────
  private wrapLayout(content: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"
    style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;
           overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <tr>
      <td style="background:linear-gradient(135deg,#1a21be,#3b42d4);padding:28px 40px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">TechsStore</h1>
      </td>
    </tr>
    <tr><td style="padding:32px 40px">${content}</td></tr>
    <tr>
      <td style="background:#f8f9fa;padding:18px 40px;text-align:center;border-top:1px solid #eee">
        <p style="margin:0;color:#aaa;font-size:11px">
          © ${new Date().getFullYear()} TechsStore · 
          <a href="mailto:soporte@techsstore.com" style="color:#aaa">soporte@techsstore.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
