import { devices, expect, test, webkit } from '@playwright/test';
import { readFileSync } from 'fs';

const FIXTURE = process.env.ETHOS_BACKUP ?? 'src/__tests__/fixtures/backup.json';
const { defaultBrowserType, ...iphone } = devices['iPhone 15'];

test('importing a backup and exporting it again gives back the same data', async ({}, info) => {
  // Playwright's throwaway contexts act like private browsing, where WebKit refuses the on-device database. Use a real profile.
  const ctx = await webkit.launchPersistentContext(info.outputPath('profile'), { ...iphone, baseURL: 'http://localhost:4173', acceptDownloads: true });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('/welcome');
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Restore from a backup file').click();
  await (await chooser).setFiles(FIXTURE);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  // Tap the Dock instead of page.goto: a full reload would race the old page for the storage lock.
  await page.locator('button', { hasText: /^Settings$/ }).click();
  const download = page.waitForEvent('download');
  await page.getByText('EXPORT').click();
  const out = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
  const inp = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  delete out.exported_at; delete inp.exported_at;
  expect(out).toEqual(inp);
  await ctx.close();
});
