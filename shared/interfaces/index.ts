import { UserRole } from '../enums';

// ─── Payload del JWT ─────────────────────────────────────────
export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ─── Payload del Refresh Token ───────────────────────────────
export interface JwtRefreshPayload extends JwtPayload {
  refreshToken?: string;
}

// ─── Respuesta paginada genérica ─────────────────────────────
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Snapshot de ítem de orden para jobs (evita acoplar a BD) ─
export interface OrderPaidItemSnapshot {
  productNameSnapshot: string;
  quantity: number;
  unitPriceInCents: number;
  subtotalInCents: number;
}

// ─── Job de orden pagada (payload para BullMQ) ───────────────
export interface OrderPaidJobData {
  orderId: string;
  userId: string;
  userEmail: string;
  userName: string;
  totalAmount: number;
  stripeSessionId: string;
  orderNumber: string;
  items: OrderPaidItemSnapshot[];
}

// ─── Job específico de emails-queue (consumido por apps/notifications) ─
export interface SendOrderEmailJobData {
  orderId: string;
  userEmail: string;
  userName: string;
  totalAmount: number;
  orderNumber: string;
  items: OrderPaidItemSnapshot[];
}

// ─── Parámetros de paginación ────────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}
