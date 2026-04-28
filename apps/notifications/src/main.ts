import { NestFactory }   from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe }  from '@nestjs/common';
import { NotificationsModule } from './notifications.module';

async function bootstrap() {
  // ── Servidor híbrido: HTTP + Microservicio TCP ────────────
  const app = await NestFactory.create(NotificationsModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ── Conector TCP para recibir mensajes del API principal ──
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.NOTIFICATIONS_HOST ?? '0.0.0.0',
      port: parseInt(process.env.NOTIFICATIONS_PORT ?? '4000'),
    },
  });

  // ── También consume la cola de BullMQ Redis directamente ──
  await app.startAllMicroservices();
  await app.listen(process.env.NOTIFICATIONS_PORT ?? 4000);

  console.log('\n📬 Microservicio de Notificaciones corriendo en puerto 4000\n');
}

bootstrap();
