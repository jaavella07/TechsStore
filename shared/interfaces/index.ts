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

// ─── Job de orden pagada (payload para BullMQ) ───────────────
export interface OrderPaidJobData {
  orderId: string;
  userId: string;
  userEmail: string;
  userName: string;
  totalAmount: number;
  stripeSessionId: string;
}

// ─── Parámetros de paginación ────────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}
