import { NestFactory }   from '@nestjs/core';
import { ValidationPipe }  from '@nestjs/common';
import { NotificationsModule } from './notifications.module';

async function bootstrap() {
  // ── Worker BullMQ puro (consume emails-queue desde Redis) ──
  // El servidor HTTP solo expone un health-check.
  const app = await NestFactory.create(NotificationsModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = parseInt(process.env.NOTIFICATIONS_HTTP_PORT ?? '4001');
  await app.listen(port);

  console.log(`\n📬 Servicio de Notificaciones (worker BullMQ) corriendo — health-check en puerto ${port}\n`);
}

bootstrap();
