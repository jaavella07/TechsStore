import { Module }          from '@nestjs/common';
import { APP_GUARD }       from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { BullModule }      from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { UsersModule }     from './domains/users/users.module';
import { ProductsModule }  from './domains/products/products.module';
import { CartModule }      from './domains/cart/cart.module';
import { OrdersModule }    from './domains/orders/orders.module';

import { AuthModule }      from './modules/auth/auth.module';
import { PaymentsModule }  from './modules/payments/payments.module';
import { QueuesModule }    from './modules/queues/queues.module';
import { HealthController }     from './common/health/health.controller';
import { SeedModule }            from './common/seeds/seed.module';
import { SnakeNamingStrategy }   from './common/snake-naming.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // B4 — Rate-limiting global (60 req/min). Rutas de auth tienen límite propio más estricto.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type:             'postgres',
        host:             cfg.get('DB_HOST', 'localhost'),
        port:             cfg.get<number>('DB_PORT', 5432),
        username:         cfg.get('DB_USER', 'postgres'),
        password:         cfg.get('DB_PASS', 'postgres'),
        database:         cfg.get('DB_NAME', 'techsstore'),
        autoLoadEntities:  true,
        synchronize:       cfg.get<boolean>('DB_SYNC', false),
        namingStrategy:    new SnakeNamingStrategy(),
        logging:          cfg.get('NODE_ENV') === 'development',
        ssl:              cfg.get('NODE_ENV') === 'production'
                            ? { rejectUnauthorized: false }
                            : false,
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host:     cfg.get('REDIS_HOST', 'localhost'),
          port:     cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get('REDIS_PASSWORD', ''),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff:  { type: 'exponential', delay: 3000 },
          removeOnComplete: { count: 100 },
          removeOnFail:     { count: 50 },
        },
      }),
    }),

    UsersModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    AuthModule,
    PaymentsModule,
    QueuesModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [
    // B4 — Guard global de throttling
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
