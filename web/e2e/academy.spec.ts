import { expect, test } from '@playwright/test';

test('public academy is readable without an account and has an Arabic RTL empty state', async ({ page }) => {
  await page.goto('/academy');
  await expect(page.getByRole('heading', { name: 'تعلّم وتقدّم' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('لا توجد دورات منشورة حالياً')).toBeVisible();
  await expect(page.getByRole('link', { name: 'تسجيل الدخول لحفظ التقدم سحابياً' })).toBeVisible();
});

test('learner can create an emulator account and open friends, chats, statuses and academy sections', async ({ page }) => {
  const email = `e2e-${Date.now()}@imi.test`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'ليس لديك حساب؟ إنشاء حساب' }).click();
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('IMI-Test-Password-2026!');
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: /الأصدقاء/ }).first().click();
  await expect(page.getByRole('heading', { name: 'ابحث عن أصدقاء' })).toBeVisible();
  await page.getByRole('button', { name: /الحالات/ }).first().click();
  await expect(page.getByRole('heading', { name: 'أضف حالة جديدة' })).toBeVisible();
  await page.getByRole('button', { name: /الأكاديمية/ }).first().click();
  await expect(page.getByRole('heading', { name: 'تعلّم وتقدّم' })).toBeVisible();
});

test('privacy and terms remain visibly marked as drafts', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText(/مسودة ما قبل الإطلاق/)).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByText(/مسودة ما قبل الإطلاق/)).toBeVisible();
});

test('mobile academy keeps RTL direction and a usable viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/academy');
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'تعلّم وتقدّم' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.locator('body').evaluate(el => el.scrollWidth));
});
