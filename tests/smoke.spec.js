const { test, expect } = require('@playwright/test');

test('carga la app y genera prompt sin errores críticos', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.getByRole('button', { name: /generar/i }).first().click();
  await expect(page.locator('#output')).toBeVisible();
  await expect(page.locator('#output')).not.toHaveValue('');
  expect(errors).toEqual([]);
});

test('no persiste API keys en localStorage', async ({ page }) => {
  await page.goto('/');
  await page.fill('#keyOpenAI', 'sk-test-no-real-key');
  const local = await page.evaluate(() => Object.keys(localStorage).join(' '));
  const session = await page.evaluate(() => Object.keys(sessionStorage).join(' '));
  expect(local).not.toContain('sk-test-no-real-key');
  expect(session.length).toBeGreaterThan(0);
});

test('CSP no usa unsafe-inline', async ({ page }) => {
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toBeTruthy();
  expect(csp).not.toContain('unsafe-inline');
});
