import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 100000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: process.env.APP_URL ?? 'http://127.0.0.1:4173/operation-room-manager/', viewport: { width: 1280, height: 900 }, headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: process.env.APP_URL ? undefined : { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173/operation-room-manager/', reuseExistingServer: !process.env.CI, timeout: 20000 },
});
