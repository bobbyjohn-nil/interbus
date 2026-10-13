import { defineConfig } from '@playwright/test';

// Locally, PW_CHROMIUM points at a preinstalled Chromium; CI installs Playwright's own pinned browser.
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      // Chrome 139+ gives machines without a GPU no WebGL unless software rendering is allowed.
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/',
    // Never reuse whatever already listens on 4173: it may be another checkout's build.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
