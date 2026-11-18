import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
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
