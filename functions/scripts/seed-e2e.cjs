const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || 'demo-imi-playwright';
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to seed: Auth and Firestore Emulator hosts are required.');
}
if (!projectId.startsWith('demo-')) {
  throw new Error('Refusing to seed a non-demo Firebase project.');
}

if (!getApps().length) initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

async function ensureUser(role, variant, displayName, admin = false) {
  const uid = `imi-e2e-${role}-${variant}`;
  const email = `e2e-${role}-${variant}@imi.test`;
  let user;
  try {
    user = await auth.getUser(uid);
  } catch {
    user = await auth.createUser({
      uid,
      email,
      password: 'IMI-Emulator-Password-2026!',
      emailVerified: true,
      displayName,
    });
  }
  await auth.setCustomUserClaims(uid, admin ? { admin: true } : {});
  await db.doc(`users/${uid}`).set({
    uid,
    displayName,
    city: 'الدار البيضاء',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.doc(`publicProfiles/${uid}`).set({
    uid,
    displayName,
    city: 'الدار البيضاء',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return user;
}

async function main() {
  for (const variant of ['desktop', 'mobile']) {
    await ensureUser('a', variant, 'تلميذ ألف');
    await ensureUser('b', variant, 'تلميذ باء');
    await ensureUser('admin', variant, 'مشرف اختبار', true);
  }

  const curriculumNodes = [
    { id: 'e2e-primary', parentId: null, type: 'level', nameAr: 'التعليم الابتدائي - اختبار', nameFr: 'Primaire - test', language: 'ar', order: 1 },
    { id: 'e2e-primary-track', parentId: 'e2e-primary', type: 'track', nameAr: 'المسار العام - اختبار', nameFr: 'Tronc commun - test', language: 'ar', order: 1 },
    { id: 'e2e-primary-math', parentId: 'e2e-primary-track', type: 'subject', nameAr: 'الرياضيات - اختبار', nameFr: 'Mathématiques - test', language: 'ar', order: 1 },
  ];
  for (const node of curriculumNodes) {
    await db.doc(`curriculumNodes/${node.id}`).set({
      ...node, needsReview: true, semester: null, officialSource: null,
      status: 'published', createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const course = db.doc('courses/e2e-general-skills');
  await course.set({
    title: 'مهارة التعلم الذاتي',
    description: 'محتوى اختبار محلي على Firebase Emulator فقط.',
    category: 'مهارات عامة',
    published: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: 'e2e-seed',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await course.collection('lessons').doc('e2e-study-habit').set({
    title: 'خطوات عملية لبناء عادة تعلم مستمرة',
    content: 'حدّد هدفاً صغيراً، وقسّمه إلى جلسات قصيرة، ثم راجع ما تعلمته بانتظام.',
    order: 1,
    published: true,
    sourceType: 'original',
    sourceName: 'IMI Emulator Test Fixture',
    license: 'Test-only original fixture',
    permissionNote: 'بيانات اختبار محلية لا تُنشر على الإنتاج.',
    addedBy: 'e2e-seed',
    reviewedBy: 'e2e-seed',
    reviewedAt: FieldValue.serverTimestamp(),
    reviewStatus: 'approved',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  process.stdout.write('Seeded isolated demo users, admin claim and general-skills lesson in Firebase Emulator.\n');
}

main().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
