import { defineConfig } from 'nitro';

export default defineConfig({
  serverDir: './server',
  preset: 'node-server',
  routeRules: {
    '/**': {
      headers: {
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'x-frame-options': 'DENY',
      },
    },
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },
});
