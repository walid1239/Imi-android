const test = require('node:test');
const assert = require('node:assert/strict');
const { directConversationId } = require('../lib/conversationLogic.js');

test('direct conversation IDs are symmetric for the same two users', () => {
  assert.equal(directConversationId('alice', 'bob'), directConversationId('bob', 'alice'));
});

test('direct conversation IDs are stable and namespaced', () => {
  const id = directConversationId('alice', 'bob');
  assert.match(id, /^direct_[a-f0-9]{64}$/);
  assert.equal(id, directConversationId('alice', 'bob'));
});

test('direct conversation IDs reject self and empty participants', () => {
  assert.throws(() => directConversationId('alice', 'alice'));
  assert.throws(() => directConversationId('', 'bob'));
});
