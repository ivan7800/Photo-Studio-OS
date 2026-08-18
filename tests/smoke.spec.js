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


test('adapta ropa al seleccionar modelo masculino adulto', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#subjectType', { label: 'Modelo masculino adulto' });
  await expect(page.locator('#wardrobeContextHint')).toContainText('Modo masculino');
  await expect(page.locator('#outfit-cotidiana')).toContainText('camisa Oxford blanca');
  await expect(page.locator('#outfit-gala')).toContainText('traje italiano azul marino');
  await expect(page.locator('#outfit-lenceria')).toContainText('Layering masculino');
  await expect(page.locator('#legmode')).toHaveValue('off');
  await page.waitForTimeout(500);
  const prompt = await page.locator('#output').inputValue();
  expect(prompt.toLowerCase()).not.toContain('vestido ajustado tipo bodycon');
  expect(prompt.toLowerCase()).not.toContain('medias thigh-high');
});


test('default UI uses general wardrobe wording', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Layering editorial/i })).toBeVisible();
});


test('v2 workspace navigation keeps Studio controls available', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Studio/ }).first().click();
  await expect(page.locator('#view-studio')).toHaveClass(/active/);
  await expect(page.locator('#age')).toBeVisible();
  await expect(page.locator('#output')).toBeVisible();
});

test('Settings contains API keys and manifest/service worker are reachable', async ({ page, request }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Settings/ }).first().click();
  await expect(page.locator('#keyOpenAI')).toBeVisible();
  expect((await request.get('./manifest.webmanifest')).ok()).toBeTruthy();
  expect((await request.get('./service-worker.js')).ok()).toBeTruthy();
});
