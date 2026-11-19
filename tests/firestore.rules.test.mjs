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
    await setDoc(doc(db, 'users/alice/friends/bob'), { uid: 'bob', status: 'accepted' });
    await setDoc(doc(db, 'users/bob/friends/alice'), { uid: 'alice', status: 'accepted' });
    await setDoc(doc(db, 'friendRequests/alice__bob'), { fromUid: 'alice', toUid: 'bob', status: 'pending' });
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
    ref(aliceStorage, 'conversations/chat-1/photo.png'),
    new Blob(['png-data'], { type: 'image/png' })
  ));
  await assertFails(uploadBytes(
    ref(malloryStorage, 'conversations/chat-1/photo.png'),
    new Blob(['png-data'], { type: 'image/png' })
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
