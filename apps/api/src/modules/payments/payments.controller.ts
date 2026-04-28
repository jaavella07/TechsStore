import {
  Controller, Post, Body, UseGuards, Req,
  HttpCode, HttpStatus, RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';

import { PaymentsService }    from './payments.service';
import { CreateCheckoutDto }  from './dto/payments.dto';
import { OrdersService }      from '../../domains/orders/services/orders.service';
import { JwtAuthGuard }       from '../auth/guards/jwt-auth.guard';
import { CurrentUser }        from '../auth/decorators/current-user.decorator';
import { User }               from '../../domains/users/entities/user.entity';
import { UserRole }           from '@shared/enums';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService:   OrdersService,
  ) {}

  /**
   * POST /api/v1/payments/checkout
   * Genera una Stripe Checkout Session para una orden pendiente.
   * Devuelve una URL a la que el frontend debe redirigir al usuario.
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generar sesión de pago Stripe para una orden',
    description: `
      1. El cliente crea una orden (POST /orders).
      2. Llama a este endpoint con el orderId.
      3. Se devuelve una URL de Stripe Checkout.
      4. El frontend redirige al usuario a esa URL.
      5. Stripe procesa el pago y llama al webhook.
    `,
  })
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.findOne(dto.orderId, user.id, user.role as UserRole);
    return this.paymentsService.createCheckoutSession(order, user);
  }

  /**
   * POST /payments/webhook
   * ─────────────────────────────────────────────────────────────────
   * CRÍTICO: Este endpoint DEBE recibir el raw body (Buffer sin parsear).
   *
   * Por eso está excluido del prefijo global (ver main.ts) y usa
   * rawBody: true en NestFactory.create(). Sin el raw body, la
   * verificación de firma HMAC-SHA256 de Stripe siempre falla.
   *
   * NO añadir @UseGuards(JwtAuthGuard) aquí — Stripe no envía JWT.
   * La seguridad la provee la verificación de firma en PaymentsService.
   * ─────────────────────────────────────────────────────────────────
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Ocultar del Swagger (es un endpoint interno)
  async stripeWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.paymentsService.handleWebhook(req);
  }
}
