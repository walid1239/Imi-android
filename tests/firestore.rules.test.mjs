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
    await setDoc(doc(db, 'calls/call-1'), { callerUid: 'alice', calleeUid: 'bob', conversationId: 'chat-1', kind: 'video', status: 'ringing', createdAt: new Date(), expiresAt: Timestamp.fromDate(new Date(Date.now() + 60000)) });
    await setDoc(doc(db, 'conversations/chat-1'), {
      participants: ['alice', 'bob'],
      createdBy: 'alice',
      createdAt: new Date()
    });
  });
});

after(async () => {
  await env?.cleanup();
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
});

test('conversation read receipts and typing state are private to members and self-writable only', async () => {
  const aliceDb = env.authenticatedContext('alice').firestore();
  const bobDb = env.authenticatedContext('bob').firestore();
  const malloryDb = env.authenticatedContext('mallory').firestore();
  const aliceReceipt = doc(aliceDb, 'conversations/chat-1/readReceipts/alice');
  await assertSucceeds(setDoc(aliceReceipt, {
    uid: 'alice', lastReadAt: serverTimestamp(), lastReadMessageId: 'msg-1'
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/readReceipts/bob'), {
    uid: 'bob', lastReadAt: serverTimestamp(), lastReadMessageId: 'msg-1'
  }));
  await assertSucceeds(getDoc(aliceReceipt));
  await assertFails(getDoc(doc(malloryDb, 'conversations/chat-1/readReceipts/alice')));
  const aliceDelivery = doc(aliceDb, 'conversations/chat-1/deliveryReceipts/alice');
  await assertSucceeds(setDoc(aliceDelivery, {
    uid: 'alice', lastDeliveredAt: serverTimestamp(), lastDeliveredMessageId: 'msg-1'
  }));
  await assertFails(setDoc(doc(aliceDb, 'conversations/chat-1/deliveryReceipts/bob'), {
    uid: 'bob', lastDeliveredAt: serverTimestamp(), lastDeliveredMessageId: 'msg-1'
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
  await assertSucceeds(uploadBytes(
    ref(aliceStorage, 'conversations/chat-1/alice/message-1/photo.png'),
    new Blob(['png-data'], { type: 'image/png' })
  ));
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
    answer: { type: 'answer', sdp: 'v=0\\r\\n' }
  }));
  await assertSucceeds((await import('firebase/firestore')).updateDoc(call, {
    offer: { type: 'offer', sdp: 'v=0\\r\\n' }
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(call, {
    offer: { type: 'offer', sdp: 'v=1\\r\\n' }
  }));
  await assertSucceeds((await import('firebase/firestore')).updateDoc(doc(bob, 'calls/call-1'), {
    answer: { type: 'answer', sdp: 'v=0\\r\\n' }
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(doc(bob, 'calls/call-1'), {
    answer: { type: 'answer', sdp: 'v=1\\r\\n' }
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(doc(mallory, 'calls/call-1'), {
    status: 'accepted'
  }));
  await assertFails((await import('firebase/firestore')).updateDoc(call, {
    status: 'ended'
  }));
});
