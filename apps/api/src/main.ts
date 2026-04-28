import { NestFactory, Reflector }     from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService }                from '@nestjs/config';
import { AppModule }                    from './app.module';
import { GlobalExceptionFilter }        from './common/filters/global-exception.filter';
import { TransformInterceptor }         from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port   = config.get<number>('PORT', 3000);
  const prefix = config.get<string>('API_PREFIX', 'api/v1');

  app.setGlobalPrefix(prefix, { exclude: ['payments/webhook'] });

  app.enableCors({
    origin:      config.get<string>('FRONTEND_URL', 'http://localhost:4200'),
    credentials: true,
    methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
      transformOptions:     { enableImplicitConversion: true },
      stopAtFirstError:     false,
    }),
  );

  const swaggerCfg = new DocumentBuilder()
    .setTitle('TechsStore API')
    .setDescription('E-Commerce Modular — NestJS · Productos · Carrito · Pagos Stripe · BullMQ')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('Auth',     'JWT Access + Refresh Tokens')
    .addTag('Users',    'Gestión de usuarios')
    .addTag('Products', 'Catálogo, categorías y stock')
    .addTag('Cart',     'Carrito con reserva de inventario')
    .addTag('Orders',   'Órdenes de compra')
    .addTag('Payments', 'Checkout Stripe + Webhook')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  console.log(`\n🚀  API:   http://localhost:${port}/${prefix}`);
  console.log(`📖  Docs:  http://localhost:${port}/docs\n`);
}

bootstrap();
