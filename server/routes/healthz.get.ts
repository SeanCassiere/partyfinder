import { defineHandler } from 'nitro';
import { getApp } from '../runtime.js';

export default defineHandler((event) => getApp()(event.req));
