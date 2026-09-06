import { defineHandler } from 'nitro';
import { getRequestIP } from 'nitro/h3';
import { getApp } from '../runtime.js';

export default defineHandler((event) =>
  getApp()(event.req, getRequestIP(event, { xForwardedFor: false })),
);
