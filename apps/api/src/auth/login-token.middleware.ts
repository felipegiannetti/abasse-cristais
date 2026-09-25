import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export const LOGIN_TOKEN_HEADER = 'x-admin-login-token';

const digest = (v: string) => createHash('sha256').update(v).digest();

/**
 * Login is only reachable from the secret admin address: the web app reads the secret path segment
 * and sends it in this header. Anyone else gets an indistinguishable 404.
 *
 * It is an Express middleware on purpose (it runs BEFORE guards): requests without the token never
 * reach the rate limiter or the database, so an attacker who spams the endpoint cannot exhaust the
 * limiter's bucket (shared by every user behind the same proxy IP) and lock the real admin out.
 */
export function loginTokenGate(req: Request, res: Response, next: NextFunction) {
  const sent = req.headers[LOGIN_TOKEN_HEADER];
  const ok =
    config.loginToken !== '' &&
    typeof sent === 'string' &&
    timingSafeEqual(digest(sent), digest(config.loginToken)); // constant time, equal-length digests
  if (!ok) return res.status(404).json({ code: 'LOGIN_UNAVAILABLE', message: 'Not found.' });
  next();
}
