import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/renderer',
  outputDir: './test-results/renderer',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, threshold: 0.2 } },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    colorScheme: 'dark',
    locale: 'pt-BR',
    contextOptions: { reducedMotion: 'reduce' },
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --config tests/renderer/vite.config.ts --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
