import { Module }       from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule }   from '@nestjs/bullmq';
import { MailModule }   from './mail/mail.module';
import { QueueName }    from '@shared/enums';
import { EmailsProcessor } from './queues/processors/emails.processor';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // ── Conectar a la misma Redis que la API ──────────────
    BullModule.forRoot({
      connection: {
        host:     process.env.REDIS_HOST     ?? 'localhost',
        port:     parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD ?? '',
      },
    }),

    // ── Worker BullMQ real de la cola de emails ───────────
    BullModule.registerQueue({ name: QueueName.EMAILS }),

    MailModule,
  ],
  controllers: [HealthController],
  providers: [EmailsProcessor],
})
export class NotificationsModule {}
