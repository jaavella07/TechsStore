import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map }        from 'rxjs/operators';

export interface StandardResponse<T> {
  success:   boolean;
  data:      T;
  timestamp: string;
}

/**
 * Transforma TODAS las respuestas exitosas al formato:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "timestamp": "2024-..."
 * }
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next:    CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success:   true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
