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
      host: '0.0.0.0',
      port: parseInt(process.env.NOTIFICATIONS_TCP_PORT ?? '4000'),
    },
  });

  // ── También consume la cola de BullMQ Redis directamente ──
  await app.startAllMicroservices();
  await app.listen(parseInt(process.env.NOTIFICATIONS_HTTP_PORT ?? '4001'));

  console.log('\n📬 Microservicio de Notificaciones corriendo en puerto 4000\n');
}

bootstrap();
