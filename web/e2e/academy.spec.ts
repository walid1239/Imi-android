import { expect, test, type Page } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const adminSdkApp = getApps().find(app => app.name === 'imi-academy-ui-e2e')
  ?? initializeApp({ projectId: 'demo-imi-playwright' }, 'imi-academy-ui-e2e');
const adminAuth = getAuth(adminSdkApp);
const adminDb = getFirestore(adminSdkApp);

const password = 'IMI-Emulator-Password-2026!';
const suffix = (project: string) => project.includes('mobile') ? 'mobile' : 'desktop';
const email = (role: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'admin', project: string) => `e2e-${role}-${suffix(project)}@imi.test`;

async function login(page: Page, address: string) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(address);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  try {
    await expect(page).toHaveURL(/\/app$/, { timeout: 15000 });
  } catch {
    const messages = await page.locator('[role="status"], [role="alert"]').allTextContents();
    throw new Error(`Login did not reach /app. Visible Firebase/auth messages: ${messages.join(' | ') || 'none'}`);
  }
}

test('public academy shows the empty curriculum hierarchy without fake lessons', async ({ page }) => {
  const response = await page.goto('/academy');
  await expect(response).not.toBeNull();
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'ابدأ من مستواك، وتقدّم خطوة بخطوة' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByLabel('المستوى')).toBeVisible();
  await page.getByLabel('المستوى').selectOption('e2e-primary');
  await page.getByLabel('الشعبة أو المسلك').selectOption('e2e-primary-track');
  await expect(page.getByRole('button', { name: /الرياضيات - اختبار/ })).toBeVisible();
  await page.getByRole('button', { name: /مادة بلا دروس - اختبار/ }).click();
  await expect(page.getByText('لا وحدات بعد.')).toBeVisible();
  await expect(page.getByText('لا دروس بعد. سيضيفها أساتذتنا قريباً')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مهارة التعلم الذاتي' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'تسجيل الدخول لحفظ التقدم سحابياً' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'أصبح أستاذاً' })).toBeVisible();
});
test('two learners can befriend each other, exchange a message and publish a status', async ({ page, browser }) => {
  const project = test.info().project.name;
  const fixtureBase = suffix(project);
  const fixture = test.info().retry > 0 ? `${fixtureBase}-retry${test.info().retry}` : fixtureBase;
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await login(page, `e2e-a-${fixture}@imi.test`);
    await login(secondPage, `e2e-f-${fixture}@imi.test`);

    await page.getByRole('button', { name: /الأصدقاء/ }).first().click();
    await page.getByPlaceholder('اكتب حرفين على الأقل من الاسم…').fill('تلميذ فاء ' + fixture);
    await expect(page.getByText('تلميذ فاء ' + fixture).first()).toBeVisible();
    const addFriend = page.getByTestId('add-friend-imi-e2e-f-' + fixture);
    await expect(addFriend).toBeVisible();
    await expect(addFriend).toBeEnabled();
    await addFriend.click();
    await expect(page.getByRole('status')).toContainText('أُرسل طلب الصداقة');

    await secondPage.getByRole('button', { name: /الأصدقاء/ }).first().click();
    await expect(secondPage.getByText(/طلبات الصداقة الواردة/)).toBeVisible();
    await secondPage.getByRole('button', { name: 'قبول' }).click();
    await expect(secondPage.getByRole('status')).toContainText('تم قبول طلب الصداقة');

    await page.getByRole('button', { name: /المحادثات/ }).first().click();
    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ فاء ' + fixture);
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await expect(page.getByText('تلميذ فاء ' + fixture, { exact: true })).toBeVisible()
    await page.getByTestId('start-chat-imi-e2e-f-' + fixture).click();
    await page.getByPlaceholder('اكتب رسالتك…').fill('رسالة اختبار من IMI');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(page.locator('article').getByText('رسالة اختبار من IMI')).toBeVisible();

    await secondPage.getByRole('button', { name: /المحادثات/ }).first().click();
    await expect(secondPage.locator('article').getByText('رسالة اختبار من IMI')).toBeVisible({ timeout: 15000 });

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'حظر المستخدم' }).click();
    await expect(page.getByRole('status')).toContainText('تم حظر المستخدم وإيقاف المحادثة المباشرة');

    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ هاء ' + fixture);
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await page.getByTestId('toggle-group-member-imi-e2e-e-' + fixture).click();
    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ دال ' + fixture);
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await page.getByTestId('toggle-group-member-imi-e2e-d-' + fixture).click();
    await page.getByPlaceholder('اسم المجموعة').fill('مجموعة اختبار');
    await page.getByRole('button', { name: 'إنشاء مجموعة (3 أعضاء على الأقل)' }).click();
    await expect(page.getByRole('heading', { name: 'مجموعة اختبار' })).toBeVisible();
    await page.getByPlaceholder('اكتب رسالتك…').fill('رسالة داخل مجموعة');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(page.locator('article').getByText('رسالة داخل مجموعة')).toBeVisible();

    await page.getByRole('button', { name: /الحالات/ }).first().click();
    await page.getByPlaceholder('ماذا تريد أن تشارك؟').fill('حالة اختبار من IMI');
    await page.getByRole('button', { name: 'نشر الحالة' }).click();
    await expect(page.getByRole('status')).toContainText('نُشرت حالتك');
  } finally {
    await secondContext.close();
  }
});

test('signed-in learner sees the same empty curriculum without legacy course lessons', async ({ page }) => {
  await login(page, email('a', test.info().project.name));
  await expect(page.getByRole('button', { name: /إدارة الأكاديمية/ })).toHaveCount(0);
  await page.getByRole('button', { name: /الأكاديمية/ }).first().click();
  await expect(page.getByRole('heading', { name: 'ابدأ من مستواك، وتقدّم خطوة بخطوة' })).toBeVisible();
  await page.getByLabel('المستوى').selectOption('e2e-primary');
  await page.getByLabel('الشعبة أو المسلك').selectOption('e2e-primary-track');
  await page.getByRole('button', { name: /مادة بلا دروس - اختبار/ }).click();
  await expect(page.getByText('لا وحدات بعد.')).toBeVisible();
  await expect(page.getByText('لا دروس بعد. سيضيفها أساتذتنا قريباً')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مهارة التعلم الذاتي' })).toHaveCount(0);
});
test('admin reviews teacher applications through the UI and syncs Auth claims', async ({ page }) => {
  const project = test.info().project.name;
  const fixture = test.info().retry > 0 ? `${suffix(project)}-retry${test.info().retry}` : suffix(project);
  const approvedUid = 'imi-e2e-a-' + fixture;
  const rejectedUid = 'imi-e2e-review-reject-' + fixture;
  const rejectedEmail = `e2e-review-reject-${fixture}@imi.test`;
  const proofUrl = 'https://drive.google.com/file/d/imi-e2e-fixture/view';

  await adminDb.doc('teacherApplications/' + rejectedUid).set({
    uid: rejectedUid, fullName: 'طلب أستاذ مرفوض ' + fixture,
    subjectIds: ['e2e-primary-math'], levelIds: ['e2e-primary'],
    proofUrl, status: 'pending', submittedAt: new Date(),
  });
  await adminAuth.setCustomUserClaims(approvedUid, {});
  try {
    await adminAuth.getUser(rejectedUid);
  } catch {
    await adminAuth.createUser({
      uid: rejectedUid, email: rejectedEmail, password, emailVerified: true,
    });
  }
  await adminAuth.setCustomUserClaims(rejectedUid, {});

  await login(page, `e2e-admin-${fixture}@imi.test`);
  await expect(page.getByRole('button', { name: /إدارة الأكاديمية/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /إدارة الأكاديمية/ }).first().click();
  await expect(page.getByRole('heading', { name: 'إدارة الأكاديمية' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إدارة شجرة المنهاج' })).toBeVisible();

  const contentTitle = 'درس أستاذ اختبار منشور ' + fixture;
  await expect(page.getByText(contentTitle, { exact: true })).toBeVisible();
  const draftCard = page.locator('article').filter({ has: page.getByText(contentTitle, { exact: true }) });
  await expect(draftCard.getByRole('button', { name: 'اعتماد ونشر' })).toBeDisabled();

  const approvedCard = page.locator('article').filter({ has: page.getByText('UID: ' + approvedUid, { exact: true }) });
  const approvedProof = approvedCard.getByRole('link', { name: 'فتح رابط الإثبات' });
  await expect(approvedProof).toHaveAttribute('href', proofUrl);
  await expect(approvedProof).toHaveAttribute('rel', /noopener/);
  const approvalResponsePromise = page.waitForResponse(response =>
    response.url().includes('/api/v1/admin/teachers/review')
    && response.request().method() === 'POST',
  );
  await approvedCard.getByRole('button', { name: 'اعتماد التوثيق' }).click();
  const approvalResponse = await approvalResponsePromise;
  const approvalBody = await approvalResponse.json().catch(() => ({}));
  expect(approvalResponse.status(), JSON.stringify(approvalBody)).toBe(200);
  await expect(page.getByRole('status')).toContainText('تم اعتماد الطلب ومنح صلاحية الأستاذ الموثق.');
  expect((await adminDb.doc('teacherApplications/' + approvedUid).get()).get('status')).toBe('approved');
  const approvedUser = await adminAuth.getUser(approvedUid);
  expect(approvedUser.customClaims).toMatchObject({ teacher: true, teacherVerified: true });

  const rejectedCard = page.locator('article').filter({ has: page.getByText('UID: ' + rejectedUid, { exact: true }) });
  await expect(rejectedCard.getByRole('button', { name: 'رفض الطلب' })).toBeEnabled();
  const rejectionResponsePromise = page.waitForResponse(response =>
    response.url().includes('/api/v1/admin/teachers/review')
    && response.request().method() === 'POST',
  );
  await rejectedCard.getByRole('button', { name: 'رفض الطلب' }).click();
  const rejectionResponse = await rejectionResponsePromise;
  const rejectionBody = await rejectionResponse.json().catch(() => ({}));
  expect(rejectionResponse.status(), JSON.stringify(rejectionBody)).toBe(200);
  await expect(page.getByRole('status')).toContainText('تم رفض طلب التوثيق.');
  expect((await adminDb.doc('teacherApplications/' + rejectedUid).get()).get('status')).toBe('rejected');
  const rejectedUser = await adminAuth.getUser(rejectedUid);
  expect(rejectedUser.customClaims?.teacher).not.toBe(true);
  expect(rejectedUser.customClaims?.teacherVerified).not.toBe(true);
  const audit = await adminDb.collection('moderationAudit').get();
  expect(audit.docs.some(doc => JSON.stringify(doc.data()).includes(rejectedUid))).toBe(true);
  await expect(page.getByText(/مراجعة محتوى الأساتذة وتوثيقهم وإدارة الدورات متوقفة مؤقتاً/)).toBeVisible();
});


test('verified teachers cannot start private student chats or mixed private groups', async ({ page }) => {
  await login(page, email('c', test.info().project.name));
  await page.goto('/app');
  await page.getByRole('button', { name: /المحادثات/ }).first().click();
  await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ باء ' + suffix(test.info().project.name));
  await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
  await page.getByTestId('start-chat-imi-e2e-b-' + suffix(test.info().project.name)).click();
  await expect(page.locator('p[role="alert"]')).toContainText('التواصل الخاص بين الأستاذ والتلميذ غير متاح');
  await page.getByTestId('toggle-group-member-imi-e2e-b-' + suffix(test.info().project.name)).click();
  await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ ألف ' + suffix(test.info().project.name));
  await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
  await page.getByTestId('toggle-group-member-imi-e2e-a-' + suffix(test.info().project.name)).click();
  await page.getByPlaceholder('اسم المجموعة').fill('مجموعة مختلطة ممنوعة');
  await page.getByRole('button', { name: 'إنشاء مجموعة (3 أعضاء على الأقل)' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('المجموعات الخاصة بين الأساتذة والتلاميذ غير متاحة');
});

test('unreviewed teacher drafts remain hidden from the learner curriculum', async ({ page }) => {
  await page.goto('/academy');
  await page.getByLabel('المستوى').selectOption('e2e-primary');
  await page.getByLabel('الشعبة أو المسلك').selectOption('e2e-primary-track');
  await page.getByRole('button', { name: /الرياضيات - اختبار/ }).click();
  const contentTitle = 'درس أستاذ اختبار منشور ' + suffix(test.info().project.name);
  await expect(page.getByText(contentTitle, { exact: true })).toHaveCount(0);
});

test('teacher can submit a published-curriculum application and admin approval grants verified claims', async ({ page, browser }) => {
  const project = test.info().project.name;
  const fixture = test.info().retry > 0 ? `${suffix(project)}-retry${test.info().retry}` : suffix(project);
  const applicantUid = 'imi-e2e-submit-' + fixture;
  const applicantEmail = `e2e-submit-${fixture}@imi.test`;
  const fullName = 'أستاذ متقدم لاختبار ' + fixture;
  const proofUrl = 'https://example.com/imi-teacher-proof-' + fixture;

  try {
    await adminAuth.getUser(applicantUid);
  } catch {
    await adminAuth.createUser({
      uid: applicantUid, email: applicantEmail, password, emailVerified: true,
    });
  }
  await adminAuth.setCustomUserClaims(applicantUid, {});

  await login(page, applicantEmail);
  await page.goto('/teacher/apply');
  await expect(page.getByRole('heading', { name: 'طلب الانضمام كأستاذ' })).toBeVisible();
  await expect(page.getByLabel('المستوى الدراسي المنشور')).toBeEnabled();
  await page.getByLabel('المستوى الدراسي المنشور').selectOption('e2e-primary');
  await page.getByLabel('الرياضيات - اختبار').check();
  await page.getByLabel('الاسم الكامل').fill(fullName);
  await page.getByLabel('رابط إثبات الخبرة (HTTPS)').fill('http://example.com/not-secure');
  await page.getByRole('button', { name: 'إرسال طلب الانضمام' }).click();
  await expect(page.getByRole('alert')).toContainText('يبدأ بـ https://');
  await expect(adminDb.doc('teacherApplications/' + applicantUid).get()).resolves.toMatchObject({ exists: false });

  await page.getByLabel('رابط إثبات الخبرة (HTTPS)').fill(proofUrl);
  await page.getByRole('button', { name: 'إرسال طلب الانضمام' }).click();
  await expect(page.getByRole('status')).toContainText('تم إرسال طلبك بنجاح');

  const submitted = await adminDb.doc('teacherApplications/' + applicantUid).get();
  expect(submitted.exists).toBe(true);
  expect(submitted.get('status')).toBe('pending');
  expect(submitted.get('fullName')).toBe(fullName);
  expect(submitted.get('proofUrl')).toBe(proofUrl);
  expect(submitted.get('levelIds')).toEqual(['e2e-primary']);
  expect(submitted.get('subjectIds')).toEqual(['e2e-primary-math']);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await login(adminPage, email('admin', project));
    await adminPage.getByRole('button', { name: /إدارة الأكاديمية/ }).first().click();
    const approve = adminPage.getByTestId('approve-' + applicantUid);
    await expect(approve).toBeVisible();
    await approve.click();
    await expect(adminPage.getByRole('status')).toContainText('تم اعتماد الطلب ومنح صلاحية الأستاذ الموثق');

    const approved = await adminDb.doc('teacherApplications/' + applicantUid).get();
    expect(approved.get('status')).toBe('approved');
    const user = await adminAuth.getUser(applicantUid);
    expect(user.customClaims).toMatchObject({ teacher: true, teacherVerified: true });
    const audit = await adminDb.collection('moderationAudit').get();
    expect(audit.docs.some(doc => JSON.stringify(doc.data()).includes(applicantUid))).toBe(true);
  } finally {
    await adminContext.close();
  }
});

test('guest sessions can be linked to a permanent email account without changing UID', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /الدخول السريع كضيف/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: /ملفي/ }).first().click();
  await expect(page.getByText('تحويل حساب الضيف إلى حساب دائم')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ربط البريد بالحساب الحالي' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حذف الحساب غير متاح حالياً' })).toBeDisabled();
});

test('login supports email and guest sessions without phone OTP', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByRole('button', { name: /الدخول السريع كضيف/ })).toBeVisible();
  await expect(page.getByLabel('رقم الهاتف')).toHaveCount(0);
  await expect(page.getByText('الدخول برقم الهاتف (OTP)')).toHaveCount(0);
});

test('privacy and terms remain visibly marked as drafts', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText(/مسودة ما قبل الإطلاق/)).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByText(/مسودة ما قبل الإطلاق/)).toBeVisible();
});

test('mobile academy keeps RTL direction without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/academy');
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'ابدأ من مستواك، وتقدّم خطوة بخطوة' })).toBeVisible();
  const width = await page.locator('body').evaluate(element => element.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
