import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { OrdersService }          from '../services/orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { PaginationDto }          from '../../users/dto/user.dto';
import { JwtAuthGuard }           from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard }             from '../../../modules/auth/guards/roles.guard';
import { Roles }                  from '../../../modules/auth/decorators/roles.decorator';
import { CurrentUser }            from '../../../modules/auth/decorators/current-user.decorator';
import { User }                   from '../../users/entities/user.entity';
import { UserRole } from '@shared/enums';


@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── POST /orders — Crear orden desde carrito ──────────────
  @Post()
  @ApiOperation({ summary: 'Crear orden desde el carrito activo (el pago se hace vía Stripe)' })
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.createFromCart(user.id, dto);
  }

  // ── GET /orders/me — Mis órdenes ──────────────────────────
  @Get('me')
  @ApiOperation({ summary: 'Listar mis órdenes' })
  myOrders(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    return this.ordersService.findMyOrders(user.id, pagination);
  }

  // ── GET /orders — Todas las órdenes (ADMIN) ───────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Listar todas las órdenes' })
  findAll(@Query() pagination: PaginationDto) {
    return this.ordersService.findAll(pagination);
  }

  // ── GET /orders/:id — Ver orden ───────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Ver detalle de una orden (propia o admin)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.findOne(id, user.id, user.role);
  }

  // ── PATCH /orders/:id/status (ADMIN) ─────────────────────
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Cambiar estado de orden (envío, entrega, etc.)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }
}
