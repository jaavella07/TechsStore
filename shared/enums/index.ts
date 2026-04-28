// ─── Roles de usuario ────────────────────────────────────────
export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
}

// ─── Estado de la orden ──────────────────────────────────────
export enum OrderStatus {
  PENDING    = 'PENDING',     // Creada, sin pago
  PAID       = 'PAID',        // Pago confirmado por webhook
  PROCESSING = 'PROCESSING',  // En preparación
  SHIPPED    = 'SHIPPED',     // Enviada
  DELIVERED  = 'DELIVERED',   // Entregada
  CANCELLED  = 'CANCELLED',   // Cancelada
  REFUNDED   = 'REFUNDED',    // Reembolsada
}

// ─── Estado de reserva de inventario ─────────────────────────
export enum InventoryReservationStatus {
  RESERVED  = 'RESERVED',   // Bloqueado en carrito
  CONFIRMED = 'CONFIRMED',  // Confirmado tras pago
  RELEASED  = 'RELEASED',   // Liberado (carrito expirado / cancelado)
}

// ─── Tipos de notificación ────────────────────────────────────
export enum NotificationType {
  ORDER_CONFIRMED  = 'ORDER_CONFIRMED',
  ORDER_SHIPPED    = 'ORDER_SHIPPED',
  ORDER_DELIVERED  = 'ORDER_DELIVERED',
  INVOICE_READY    = 'INVOICE_READY',
  PASSWORD_RESET   = 'PASSWORD_RESET',
  WELCOME          = 'WELCOME',
}

// ─── Nombres de colas BullMQ ─────────────────────────────────
export enum QueueName {
  ORDERS      = 'orders-queue',
  INVOICES    = 'invoices-queue',
  EMAILS      = 'emails-queue',
  SHIPPING    = 'shipping-queue',
}

// ─── Jobs dentro de las colas ────────────────────────────────
export enum JobName {
  PROCESS_ORDER_PAID   = 'process-order-paid',
  GENERATE_INVOICE     = 'generate-invoice',
  SEND_ORDER_EMAIL     = 'send-order-email',
  NOTIFY_SHIPPING      = 'notify-shipping',
}
