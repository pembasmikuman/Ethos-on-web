import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173', ...devices['iPhone 15'] },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'bun run build && bunx vite preview --port 4173', port: 4173, reuseExistingServer: true },
});
