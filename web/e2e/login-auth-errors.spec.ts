import { expect, test } from '@playwright/test';

test('login shows Arabic guidance for auth/unauthorized-domain', async ({ page }) => {
  await page.route('**/identitytoolkit.googleapis.com/v1/projects**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projectId: 'demo-imi-playwright',
        authorizedDomains: ['localhost'],
      }),
    });
  });

  await page.goto('/login?e2e-auth-domain-check=1');
  await page.getByRole('button', { name: 'المتابعة باستخدام Google' }).click();

  await expect(page.getByRole('status')).toContainText(
    'عنوان الموقع غير مسموح له باستخدام Firebase Authentication.',
  );
  await expect(page.getByRole('status')).not.toContainText('auth/unauthorized-domain');
});

test('login shows Arabic guidance for CONFIGURATION_NOT_FOUND', async ({ page }) => {
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword**', async route => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 400, message: 'CONFIGURATION_NOT_FOUND' },
      }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill('auth-error-test@imi.test');
  await page.getByLabel('كلمة المرور').fill('IMI-Emulator-Password-2026!');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  await expect(page.getByRole('status')).toContainText(
    'خدمة تسجيل الدخول في Firebase غير مكتملة الإعداد.',
  );
  await expect(page.getByRole('status')).not.toContainText('CONFIGURATION_NOT_FOUND');
});
