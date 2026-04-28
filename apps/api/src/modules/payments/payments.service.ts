import {
  Injectable, Logger, BadRequestException, RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }    from 'typeorm';
import Stripe            from 'stripe';
import { Request }       from 'express';

import { Order }         from '../../domains/orders/entities/order.entity';
import { OrdersService } from '../../domains/orders/services/orders.service';
import { CreateCheckoutDto } from './dto/payments.dto';
import { User }          from '../../domains/users/entities/user.entity';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * CREAR CHECKOUT SESSION
   * Genera una sesión de pago en Stripe a partir de una orden existente.
   * El usuario es redirigido a la URL de Stripe — nunca manejamos datos de tarjeta.
   */
  async createCheckoutSession(
    order: Order,
    user: User,
  ): Promise<{ url: string; sessionId: string }> {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:4200');

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
      price_data: {
        currency:     this.config.get('STRIPE_CURRENCY', 'usd'),
        unit_amount:  item.unitPriceInCents,
        product_data: {
          name:     item.productNameSnapshot,
          metadata: { productId: item.product?.id ?? '' },
        },
      },
      quantity: item.quantity,
    }));

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items:           lineItems,
      mode:                 'payment',
      customer_email:       user.email,
      client_reference_id:  order.id,
      metadata: {
        orderId:     order.id,
        orderNumber: order.orderNumber,
        userId:      user.id,
      },
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${frontendUrl}/checkout/cancel?order_id=${order.id}`,
      expires_at:  Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutos
    });

    // Guardar el session ID en la orden para relacionarlo al recibir el webhook
    await this.ordersService.attachStripeSession(order.id, session.id);

    this.logger.log(`Checkout session creada: ${session.id} para orden ${order.orderNumber}`);
    return { url: session.url!, sessionId: session.id };
  }

  /**
   * PROCESAR WEBHOOK DE STRIPE
   *
   * Flujo de seguridad:
   * 1. Recibimos el raw body (sin parsear) para verificar la firma HMAC de Stripe.
   * 2. Si la firma no coincide → 400 inmediato (posible ataque).
   * 3. Solo procesamos `checkout.session.completed` (pago exitoso).
   * 4. Acción inmediata: marcar orden como PAID y responder 200 OK.
   * 5. Las tareas pesadas (PDF, email, shipping) van a la cola BullMQ.
   */
  async handleWebhook(req: RawBodyRequest<Request>): Promise<{ received: boolean }> {
    const sig     = req.headers['stripe-signature'] as string;
    const secret  = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET');
    const rawBody = req.rawBody;

    if (!sig || !rawBody) {
      throw new BadRequestException('Faltan headers de firma o body del webhook');
    }

    let event: Stripe.Event;

    try {
      // ── VERIFICACIÓN DE FIRMA HMAC ─────────────────────
      // Stripe firma cada webhook con HMAC-SHA256.
      // Si alguien intenta simular un pago, la firma no coincidirá → rechazado.
      event = this.stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      this.logger.warn(`Firma de webhook inválida: ${err.message}`);
      throw new BadRequestException(`Webhook signature inválida: ${err.message}`);
    }

    this.logger.log(`Webhook recibido: ${event.type} (id: ${event.id})`);

    // ── PROCESAR EVENTO ───────────────────────────────────
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.expired':
        await this.onCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.payment_failed':
        await this.onPaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        this.logger.debug(`Evento no manejado: ${event.type}`);
    }

    return { received: true };
  }

  // ── checkout.session.completed ────────────────────────────
  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { id: sessionId, payment_intent } = session;

    if (session.payment_status !== 'paid') {
      this.logger.warn(`Session ${sessionId} completada pero sin pago confirmado.`);
      return;
    }

    // markAsPaid se encarga de:
    // 1. Cambiar estado de orden a PAID
    // 2. Confirmar el stock (descuenta del total)
    // 3. Encolar jobs asíncronos en BullMQ (PDF, email, shipping)
    await this.ordersService.markAsPaid(sessionId, String(payment_intent));
  }

  // ── checkout.session.expired ──────────────────────────────
  private async onCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
    this.logger.log(`Checkout expirado: ${session.id} — las reservas serán liberadas por el cron del carrito.`);
  }

  // ── payment_intent.payment_failed ────────────────────────
  private async onPaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.warn(`Pago fallido: PaymentIntent ${paymentIntent.id}`);
    // Aquí podrías notificar al usuario por email
  }
}
