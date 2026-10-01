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
 *
 * Nas rotas que LEEM O COOKIE DE SESSÃO (`/admin/*` e `/auth/*`, exceto o próprio `/auth/login`,
 * que ainda não tem sessão para roubar e já exige o token secreto do endereço de login) a ausência
 * do cabeçalho também é recusada — um navegador sempre o envia num fetch/XHR, mesmo same-origin,
 * então só falta em requisições que não carregam a sessão do admin de qualquer forma. As demais
 * rotas (ex. `/track/click`) continuam aceitando a ausência: são públicas, não autenticadas, e o
 * redirecionamento do QR code (`apps/web/src/app/q/[slug]/route.ts`) as chama servidor-a-servidor,
 * sem Origin.
 */
function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  const sessionScoped = (req.path === '/admin' || req.path.startsWith('/admin/') || req.path.startsWith('/auth')) && req.path !== '/auth/login';
  const blocked = sessionScoped ? !origin || !config.webOrigins.includes(origin) : origin && !config.webOrigins.includes(origin);
  if (blocked) {
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
