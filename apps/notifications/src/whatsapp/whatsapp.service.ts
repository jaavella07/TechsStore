import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import Twilio                 from 'twilio';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly client: Twilio.Twilio;
  private readonly from:   string;

  constructor(private readonly config: ConfigService) {
    const accountSid = config.get('TWILIO_ACCOUNT_SID', '');
    const authToken  = config.get('TWILIO_AUTH_TOKEN', '');

    if (accountSid && authToken) {
      this.client = Twilio(accountSid, authToken);
    }

    this.from = config.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886');
  }

  // ── Orden confirmada ─────────────────────────────────────
  async sendOrderConfirmed(phone: string, orderNumber: string): Promise<void> {
    await this.send(
      phone,
      `✅ *TechsStore* — ¡Tu orden *${orderNumber}* fue confirmada! Estamos preparándola para ti. 📦`,
    );
  }

  // ── Orden enviada ────────────────────────────────────────
  async sendOrderShipped(phone: string, trackingNumber: string): Promise<void> {
    await this.send(
      phone,
      `🚚 *TechsStore* — ¡Tu paquete está en camino! Número de rastreo: *${trackingNumber}*`,
    );
  }

  // ── Envío genérico ───────────────────────────────────────
  private async send(to: string, body: string): Promise<void> {
    if (!this.client) {
      this.logger.warn('Twilio no configurado. Saltando envío de WhatsApp.');
      return;
    }

    // Asegura formato whatsapp:+521234567890
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    try {
      const message = await this.client.messages.create({
        from: this.from,
        to:   toFormatted,
        body,
      });
      this.logger.log(`WhatsApp enviado → ${to} (SID: ${message.sid})`);
    } catch (err) {
      // No lanzar error — WhatsApp es opcional, no debe frenar el flujo
      this.logger.warn(`Error enviando WhatsApp a ${to}: ${err.message}`);
    }
  }
}
