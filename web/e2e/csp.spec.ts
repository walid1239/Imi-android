import { expect, test } from '@playwright/test';

test('CSP uses a nonce and allows Firebase and Google authentication origins', async ({ page }) => {
  const response = await page.goto('/login');
  console.log('E2E login response', response?.status(), page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 500));
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
