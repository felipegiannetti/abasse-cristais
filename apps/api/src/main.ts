import 'reflect-metadata';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loginTokenGate } from './auth/login-token.middleware';
import { config } from './config';

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

  app.set('trust proxy', config.trustProxyHops); // trusted hops only; never `true` (X-Forwarded-For spoofing)
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  // Admin/auth responses carry private data: never let browsers or shared caches store them.
  app.use(['/admin', '/auth'], (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/auth/login', loginTokenGate);
  app.use(originCheck);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
