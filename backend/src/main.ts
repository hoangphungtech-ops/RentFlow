import 'reflect-metadata';
import { ArgumentsHost, Catch, ExceptionFilter, Module } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { sensitiveRateLimit } from './rate-limit';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { db, SessionGuard } from './auth';
import { AccountAuthentication, AccountManagement } from './accounts';
import { PublicController, RentalController } from './rental';

@Catch(Prisma.PrismaClientKnownRequestError)
class DatabaseError implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const conflict = ['P2002', 'P2003', 'P2034'].includes(error.code);
    response.status(conflict ? 409 : 503).json({
      message: conflict ? 'Dữ liệu bị trùng hoặc vừa được thay đổi. Vui lòng kiểm tra lại.' : 'Cơ sở dữ liệu chưa sẵn sàng.',
    });
  }
}

@Module({ controllers: [PublicController, RentalController, AccountAuthentication, AccountManagement], providers: [SessionGuard] })
class AppModule {}

async function bootstrap() {
  await db.$connect();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  if (publicOrigin) {
    if (new URL(publicOrigin).protocol !== 'https:') throw new Error('PUBLIC_ORIGIN must be HTTPS');
    app.enableCors({ origin: publicOrigin, methods: ['GET', 'POST', 'OPTIONS'] });
  }
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);
  app.use(sensitiveRateLimit);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DatabaseError());
  const config = new DocumentBuilder().setTitle('RentFlow API').setVersion('1.0').addBearerAuth().build();
  if (!publicOrigin) SwaggerModule.setup('swagger', app, () => SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.PORT ?? 3001), process.env.API_HOST ?? '127.0.0.1');
}

bootstrap().catch(() => {
  console.error('Không thể khởi động RentFlow API. Kiểm tra DATABASE_URL và cổng API.');
  process.exitCode = 1;
});
