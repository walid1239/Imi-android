import { expect, test } from '@playwright/test';

test('CSP nonce matches inline scripts and styles while allowing the Google SDK origin', async ({ page }) => {
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
  const inlineScriptNonces = await page.$$eval('script:not([src])', elements => elements.map(element => (element as HTMLScriptElement).nonce));
  const externalScripts = await page.$$eval('script[src]', elements => elements.map(element => ({
    src: (element as HTMLScriptElement).src,
    nonce: (element as HTMLScriptElement).nonce,
  })));
  const externalScriptsWithoutNonce = externalScripts.filter(script => !script.nonce);
  const styleNonces = await page.$$eval('link[rel="stylesheet"]', elements => elements.map(element => (element as HTMLLinkElement).nonce));
  console.log('E2E login diagnostic', JSON.stringify({
    status: response?.status(),
    url: page.url(),
    body: body.slice(0, 1200),
    html,
    noncePresent: nonce.length > 0,
    inlineScriptNonces,
    externalScripts,
    styleNonces,
    browserErrors,
  }));

  expect(response).not.toBeNull();
  expect(nonce).not.toBe('');
  expect(inlineScriptNonces.length).toBeGreaterThan(0);
  expect(inlineScriptNonces.every(value => value === nonce)).toBe(true);
  expect(styleNonces.length).toBeGreaterThan(0);
  expect(styleNonces.every(value => value === nonce)).toBe(true);
  expect(externalScriptsWithoutNonce.every(script => new URL(script.src).origin === 'https://apis.google.com')).toBe(true);
  expect(policy).toContain('https://apis.google.com');
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
