import { Module }       from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule }   from '@nestjs/bullmq';
import { MailModule }   from './mail/mail.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { QueueName }    from '../../../shared/enums';
import { NotificationsController } from './notifications.controller';

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

    // ── Este microservicio también puede consumir la cola de emails
    BullModule.registerQueue({ name: QueueName.EMAILS }),

    MailModule,
    WhatsappModule,
  ],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
