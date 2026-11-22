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
  await auth.setCustomUserClaims(uid, admin ? { admin: true } : role === 'c' ? { teacher: true, teacherVerified: true } : {});
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
  for (const variant of ['desktop', 'mobile', 'desktop-retry1', 'mobile-retry1']) {
    await ensureUser('a', variant, 'تلميذ ألف ' + variant);
    await ensureUser('b', variant, 'تلميذ باء ' + variant);
    await ensureUser('c', variant, 'أستاذ اختبار موثّق ' + variant);
    await ensureUser('d', variant, 'تلميذ دال ' + variant);
    await ensureUser('e', variant, 'تلميذ هاء ' + variant);
    await ensureUser('f', variant, 'تلميذ فاء ' + variant);
    // Dedicated group-route fixtures are isolated from academy tests that may approve teacher claims.
    await ensureUser('g', variant, 'منشئ مجموعة اختبار ' + variant);
    await ensureUser('h', variant, 'عضو مجموعة اختبار أول ' + variant);
    await ensureUser('i', variant, 'عضو مجموعة اختبار ثان ' + variant);
    await ensureUser('j', variant, 'عضو مجموعة اختبار إضافي ' + variant);
    await ensureUser('admin', variant, 'مشرف اختبار ' + variant, true);
  }

  for (const variant of ['desktop', 'mobile', 'desktop-retry1', 'mobile-retry1']) {
    const a = 'imi-e2e-a-' + variant;
    const b = 'imi-e2e-b-' + variant;
    // Keep the friendship E2E deterministic even when an emulator is reused.
    await Promise.all([
      db.doc('users/' + a + '/friends/' + b).delete(),
      db.doc('users/' + b + '/friends/' + a).delete(),
    ]);
    const outgoing = await db.collection('friendRequests').where('fromUid', '==', a).get();
    const incoming = await db.collection('friendRequests').where('toUid', '==', a).get();
    const staleRequests = [
      ...outgoing.docs.filter(item => item.get('toUid') === b),
      ...incoming.docs.filter(item => item.get('fromUid') === b),
    ];
    await Promise.all(staleRequests.map(item => item.ref.delete()));
    // Seed request documents through Admin SDK in the isolated Emulator; client REST writes are correctly blocked by Firestore rules.
    await Promise.all([
      db.doc('friendRequests/' + encodeURIComponent(a) + '__' + encodeURIComponent(b)).set({ fromUid: a, toUid: b, status: 'pending', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
      db.doc('friendRequests/' + encodeURIComponent('imi-e2e-d-' + variant) + '__' + encodeURIComponent(b)).set({ fromUid: 'imi-e2e-d-' + variant, toUid: b, status: 'pending', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
    ]);
    for (const other of ['c', 'd', 'e']) {
      const b = 'imi-e2e-' + other + '-' + variant;
      await db.doc('users/' + a + '/friends/' + b).set({ uid: b, status: 'accepted', createdAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.doc('users/' + b + '/friends/' + a).set({ uid: a, status: 'accepted', createdAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.doc('publicProfiles/' + a).set({ uid: a, displayName: 'تلميذ ألف ' + variant, city: 'الدار البيضاء', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.doc('publicProfiles/' + b).set({ uid: b, displayName: other === 'c' ? 'أستاذ اختبار موثّق ' + variant : other === 'd' ? 'تلميذ دال ' + variant : other === 'e' ? 'تلميذ هاء ' + variant : 'تلميذ فاء ' + variant, city: 'الدار البيضاء', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }

  for (const variant of ['desktop', 'mobile', 'desktop-retry1', 'mobile-retry1']) {
    const owner = 'imi-e2e-g-' + variant;
    for (const member of ['h', 'i', 'j']) {
      const memberUid = 'imi-e2e-' + member + '-' + variant;
      await db.doc('users/' + owner + '/friends/' + memberUid).set({ uid: memberUid, status: 'accepted', createdAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.doc('users/' + memberUid + '/friends/' + owner).set({ uid: owner, status: 'accepted', createdAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }

  const curriculumNodes = [
    { id: 'e2e-primary', parentId: null, type: 'level', nameAr: 'التعليم الابتدائي - اختبار', nameFr: 'Primaire - test', language: 'ar', order: 1 },
    { id: 'e2e-primary-track', parentId: 'e2e-primary', type: 'track', nameAr: 'المسار العام - اختبار', nameFr: 'Tronc commun - test', language: 'ar', order: 1 },
    { id: 'e2e-primary-math', parentId: 'e2e-primary-track', type: 'subject', nameAr: 'الرياضيات - اختبار', nameFr: 'Mathématiques - test', language: 'ar', order: 1 },
    { id: 'e2e-primary-empty-subject', parentId: 'e2e-primary-track', type: 'subject', nameAr: 'مادة بلا دروس - اختبار', nameFr: 'Matière vide - test', language: 'ar', order: 2 },
  ];
  for (const node of curriculumNodes) {
    await db.doc(`curriculumNodes/${node.id}`).set({
      ...node, needsReview: false, semester: null, officialSource: null,
      status: 'published', createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await db.doc('curriculumNodes/e2e-unpublished-subject').set({
    id: 'e2e-unpublished-subject', parentId: 'e2e-primary-track', type: 'subject',
    nameAr: 'مادة غير منشورة - اختبار', nameFr: '', language: 'ar', order: 99,
    needsReview: true, status: 'hidden', createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Isolated admin curriculum publishing fixtures: 404 publishable nodes,
  // one nameless node that must remain hidden, and a nested level with a hidden parent.
  for (const variant of ['desktop', 'mobile', 'desktop-retry1', 'mobile-retry1']) {
    const rootId = 'e2e-publish-level-' + variant;
    const trackId = rootId + '-track';
    const subjectId = rootId + '-subject';
    const base = { needsReview: true, status: 'hidden', language: 'ar', order: 1,
      semester: null, officialSource: null, createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp() };
    await db.doc('curriculumNodes/' + rootId).set({
      ...base, id: rootId, parentId: null, type: 'level', nameAr: 'مستوى اختبار النشر ' + variant, nameFr: '',
    });
    await db.doc('curriculumNodes/' + trackId).set({
      ...base, id: trackId, parentId: rootId, type: 'track', nameAr: 'مسلك اختبار ' + variant, nameFr: '',
    });
    await db.doc('curriculumNodes/' + subjectId).set({
      ...base, id: subjectId, parentId: trackId, type: 'subject', nameAr: 'مادة اختبار ' + variant, nameFr: '',
    });
    const batchDocs = [];
    for (let index = 0; index < 401; index += 1) {
      const id = subjectId + '-unit-' + index;
      batchDocs.push(db.doc('curriculumNodes/' + id).set({
        ...base, id, parentId: subjectId, type: 'unit', nameAr: 'وحدة اختبار ' + index, nameFr: '',
      }));
    }
    const namelessId = subjectId + '-nameless';
    batchDocs.push(db.doc('curriculumNodes/' + namelessId).set({
      ...base, id: namelessId, parentId: subjectId, type: 'unit', nameFr: '',
    }));
    await Promise.all(batchDocs);

    const hiddenParentId = 'e2e-publish-parent-' + variant;
    const nestedLevelId = 'e2e-publish-nested-level-' + variant;
    await db.doc('curriculumNodes/' + hiddenParentId).set({
      ...base, id: hiddenParentId, parentId: null, type: 'level', nameAr: 'أب مخفي ' + variant, nameFr: '',
    });
    await db.doc('curriculumNodes/' + nestedLevelId).set({
      ...base, id: nestedLevelId, parentId: hiddenParentId, type: 'level', nameAr: 'مستوى ابن ' + variant, nameFr: '',
    });
  }

  for (const variant of ['desktop', 'mobile', 'desktop-retry1', 'mobile-retry1']) {
    const teacherUid = 'imi-e2e-a-' + variant;
    await db.doc('teacherApplications/' + teacherUid).set({
      uid: teacherUid, fullName: 'أستاذ اختبار آلي ' + variant,
      subjectIds: ['e2e-primary-math'], levelIds: ['e2e-primary'],
      proofUrl: 'https://drive.google.com/file/d/imi-e2e-fixture/view',
      status: 'pending', submittedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const contentId = 'e2e-teacher-draft-' + variant;
    await db.doc('teacherContent/' + contentId).set({
      id: contentId, ownerUid: 'imi-e2e-b-' + variant,
      title: 'درس أستاذ اختبار منشور ' + variant, body: 'هذا نص تجريبي طويل بما يكفي لاختبار مراجعة المحتوى ونشره داخل مادة الرياضيات في بيئة المحاكي فقط.',
      kind: 'text', levelId: 'e2e-primary', trackId: 'e2e-primary-track',
      subjectId: 'e2e-primary-math', unitId: null,
      curriculumNodeIds: ['e2e-primary', 'e2e-primary-track', 'e2e-primary-math'],
      sourceType: 'original', sourceName: 'IMI E2E fixture', sourceUrl: null,
      license: 'Test-only original fixture', permissionNote: 'بيانات اختبار محلية فقط.',
      reviewTier: 'light', reviewStatus: 'pending', needsHumanReview: true,
      status: 'draft', published: false, createdAt: FieldValue.serverTimestamp(),
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
