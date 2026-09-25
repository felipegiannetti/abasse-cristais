import 'reflect-metadata';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';
import { UPLOADS_DIR } from './storage/storage.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defesa extra contra CSRF (além do cookie SameSite=Lax): requisições que alteram dados
 * só são aceitas se a origem declarada pelo navegador for o nosso site.
 */
function originCheck(req: Request, _res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (!SAFE_METHODS.has(req.method) && origin && !config.webOrigins.includes(origin)) {
    return next(new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed.' }));
  }
  next();
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', true); // atrás da Vercel/Next: IP real do cliente
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.use(originCheck);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  if (!config.isProd && !config.blobToken) {
    app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });
  }

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
