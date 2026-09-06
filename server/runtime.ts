import { randomBytes } from 'node:crypto';
import { createApp } from './app.js';

let app: ReturnType<typeof createApp> | undefined;
export function getApp() {
  if (app) return app;
  const upstream = process.env.COPYPARTY_URL;
  if (!upstream) throw new Error('Set COPYPARTY_URL in .env or the environment. See .env.example.');
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== 'development' && (!secret || secret.length < 32))
    throw new Error('SESSION_SECRET must be at least 32 characters in production.');
  app = createApp({
    upstream,
    secret: secret || randomBytes(32).toString('hex'),
    secureCookie: process.env.COOKIE_SECURE === 'true',
    authHeader: process.env.COPYPARTY_AUTH_HEADER || 'PW',
  });
  return app;
}
