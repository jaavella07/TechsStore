import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error   = 'Internal Server Error';

    // ── HttpException (NestJS estándar) ───────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj['message'] ?? message;
        error   = resObj['error']   ?? error;
      }

    // ── TypeORM: violación de unicidad ────────────────────
    } else if (exception instanceof QueryFailedError) {
      const driverError = (exception as any).driverError;
      if (driverError?.code === '23505') { // Unique constraint
        status  = HttpStatus.CONFLICT;
        error   = 'Conflict';
        message = 'Ya existe un registro con esos datos únicos';
      } else if (driverError?.code === '23503') { // Foreign key
        status  = HttpStatus.BAD_REQUEST;
        error   = 'Bad Request';
        message = 'Referencia a un recurso que no existe';
      } else {
        this.logger.error(`QueryFailedError: ${exception.message}`);
      }

    // ── TypeORM: entidad no encontrada ────────────────────
    } else if (exception instanceof EntityNotFoundError) {
      status  = HttpStatus.NOT_FOUND;
      error   = 'Not Found';
      message = 'Recurso no encontrado';

    // ── Error no manejado ─────────────────────────────────
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    // ── Respuesta JSON estandarizada ──────────────────────
    response.status(status).json({
      statusCode: status,
      error,
      message,
      path:      request.url,
      method:    request.method,
      timestamp: new Date().toISOString(),
    });
  }
}
