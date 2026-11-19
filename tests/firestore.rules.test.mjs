import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-imi-security',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') }
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/alice'), { privateEmail: 'alice@example.invalid' });
    await setDoc(doc(db, 'users/bob'), { privateEmail: 'bob@example.invalid' });
    await setDoc(doc(db, 'publicProfiles/alice'), { uid: 'alice', displayName: 'Alice' });
    await setDoc(doc(db, 'publicProfiles/bob'), { uid: 'bob', displayName: 'Bob' });
    await setDoc(doc(db, 'publicProfiles/mallory'), { uid: 'mallory', displayName: 'Mallory' });
    await setDoc(doc(db, 'users/alice/friends/bob'), { uid: 'bob', status: 'accepted' });
    await setDoc(doc(db, 'users/bob/friends/alice'), { uid: 'alice', status: 'accepted' });
    await setDoc(doc(db, 'friendRequests/alice__bob'), { fromUid: 'alice', toUid: 'bob', status: 'pending' });
    await setDoc(doc(db, 'courses/math-basics'), { title: 'أساسيات الرياضيات', description: 'دورة اختبار', category: 'رياضيات', published: true });
    await setDoc(doc(db, 'courses/math-basics/lessons/lesson-1'), { title: 'الأعداد', content: 'محتوى اختبار', published: true });
    await setDoc(doc(db, 'courses/draft-course'), { title: 'مسودة', published: false });
    await setDoc(doc(db, 'users/alice/enrollments/math-basics'), { courseId: 'math-basics', completedLessonIds: [] });
    await setDoc(doc(db, 'calls/call-1'), { callerUid: 'alice', calleeUid: 'bob', conversationId: 'chat-1', kind: 'video', status: 'ringing', offerRevision: 0, answerRevision: -1, iceRestartCount: 0, createdAt: new Date(), expiresAt: Timestamp.fromDate(new Date(Date.now() + 60000)) });
    await setDoc(doc(db, 'conversations/chat-1'), {
      participants: ['alice', 'bob'],
      createdBy: 'alice',
      createdAt: new Date()
    });
    await setDoc(doc(db, 'conversations/chat-1/messages/receipt-target'), {
      senderUid: 'bob',
      type: 'text',
      text: 'رسالة اختبار موجودة',
      createdAt: new Date()
    });
    await setDoc(doc(db, 'conversations/chat-1/messages/own-message'), {
      senderUid: 'alice',
      type: 'text',
      text: 'رسالة أرسلها صاحب الإيصال',
      createdAt: new Date()
    });
  });
});

after(async () => {
  await env?.cleanup();
});


test('FCM registration tokens are private and owner-managed', async () => {
  const token = 'fcm-token-abcdefghijklmnopqrstuvwxyz0123456789';
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const tokenRef = doc(aliceDb, 'users/alice/fcmTokens', token);
  await assertSucceeds(setDoc(tokenRef, {
    token, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(tokenRef));
  await assertFails(getDoc(doc(bobDb, 'users/alice/fcmTokens', token)));
  await assertFails(setDoc(doc(aliceDb, 'users/alice/fcmTokens/forged-token-abcdefghijklmnopqrstuvwxyz'), {
    token: 'different-token-abcdefghijklmnopqrstuvwxyz', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(tokenRef, {
    token: 'forged-token-abcdefghijklmnopqrstuvwxyz'
  }));
  await assertSucceeds((await import('firebase/firestore')).updateDoc(tokenRef, {
    updatedAt: serverTimestamp()
  }));
});

test('notifications are server-created, private to their owner, and clients may only mark them read', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/alice/notifications/chat-1_msg-1'), {
      type: 'message', senderUid: 'bob', conversationId: 'chat-1',
      messageId: 'msg-1', preview: 'مرحبا', createdAt: serverTimestamp(), readAt: null
    });
  });
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const aliceNotification = doc(aliceDb, 'users/alice/notifications/chat-1_msg-1');
  await assertSucceeds(getDoc(aliceNotification));
  await assertFails(getDoc(doc(bobDb, 'users/alice/notifications/chat-1_msg-1')));
  await assertFails(setDoc(doc(aliceDb, 'users/alice/notifications/forged'), {
    type: 'message', senderUid: 'alice', preview: 'مزيف', readAt: null
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(aliceNotification, {
    preview: 'تعديل محتوى الإشعار'
  }));
  await assertSucceeds((await import('firebase/firestore')).updateDoc(aliceNotification, {
    readAt: serverTimestamp()
  }));
});

test('friend requests are visible only to their sender and recipient and clients cannot forge them', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const malloryDb = env.authenticatedContext('mallory').firestore();
  await assertSucceeds(getDoc(doc(aliceDb, 'friendRequests/alice__bob')));
  await assertSucceeds(getDoc(doc(bobDb, 'friendRequests/alice__bob')));
  await assertFails(getDoc(doc(malloryDb, 'friendRequests/alice__bob')));
  await assertFails(setDoc(doc(aliceDb, 'friendRequests/forged'), {
    fromUid: 'alice', toUid: 'mallory', status: 'accepted'
  }));
});

test('status documents are readable only by the owner and a reciprocal accepted friend', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice/statuses/friend-visible'), {
      ownerUid: 'alice',
      text: 'حالة مرئية للصديق',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000))
    });
    await setDoc(doc(context.firestore(), 'users/alice/friends/mallory'), { status: 'accepted' });
  });
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const malloryDb = env.authenticatedContext('mallory').firestore();
  const statusPath = 'users/alice/statuses/friend-visible';
  await assertSucceeds(getDoc(doc(aliceDb, statusPath)));
  await assertSucceeds(getDoc(doc(bobDb, statusPath)));
  await assertFails(getDoc(doc(malloryDb, statusPath)));
});


test('content reports and moderation logs are admin-readable but never client-writable', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'contentReports/report-1'), {
      reporterUid: 'alice', targetType: 'academyLesson', courseId: 'math-basics',
      lessonId: 'lesson-1', reason: 'incorrect', details: 'اختبار', status: 'open', createdAt: new Date()
    });
    await setDoc(doc(db, 'moderationLogs/log-1'), {
      actorUid: 'admin', action: 'report_resolved', reportId: 'report-1', createdAt: new Date()
    });
  });
  const aliceDb = env.authenticatedContext('alice').firestore();
  const adminDb = env.authenticatedContext('admin', { admin: true }).firestore();
  await assertFails(getDoc(doc(aliceDb, 'contentReports/report-1')));
  await assertSucceeds(getDoc(doc(adminDb, 'contentReports/report-1')));
  await assertFails(setDoc(doc(aliceDb, 'contentReports/forged'), { reporterUid: 'alice', status: 'open' }));
  await assertFails(setDoc(doc(adminDb, 'contentReports/admin-forged'), { reporterUid: 'admin', status: 'open' }));
  await assertFails(deleteDoc(doc(adminDb, 'contentReports/report-1')));
  await assertFails(getDoc(doc(aliceDb, 'moderationLogs/log-1')));
  await assertSucceeds(getDoc(doc(adminDb, 'moderationLogs/log-1')));
  await assertFails(setDoc(doc(adminDb, 'moderationLogs/forged'), { actorUid: 'admin' }));
  await assertFails(getDoc(doc(aliceDb, 'reportRateLimits/alice')));
});

test('curriculum nodes expose published structure only and block client self-promotion', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'curriculumNodes/primary'), {
      id: 'primary', parentId: null, type: 'level', nameAr: 'التعليم الابتدائي',
      nameFr: 'Enseignement primaire', language: 'ar', order: 1,
      semester: null, officialSource: 'https://pw.men.gov.ma/', needsReview: false,
      status: 'published', createdAt: new Date(), updatedAt: new Date()
    });
    await setDoc(doc(db, 'curriculumNodes/hidden-unit'), {
      id: 'hidden-unit', parentId: 'primary', type: 'unit', nameAr: 'محاور قيد التوثيق',
      nameFr: 'Axes à documenter', language: 'unknown', order: 1,
      semester: null, officialSource: null, needsReview: true,
      status: 'hidden', createdAt: new Date(), updatedAt: new Date()
    })
    await setDoc(doc(db, 'curriculumNodes/unreviewed-published'), {
      id: 'unreviewed-published', parentId: 'primary', type: 'subject', nameAr: 'مادة غير مراجعة',
      nameFr: 'Matière non révisée', language: 'ar', order: 2,
      semester: null, officialSource: null, needsReview: true,
      status: 'published', createdAt: new Date(), updatedAt: new Date()
    });;
  });
  const guestDb = env.unauthenticatedContext().firestore();
  const aliceDb = env.authenticatedContext('alice').firestore();
  const adminDb = env.authenticatedContext('admin', { admin: true }).firestore();
  await assertSucceeds(getDoc(doc(guestDb, 'curriculumNodes/primary')));
  await assertFails(getDoc(doc(guestDb, 'curriculumNodes/hidden-unit')));
  await assertFails(getDoc(doc(guestDb, 'curriculumNodes/unreviewed-published')));
  await assertSucceeds(getDoc(doc(adminDb, 'curriculumNodes/unreviewed-published')));
  await assertSucceeds(getDoc(doc(adminDb, 'curriculumNodes/hidden-unit')));
  await assertFails(setDoc(doc(aliceDb, 'curriculumNodes/forged'), {
    id: 'forged', parentId: null, type: 'level', nameAr: 'مزيف', nameFr: 'Fake',
    language: 'ar', order: 1, semester: null, officialSource: null,
    needsReview: false, status: 'published', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(doc(aliceDb, 'curriculumNodes/hidden-unit'), {
    status: 'published', updatedAt: serverTimestamp()
  }));
  await assertSucceeds((await import('firebase/firestore')).updateDoc(doc(adminDb, 'curriculumNodes/hidden-unit'), {
    status: 'published', updatedAt: serverTimestamp()
  }));
});

test('learners can read published Academy content but cannot publish or modify it', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(aliceDb, 'courses/math-basics')));
  await assertSucceeds(getDoc(doc(bobDb, 'courses/math-basics/lessons/lesson-1')));
  await assertFails(getDoc(doc(aliceDb, 'courses/draft-course')));
  await assertFails(getDoc(doc(aliceDb, 'courses/math-basics/lessons/not-published')));
  await assertFails(setDoc(doc(aliceDb, 'courses/fake-course'), { title: 'مزيف', published: true }));
  await assertFails(setDoc(doc(aliceDb, 'courses/math-basics/lessons/lesson-2'), { title: 'درس مزيف', published: true }));
});

test('published Academy content is readable without an account while drafts stay private', async () => {
  const guestDb = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(guestDb, 'courses/math-basics')));
  await assertSucceeds(getDoc(doc(guestDb, 'courses/math-basics/lessons/lesson-1')));
  await assertFails(getDoc(doc(guestDb, 'courses/draft-course')));
  await assertFails(getDoc(doc(guestDb, 'courses/draft-course/lessons/lesson-1')));
});

test('only verified Academy admins can read draft content; client writes remain denied', async () => {
  const learnerDb = env.authenticatedContext('learner').firestore();
  const adminDb = env.authenticatedContext('academy-admin', { admin: true }).firestore();
  await assertFails(getDoc(doc(learnerDb, 'courses/draft-course')));
  await assertSucceeds(getDoc(doc(adminDb, 'courses/draft-course')));
  await assertSucceeds(getDoc(doc(adminDb, 'courses/math-basics/lessons/lesson-1')));
  await assertFails(setDoc(doc(adminDb, 'courses/admin-forged-course'), {
    title: 'كتابة من العميل', published: true
  }));
  await assertFails(setDoc(doc(adminDb, 'courses/draft-course/lessons/admin-forged-lesson'), {
    title: 'درس مزيف', published: true
  }));
});

test('enrollment and lesson progress are private and server-write-only', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/enrollments/math-basics')));
  await assertFails(getDoc(doc(bobDb, 'users/alice/enrollments/math-basics')));
  await assertFails(setDoc(doc(aliceDb, 'users/alice/enrollments/forged-course'), {
    courseId: 'forged-course', completedLessonIds: ['lesson-1']
  }));
});

test('unauthenticated clients cannot read private user documents', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'users/alice')));
});

test('a user can read their own private document but another user cannot', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(aliceDb, 'users/alice')));
  await assertFails(getDoc(doc(bobDb, 'users/alice')));
});

test('conversation creation is limited to two distinct existing profiles', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const base = {
    createdBy: 'alice',
    participants: ['alice', 'bob'],
    createdAt: serverTimestamp(),
    lastMessage: '',
    lastMessageAt: serverTimestamp()
  };
  await assertSucceeds(setDoc(doc(aliceDb, 'conversations/direct-created'), base));
  await assertFails(setDoc(doc(aliceDb, 'conversations/group-injection'), {
    ...base,
    participants: ['alice', 'bob', 'mallory']
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/duplicate-self'), {
    ...base,
    participants: ['alice', 'alice']
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/unknown-profile'), {
    ...base,
    participants: ['alice', 'unknown-user']
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/forged-preview'), {
    ...base,
    lastMessage: 'رسالة مزيفة لم تُرسل'
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/forged-sender'), {
    ...base,
    lastSenderUid: 'bob'
  }));
});


test('conversation preview updates must reference a message created in the same batch by the sender', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const conversation = doc(aliceDb, 'conversations/chat-1');
  const message = doc(aliceDb, 'conversations/chat-1/messages/preview-batch-message');
  const { writeBatch } = await import('firebase/firestore');

  const validBatch = writeBatch(aliceDb);
  validBatch.set(message, {
    senderUid: 'alice', type: 'text', text: 'رسالة أصلية', createdAt: serverTimestamp()
  });
  validBatch.update(conversation, {
    lastMessage: 'رسالة أصلية', lastMessageAt: serverTimestamp(),
    lastSenderUid: 'alice', lastMessageId: message.id
  });
  await assertSucceeds(validBatch.commit());

  const forgedBatch = writeBatch(aliceDb);
  forgedBatch.update(conversation, {
    lastMessage: 'معاينة مزيفة', lastMessageAt: serverTimestamp(),
    lastSenderUid: 'alice', lastMessageId: 'not-created'
  });
  await assertFails(forgedBatch.commit());

  const mismatchBatch = writeBatch(aliceDb);
  const mismatchMessage = doc(aliceDb, 'conversations/chat-1/messages/preview-mismatch');
  mismatchBatch.set(mismatchMessage, {
    senderUid: 'alice', type: 'text', text: 'النص الحقيقي', createdAt: serverTimestamp()
  });
  mismatchBatch.update(conversation, {
    lastMessage: 'نص مختلف مزيف', lastMessageAt: serverTimestamp(),
    lastSenderUid: 'alice', lastMessageId: mismatchMessage.id
  });
  await assertFails(mismatchBatch.commit());
});

test('media message previews must match the real image, audio, or video message', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const conversation = doc(aliceDb, 'conversations/chat-1');
  const { writeBatch, collection } = await import('firebase/firestore');
  const cases = [
    { type: 'image', contentType: 'image/png', fileName: 'photo.png', label: '📷 صورة' },
    { type: 'audio', contentType: 'audio/webm', fileName: 'voice.webm', label: '🎤 رسالة صوتية' },
    { type: 'video', contentType: 'video/mp4', fileName: 'clip.mp4', label: '🎬 فيديو' }
  ];

  for (const item of cases) {
    const message = doc(collection(conversation, 'messages'), `preview-${item.type}`);
    const batch = writeBatch(aliceDb);
    batch.set(message, {
      senderUid: 'alice',
      type: item.type,
      mediaPath: `conversations/chat-1/alice/${message.id}/${item.fileName}`,
      contentType: item.contentType,
      fileName: item.fileName,
      createdAt: serverTimestamp()
    });
    batch.update(conversation, {
      lastMessage: item.label,
      lastMessageAt: serverTimestamp(),
      lastSenderUid: 'alice',
      lastMessageId: message.id
    });
    await assertSucceeds(batch.commit());
  }

  const captionedMessage = doc(collection(conversation, 'messages'), 'preview-captioned-image');
  const captionedBatch = writeBatch(aliceDb);
  captionedBatch.set(captionedMessage, {
    senderUid: 'alice',
    type: 'image',
    text: 'صورة من الرحلة',
    mediaPath: `conversations/chat-1/alice/${captionedMessage.id}/photo.png`,
    contentType: 'image/png',
    fileName: 'photo.png',
    createdAt: serverTimestamp()
  });
  captionedBatch.update(conversation, {
    lastMessage: 'صورة من الرحلة',
    lastMessageAt: serverTimestamp(),
    lastSenderUid: 'alice',
    lastMessageId: captionedMessage.id
  });
  await assertSucceeds(captionedBatch.commit());

  const forgedMessage = doc(collection(conversation, 'messages'), 'preview-forged-image');
  const forgedBatch = writeBatch(aliceDb);
  forgedBatch.set(forgedMessage, {
    senderUid: 'alice',
    type: 'image',
    mediaPath: `conversations/chat-1/alice/${forgedMessage.id}/photo.png`,
    contentType: 'image/png',
    fileName: 'photo.png',
    createdAt: serverTimestamp()
  });
  forgedBatch.update(conversation, {
    lastMessage: 'معاينة غير صحيحة',
    lastMessageAt: serverTimestamp(),
    lastSenderUid: 'alice',
    lastMessageId: forgedMessage.id
  });
  await assertFails(forgedBatch.commit());
});

test('conversation presence is visible only to members and each user owns their heartbeat', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const malloryDb = env.authenticatedContext('mallory').firestore();
  const alicePresence = doc(aliceDb, 'conversations/chat-1/presence/alice');
  await assertSucceeds(setDoc(alicePresence, {
    uid: 'alice', isOnline: true, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(alicePresence));
  await assertSucceeds(getDoc(doc(bobDb, 'conversations/chat-1/presence/alice')));
  await assertFails(getDoc(doc(malloryDb, 'conversations/chat-1/presence/alice')));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/presence/bob'), {
    uid: 'bob', isOnline: true, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'conversations/chat-1/presence/alice'), {
      uid: 'alice', isOnline: true,
      lastSeenAt: Timestamp.fromDate(new Date(Date.now() - 60_000)),
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 60_000))
    });
  });
  await assertSucceeds((await import('firebase/firestore')).updateDoc(alicePresence, {
    isOnline: true, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
});

test('conversation read receipts and typing state are private to members and self-writable only', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const malloryDb = env.authenticatedContext('mallory').firestore();
  const aliceReceipt = doc(aliceDb, 'conversations/chat-1/readReceipts/alice');
  await assertSucceeds(setDoc(aliceReceipt, {
    uid: 'alice', lastReadAt: serverTimestamp(), lastReadMessageId: 'receipt-target'
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/readReceipts/alice'), {
    uid: 'alice', lastReadAt: serverTimestamp(), lastReadMessageId: 'missing-message'
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/readReceipts/bob'), {
    uid: 'bob', lastReadAt: serverTimestamp(), lastReadMessageId: 'receipt-target'
  }));
  await assertSucceeds(getDoc(aliceReceipt));
  await assertFails(getDoc(doc(malloryDb, 'conversations/chat-1/readReceipts/alice')));
  const aliceDelivery = doc(aliceDb, 'conversations/chat-1/deliveryReceipts/alice');
  await assertSucceeds(setDoc(aliceDelivery, {
    uid: 'alice', lastDeliveredAt: serverTimestamp(), lastDeliveredMessageId: 'receipt-target'
  }));
  await assertFails(setDoc(aliceDelivery, {
    uid: 'alice', lastDeliveredAt: serverTimestamp(), lastDeliveredMessageId: 'missing-message'
  }));
  await assertFails(setDoc(aliceDelivery, {
    uid: 'alice', lastDeliveredAt: serverTimestamp(), lastDeliveredMessageId: 'own-message'
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/deliveryReceipts/bob'), {
    uid: 'bob', lastDeliveredAt: serverTimestamp(), lastDeliveredMessageId: 'receipt-target'
  }));
  await assertFails(getDoc(doc(malloryDb, 'conversations/chat-1/deliveryReceipts/alice')));

  const aliceTyping = doc(aliceDb, 'conversations/chat-1/typing/alice');
  await assertSucceeds(setDoc(aliceTyping, {
    uid: 'alice', isTyping: true, updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/typing/bob'), {
    uid: 'bob', isTyping: true, updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(malloryDb, 'conversations/chat-1/typing/mallory'), {
    uid: 'mallory', isTyping: true, updatedAt: serverTimestamp()
  }));
  await new Promise(resolve => setTimeout(resolve, 1100));
  await assertSucceeds((await import('firebase/firestore')).updateDoc(aliceTyping, {
    isTyping: false, updatedAt: serverTimestamp()
  }));
});

test('only conversation participants can read a conversation', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const malloryDb = env.authenticatedContext('mallory').firestore();
  await assertSucceeds(getDoc(doc(aliceDb, 'conversations/chat-1')));
  await assertFails(getDoc(doc(malloryDb, 'conversations/chat-1')));
});

test('a participant can create a message only under their own UID', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(aliceDb, 'conversations/chat-1/messages/msg-1'), {
    senderUid: 'alice',
    type: 'text',
    text: 'مرحبا',
    createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(doc(aliceDb, 'conversations/chat-1/messages/image-1'), {
    senderUid: 'alice',
    type: 'image',
    mediaPath: 'conversations/chat-1/alice/image-1/photo.png',
    contentType: 'image/png',
    fileName: 'photo.png',
    createdAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/messages/foreign-path'), {
    senderUid: 'alice',
    type: 'image',
    mediaPath: 'conversations/chat-1/bob/foreign-path/photo.png',
    contentType: 'image/png',
    fileName: 'photo.png',
    createdAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/messages/invalid-type'), {
    senderUid: 'alice',
    type: 'image',
    mediaPath: 'conversations/chat-1/alice/invalid-type/file.exe',
    contentType: 'application/octet-stream',
    fileName: 'file.exe',
    createdAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/messages/msg-2'), {
    senderUid: 'bob',
    type: 'text',
    text: 'انتحال هوية',
    createdAt: serverTimestamp()
  }));
});

test('non-members cannot write messages into another conversation', async () => {
  const malloryDb = env.authenticatedContext('mallory').firestore();
  await assertFails(setDoc(doc(malloryDb, 'conversations/chat-1/messages/msg-3'), {
    senderUid: 'mallory',
    type: 'text',
    text: 'غير مصرح',
    createdAt: serverTimestamp()
  }));
});


test('block records are owner-readable, server-managed, and block direct conversations', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/carol/blockedUsers/dave'), { uid: 'dave', blockedAt: new Date() });
    await setDoc(doc(db, 'conversations/blocked-direct'), { participants: ['carol', 'dave'], createdBy: 'carol' });
    await setDoc(doc(db, 'conversations/blocked-group'), { type: 'group', participants: ['carol', 'dave', 'alice'], createdBy: 'carol' });
  });
  const carol = env.authenticatedContext('carol').firestore();
  const dave = env.authenticatedContext('dave').firestore();
  await assertSucceeds(getDoc(doc(carol, 'users/carol/blockedUsers/dave')));
  await assertFails(getDoc(doc(dave, 'users/carol/blockedUsers/dave')));
  await assertFails(setDoc(doc(carol, 'users/carol/blockedUsers/mallory'), { uid: 'mallory' }));
  await assertFails(getDoc(doc(carol, 'conversations/blocked-direct')));
  await assertFails(getDoc(doc(dave, 'conversations/blocked-direct')));
  await assertSucceeds(getDoc(doc(carol, 'conversations/blocked-group')));
  await assertSucceeds(getDoc(doc(dave, 'conversations/blocked-group')));
});

test('teacher applications and profiles are private and client writes cannot grant roles', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'teacherApplications/alice'), { uid: 'alice', status: 'pending', evidencePath: 'teacher-verification/alice/id.pdf' });
    await setDoc(doc(db, 'teacherProfiles/alice'), { uid: 'alice', published: true, profileComplete: true });
    await setDoc(doc(db, 'teacherProfiles/bob'), { uid: 'bob', published: false, profileComplete: false });
    await setDoc(doc(db, 'teacherLiveSessions/mock-room'), { teacherUid: 'alice', status: 'mock_scheduled' });
    await setDoc(doc(db, 'teacherLiveSessions/real-room'), { teacherUid: 'alice', status: 'scheduled' });
    await setDoc(doc(db, 'moderationAudit/audit-1'), { actorUid: 'admin', action: 'teacher_application_approved' });
  });
  const alice = env.authenticatedContext('alice').firestore();
  const mallory = env.authenticatedContext('mallory').firestore();
  const admin = env.authenticatedContext('admin', { admin: true }).firestore();
  const guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(alice, 'teacherApplications/alice')));
  await assertFails(getDoc(doc(mallory, 'teacherApplications/alice')));
  await assertSucceeds(getDoc(doc(admin, 'teacherApplications/alice')));
  await assertFails(setDoc(doc(alice, 'teacherApplications/alice'), { uid: 'alice', status: 'approved' }));
  await assertSucceeds(getDoc(doc(guest, 'teacherProfiles/alice')));
  await assertFails(getDoc(doc(mallory, 'teacherProfiles/bob')));
  await assertSucceeds(getDoc(doc(alice, 'teacherProfiles/bob')));
  await assertFails(setDoc(doc(alice, 'teacherProfiles/alice'), { published: true, verified: true }));
  await assertSucceeds(getDoc(doc(guest, 'teacherLiveSessions/real-room')));
  await assertFails(getDoc(doc(guest, 'teacherLiveSessions/mock-room')));
  await assertSucceeds(getDoc(doc(alice, 'teacherLiveSessions/mock-room')));
  await assertSucceeds(getDoc(doc(admin, 'moderationAudit/audit-1')));
  await assertFails(getDoc(doc(alice, 'moderationAudit/audit-1')));
});

test('teacher verification evidence is readable only by administrators', async () => {
  const path = 'teacher-verification/alice/identity.pdf';
  const applicant = env.authenticatedContext('alice').storage();
  const otherUser = env.authenticatedContext('bob').storage();
  const admin = env.authenticatedContext('admin', { admin: true }).storage();
  const content = new Blob(['%PDF-1.4 test evidence'], { type: 'application/pdf' });
  await assertSucceeds(uploadBytes(ref(applicant, path), content, { contentType: 'application/pdf' }));
  await assertFails(getBytes(ref(applicant, path)));
  await assertFails(getBytes(ref(otherUser, path)));
  await assertSucceeds(getBytes(ref(admin, path)));
});

test('blocked direct conversation media becomes unreadable to both participants', async () => {
  let mediaPath = 'conversations/blocked-media/carol/message-1/photo.png';
  await env.withSecurityRulesDisabled(async context => {
    await uploadBytes(ref(context.storage(), mediaPath), new Blob(['image-data'], { type: 'image/png' }));
    const db = context.firestore();
    await setDoc(doc(db, 'conversations/blocked-media'), { participants: ['carol', 'dave'] });
    await setDoc(doc(db, 'users/carol/blockedUsers/dave'), { uid: 'dave' });
  });
  const carol = env.authenticatedContext('carol').storage();
  const dave = env.authenticatedContext('dave').storage();
  await assertFails(getBytes(ref(carol, mediaPath)));
  await assertFails(getBytes(ref(dave, mediaPath)));
});

test('teacher content drafts stay private until server publication', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'teacherContent/draft-1'), { ownerUid: 'alice', title: 'مسودة', published: false, status: 'draft' });
    await setDoc(doc(db, 'teacherContent/published-1'), { ownerUid: 'alice', title: 'درس منشور', published: true, status: 'published' });
  });
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  const admin = env.authenticatedContext('admin', { admin: true }).firestore();
  const guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(alice, 'teacherContent/draft-1')));
  await assertFails(getDoc(doc(bob, 'teacherContent/draft-1')));
  await assertFails(getDoc(doc(guest, 'teacherContent/draft-1')));
  await assertSucceeds(getDoc(doc(guest, 'teacherContent/published-1')));
  await assertSucceeds(getDoc(doc(admin, 'teacherContent/draft-1')));
  await assertFails(setDoc(doc(alice, 'teacherContent/forged'), { ownerUid: 'alice', published: true }));
});

test('teacher media uploads require a complete verified profile and stay private until published', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'teacherProfiles/alice'), { uid: 'alice', profileComplete: true, published: true });
  });
  const teacher = env.authenticatedContext('alice', { teacherVerified: true }).storage();
  const unverified = env.authenticatedContext('bob').storage();
  const admin = env.authenticatedContext('admin', { admin: true }).storage();
  const guest = env.unauthenticatedContext().storage();
  const path = 'teacher-content/alice/draft-1/lesson.mp4';
  const file = ref(teacher, path);
  await assertSucceeds(uploadBytes(file, new Blob(['video-data'], { type: 'video/mp4' })));
  await assertSucceeds(getBytes(file));
  await assertFails(getBytes(ref(guest, path)));
  await assertSucceeds(getBytes(ref(admin, path)));
  await assertFails(uploadBytes(ref(unverified, 'teacher-content/bob/draft-2/lesson.mp4'), new Blob(['video-data'], { type: 'video/mp4' })));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'teacherContent/draft-1'), { ownerUid: 'alice', published: false });
  });
  await assertFails(getBytes(ref(guest, path)));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'teacherContent/draft-1'), { ownerUid: 'alice', published: true }, { merge: true });
  });
  await assertSucceeds(getBytes(ref(guest, path)));
});

test('teacher verification files are write-only for applicant and readable only by admin', async () => {
  const aliceStorage = env.authenticatedContext('alice').storage();
  const malloryStorage = env.authenticatedContext('mallory').storage();
  const adminStorage = env.authenticatedContext('admin', { admin: true }).storage();
  const evidence = ref(aliceStorage, 'teacher-verification/alice/identity.pdf');
  await assertSucceeds(uploadBytes(evidence, new Blob(['pdf-data'], { type: 'application/pdf' })));
  await assertFails(getBytes(evidence));
  await assertFails(getBytes(ref(malloryStorage, 'teacher-verification/alice/identity.pdf')));
  await assertSucceeds(getBytes(ref(adminStorage, 'teacher-verification/alice/identity.pdf')));
  await assertFails(uploadBytes(ref(malloryStorage, 'teacher-verification/alice/attack.pdf'), new Blob(['x'], { type: 'application/pdf' })));
  await assertFails(uploadBytes(ref(aliceStorage, 'teacher-verification/alice/large.exe'), new Blob(['x'], { type: 'application/octet-stream' })));
});

test('only verified teachers can upload avatars and published teacher avatars are public', async () => {
  const verifiedStorage = env.authenticatedContext('alice', { teacherVerified: true }).storage();
  const unverifiedStorage = env.authenticatedContext('bob').storage();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'teacherProfiles/alice'), { uid: 'alice', published: true });
  });
  const avatar = ref(verifiedStorage, 'teachers/alice/avatar/profile.png');
  await assertSucceeds(uploadBytes(avatar, new Blob(['png-data'], { type: 'image/png' })));
  await assertFails(uploadBytes(ref(unverifiedStorage, 'teachers/bob/avatar/profile.png'), new Blob(['png-data'], { type: 'image/png' })));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), 'teachers/alice/avatar/profile.png')));
});

test('users can upload only their own avatar files', async () => {
  const aliceStorage = env.authenticatedContext('alice').storage();
  const bobStorage = env.authenticatedContext('bob').storage();
  const aliceAvatar = ref(aliceStorage, 'users/alice/avatars/avatar.png');
  const foreignAvatar = ref(bobStorage, 'users/alice/avatars/attacker.png');
  await assertSucceeds(uploadBytes(aliceAvatar, new Blob(['png-data'], { type: 'image/png' })));
  await assertFails(uploadBytes(foreignAvatar, new Blob(['png-data'], { type: 'image/png' })));
});

test('only conversation members can upload conversation media', async () => {
  const aliceStorage = env.authenticatedContext('alice').storage();
  const malloryStorage = env.authenticatedContext('mallory').storage();
  const orphanRef = ref(aliceStorage, 'conversations/chat-1/alice/orphan-message/photo.png');
  await assertSucceeds(uploadBytes(orphanRef, new Blob(['png-data'], { type: 'image/png' })));
  await assertSucceeds(deleteObject(orphanRef));
  const referencedRef = ref(aliceStorage, 'conversations/chat-1/alice/message-1/photo.png');
  await assertSucceeds(uploadBytes(referencedRef, new Blob(['png-data'], { type: 'image/png' })));
  await assertSucceeds(setDoc(doc(env.authenticatedContext('alice').firestore(), 'conversations/chat-1/messages/message-1'), {
    senderUid: 'alice', type: 'image',
    mediaPath: 'conversations/chat-1/alice/message-1/photo.png',
    contentType: 'image/png', fileName: 'photo.png', createdAt: serverTimestamp()
  }));
  await assertFails(deleteObject(referencedRef));
  await assertSucceeds(uploadBytes(
    ref(aliceStorage, 'conversations/chat-1/alice/message-2/voice.webm'),
    new Blob(['audio-data'], { type: 'audio/webm' })
  ));
  await assertSucceeds(uploadBytes(
    ref(aliceStorage, 'conversations/chat-1/alice/message-3/clip.mp4'),
    new Blob(['video-data'], { type: 'video/mp4' })
  ));
  await assertFails(uploadBytes(
    ref(malloryStorage, 'conversations/chat-1/mallory/message-4/attack.png'),
    new Blob(['png-data'], { type: 'image/png' })
  ));
  await assertFails(uploadBytes(
    ref(aliceStorage, 'conversations/chat-1/bob/message-5/forged.png'),
    new Blob(['png-data'], { type: 'image/png' })
  ));
  await assertFails(uploadBytes(
    ref(aliceStorage, 'conversations/chat-1/alice/message-6/file.exe'),
    new Blob(['executable'], { type: 'application/octet-stream' })
  ));
});

test('Reels metadata is owner-created and immutable to clients', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const payload = {
    ownerUid: 'alice',
    caption: 'مقطع اختبار قواعد الأمان',
    videoUrl: 'https://example.invalid/reels/alice/test.mp4',
    storagePath: 'reels/alice/test.mp4',
    contentType: 'video/mp4',
    createdAt: serverTimestamp()
  };

  await assertSucceeds(setDoc(doc(aliceDb, 'reels/reel-1'), payload));
  await assertSucceeds(getDoc(doc(bobDb, 'reels/reel-1')));
  await assertFails(setDoc(doc(bobDb, 'reels/reel-2'), { ...payload, ownerUid: 'alice' }));
  await assertFails(setDoc(doc(aliceDb, 'reels/reel-3'), { ...payload, ownerUid: 'bob' }));
  await assertFails(setDoc(doc(aliceDb, 'reels/reel-1'), { ...payload, caption: 'تعديل غير مسموح' }));
});

test('Reels storage accepts owner video uploads and rejects foreign or non-video uploads', async () => {
  const aliceStorage = env.authenticatedContext('alice').storage();
  const bobStorage = env.authenticatedContext('bob').storage();
  const aliceVideo = ref(aliceStorage, 'reels/alice/test.mp4');

  await assertSucceeds(uploadBytes(
    aliceVideo,
    new Blob(['video-data'], { type: 'video/mp4' })
  ));
  await assertFails(uploadBytes(
    aliceVideo,
    new Blob(['replacement-video'], { type: 'video/mp4' })
  ));
  await assertSucceeds(getBytes(ref(bobStorage, 'reels/alice/test.mp4')));
  await assertFails(uploadBytes(
    ref(bobStorage, 'reels/alice/attacker.mp4'),
    new Blob(['video-data'], { type: 'video/mp4' })
  ));
  await assertFails(uploadBytes(
    ref(aliceStorage, 'reels/alice/not-a-video.jpg'),
    new Blob(['image-data'], { type: 'image/jpeg' })
  ));
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'reels/alice/test.mp4')));
});

test('clients cannot create statuses because trusted server time is required', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(aliceDb, 'users/alice/statuses/status-1'), {
    ownerUid: 'alice',
    text: 'حالة تجريبية للاختبار',
    mediaPath: 'users/alice/statuses/status-1/status.jpg',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 27 * 60 * 60 * 1000))
  }));
  await assertFails(setDoc(doc(aliceDb, 'users/alice/statuses/status-2'), {
    ownerUid: 'bob',
    text: 'محاولة نشر باسم مستخدم آخر',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 27 * 60 * 60 * 1000))
  }));
  await assertFails(setDoc(doc(aliceDb, 'users/alice/statuses/status-3'), {
    ownerUid: 'alice',
    mediaPath: 'users/bob/statuses/status-3/status.jpg',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 27 * 60 * 60 * 1000))
  }));
  await assertFails(setDoc(doc(aliceDb, 'users/alice/statuses/status-4'), {
    ownerUid: 'alice',
    text: 'انتهاء بعد أكثر من 28 ساعة',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 60 * 1000))
  }));
});

test('status media uploads require owner, are visible to accepted friends, and can be deleted by owner', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice/statuses/status-storage'), {
      ownerUid: 'alice',
      text: 'صورة الحالة',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 27 * 60 * 60 * 1000))
    });
  });
  const aliceStorage = env.authenticatedContext('alice').storage();
  const bobStorage = env.authenticatedContext('bob').storage();
  const path = 'users/alice/statuses/status-storage/status.jpg';
  const aliceFile = ref(aliceStorage, path);
  const bobFile = ref(bobStorage, path);
  await assertSucceeds(uploadBytes(aliceFile, new Blob(['image-data'], { type: 'image/jpeg' })));
  await assertFails(uploadBytes(aliceFile, new Blob(['replacement-image'], { type: 'image/jpeg' })));
  await assertSucceeds(getBytes(bobFile));
  await assertFails(uploadBytes(ref(bobStorage, 'users/alice/statuses/status-storage/attacker.jpg'), new Blob(['bad'], { type: 'image/jpeg' })));
  await assertFails(uploadBytes(ref(aliceStorage, 'users/alice/statuses/status-storage/status.mp4'), new Blob(['video-data'], { type: 'video/mp4' })));
  await assertSucceeds(deleteObject(aliceFile));

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice/statuses/expired-storage'), {
      ownerUid: 'alice',
      text: 'حالة منتهية',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 29 * 60 * 60 * 1000)),
      expiresAt: Timestamp.fromDate(new Date(Date.now() - 60 * 1000))
    });
  });
  const expiredPath = 'users/alice/statuses/expired-storage/status.jpg';
  await assertFails(uploadBytes(ref(aliceStorage, expiredPath), new Blob(['expired'], { type: 'image/jpeg' })));
  await assertFails(getBytes(ref(bobStorage, expiredPath)));
});

test('expired statuses cannot be read even by their owner', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const expiredAt = Timestamp.fromDate(new Date(Date.now() - 60 * 1000));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice/statuses/expired-status'), {
      ownerUid: 'alice',
      text: 'حالة منتهية',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 29 * 60 * 60 * 1000)),
      expiresAt: expiredAt
    });
  });
  await assertFails(getDoc(doc(aliceDb, 'users/alice/statuses/expired-status')));
});


test('incoming call queries return only calls addressed to the authenticated recipient', async () => {
  const bobDb = env.authenticatedContext('bob').firestore();
  const malloryDb = env.authenticatedContext('mallory').firestore();
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const incoming = await getDocs(query(
    collection(bobDb, 'calls'),
    where('calleeUid', '==', 'bob'),
    where('status', '==', 'ringing'),
    where('expiresAt', '>', Timestamp.now())
  ));
  assert.equal(incoming.size, 1);
  await assertFails(getDocs(query(
    collection(malloryDb, 'calls'),
    where('calleeUid', '==', 'bob'),
    where('status', '==', 'ringing')
  )));
});

test('WebRTC signaling is limited to call participants and each side owns its SDP and ICE candidates', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  const mallory = env.authenticatedContext('mallory').firestore();
  const call = doc(alice, 'calls/call-1');
  await assertSucceeds(getDoc(call));
  await assertFails(getDoc(doc(mallory, 'calls/call-1')));
  await assertFails(setDoc(doc(alice, 'calls/forged-call'), {
    callerUid: 'alice', calleeUid: 'mallory', status: 'ringing'
  }));
  await assertFails(deleteDoc(call));
  await assertFails(getDoc(doc(mallory, 'calls/call-1/callerCandidates/a1')));
  await assertSucceeds(setDoc(doc(alice, 'calls/call-1/callerCandidates/a1'), {
    candidate: 'candidate:1 1 udp 1 127.0.0.1 1234 typ host', sdpMid: '0', sdpMLineIndex: 0
  }));
  await assertFails(setDoc(doc(bob, 'calls/call-1/callerCandidates/bad'), {
    candidate: 'forged caller candidate', sdpMid: '0', sdpMLineIndex: 0
  }));
  await assertFails(setDoc(doc(alice, 'calls/call-1/callerCandidates/bad-index'), {
    candidate: 'candidate:bad', sdpMid: '0', sdpMLineIndex: 'zero'
  }));
  await assertFails(setDoc(doc(alice, 'calls/call-1/callerCandidates/bad-mid'), {
    candidate: 'candidate:bad', sdpMid: { value: '0' }, sdpMLineIndex: 0
  }));
  await assertSucceeds(setDoc(doc(bob, 'calls/call-1/calleeCandidates/b1'), {
    candidate: 'candidate:2 1 udp 1 127.0.0.1 1235 typ host', sdpMid: '0', sdpMLineIndex: 0
  }));
  await assertFails(setDoc(doc(mallory, 'calls/call-1/calleeCandidates/x'), {
    candidate: 'unauthorized', sdpMid: '0', sdpMLineIndex: 0
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(doc(bob, 'calls/call-1'), {
    offer: { type: 'offer', sdp: 'v=0\\r\\n' }
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(call, {
    answer: { type: 'answer', sdp: 'v=0\\r\\n' }, answerRevision: 0
  }));
  await assertSucceeds((await import('firebase/firestore')).updateDoc(call, {
    offer: { type: 'offer', sdp: 'v=0\\r\\n' }
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(call, {
    offer: { type: 'offer', sdp: 'v=1\\r\\n' }
  }));
  await env.withSecurityRulesDisabled(async context => {
    await (await import('firebase/firestore')).updateDoc(doc(context.firestore(), 'calls/call-1'), {
      status: 'accepted'
    });
  });
  await assertSucceeds((await import('firebase/firestore')).updateDoc(doc(bob, 'calls/call-1'), {
    answer: { type: 'answer', sdp: 'v=0\\r\\n' }, answerRevision: 0
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(doc(bob, 'calls/call-1'), {
    answer: { type: 'answer', sdp: 'v=duplicate\\r\\n' }, answerRevision: 0
  }));
  await env.withSecurityRulesDisabled(async context => {
    await (await import('firebase/firestore')).updateDoc(doc(context.firestore(), 'calls/call-1'), {
      offer: { type: 'offer', sdp: 'v=1\\r\\n' },
      offerRevision: 1,
      iceRestartCount: 1
    });
  });
  await assertSucceeds((await import('firebase/firestore')).updateDoc(doc(bob, 'calls/call-1'), {
    answer: { type: 'answer', sdp: 'v=1\\r\\n' }, answerRevision: 1
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(doc(bob, 'calls/call-1'), {
    answer: { type: 'answer', sdp: 'v=2\\r\\n' }, answerRevision: 2
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(doc(mallory, 'calls/call-1'), {
    status: 'accepted'
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(call, {
    status: 'ended'
  }));
  await env.withSecurityRulesDisabled(async context => {
    await (await import('firebase/firestore')).updateDoc(doc(context.firestore(), 'calls/call-1'), {
      status: 'ended'
    });
  });
  await assertFails(setDoc(doc(alice, 'calls/call-1/callerCandidates/late'), {
    candidate: 'candidate:late', sdpMid: '0', sdpMLineIndex: 0
  }));
});
