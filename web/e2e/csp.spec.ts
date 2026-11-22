import { expect, test } from '@playwright/test';

test('CSP uses a nonce and allows Firebase and Google authentication origins', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push('console: ' + message.text());
  });
  page.on('pageerror', error => browserErrors.push('pageerror: ' + error.message));
  page.on('requestfailed', request => browserErrors.push('requestfailed: ' + request.url() + ' — ' + (request.failure()?.errorText ?? 'unknown')));
  const response = await page.goto('/login');
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('E2E login diagnostic', JSON.stringify({
    status: response?.status(),
    url: page.url(),
    body: body.slice(0, 1200),
    html: (await page.content()).slice(0, 6000),
    browserErrors,
  }));
  expect(response).not.toBeNull();
  const policy = response!.headers()['content-security-policy'] ?? '';
  expect(policy).toContain("frame-src 'self'");
  expect(policy).toContain('https://*.firebaseapp.com');
  expect(policy).toContain('https://accounts.google.com');
  expect(policy).toContain('connect-src');
  expect(policy).toMatch(/'nonce-[^']+'/);
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toContain("'unsafe-inline'");
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();
});
