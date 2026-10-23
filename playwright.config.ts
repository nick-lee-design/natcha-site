import { defineConfig } from '@playwright/test';

const PORT = 3123;

// Runs against a production build: `npm run build` first (npm run test does both)
export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: false,
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1600, height: 900 } },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/pitch`,
    reuseExistingServer: false,
    env: { PITCH_EMAIL_DRY_RUN: '1' },
  },
});
