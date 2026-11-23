import { expect, test, type Page } from '@playwright/test';

const loginWithMockedAuthError = async (
  page: Page,
  firebaseMessage: string,
) => {
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword**', async route => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 400, message: firebaseMessage },
      }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill('auth-error-test@imi.test');
  await page.getByLabel('كلمة المرور').fill('IMI-Emulator-Password-2026!');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
};

test('login shows Arabic guidance for auth/unauthorized-domain', async ({ page }) => {
  // Firebase Auth maps the backend INVALID_ORIGIN response to auth/unauthorized-domain.
  await loginWithMockedAuthError(page, 'INVALID_ORIGIN');

  await expect(page.getByRole('status')).toContainText(
    'عنوان الموقع غير مسموح له باستخدام Firebase Authentication.',
  );
  await expect(page.getByRole('status')).not.toContainText('INVALID_ORIGIN');
});

test('login shows Arabic guidance for CONFIGURATION_NOT_FOUND', async ({ page }) => {
  await loginWithMockedAuthError(page, 'CONFIGURATION_NOT_FOUND');

  await expect(page.getByRole('status')).toContainText(
    'خدمة تسجيل الدخول في Firebase غير مكتملة الإعداد.',
  );
  await expect(page.getByRole('status')).not.toContainText('CONFIGURATION_NOT_FOUND');
});
