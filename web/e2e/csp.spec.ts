import { expect, test } from '@playwright/test';

test('CSP uses the matching non-empty nonce and allows Firebase and Google authentication origins', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push('console: ' + message.text());
  });
  page.on('pageerror', error => browserErrors.push('pageerror: ' + error.message));
  page.on('requestfailed', request => browserErrors.push('requestfailed: ' + request.url() + ' — ' + (request.failure()?.errorText ?? 'unknown')));

  const response = await page.goto('/login');
  const body = await page.locator('body').innerText().catch(() => '');
  const html = (await page.content()).slice(0, 6000);
  const policy = response?.headers()['content-security-policy'] ?? '';
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1] ?? '';
  const scriptNonces = await page.$$eval('script', elements => elements.map(element => (element as HTMLScriptElement).nonce));
  const styleNonces = await page.$$eval('link[rel="stylesheet"]', elements => elements.map(element => (element as HTMLLinkElement).nonce));
  console.log('E2E login diagnostic', JSON.stringify({
    status: response?.status(),
    url: page.url(),
    body: body.slice(0, 1200),
    html,
    noncePresent: nonce.length > 0,
    scriptNonces,
    styleNonces,
    browserErrors,
  }));

  expect(response).not.toBeNull();
  expect(nonce).not.toBe('');
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.every(value => value === nonce)).toBe(true);
  expect(styleNonces.length).toBeGreaterThan(0);
  expect(styleNonces.every(value => value === nonce)).toBe(true);
  expect(browserErrors.filter(error => error.includes('Refused to execute inline script'))).toEqual([]);
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
