const test = require('node:test');
const assert = require('node:assert/strict');
const { mockLiveProvider } = require('../lib/liveProvider.js');

test('mock live provider never creates a real room, join URL, or recording', async () => {
  const plan = await mockLiveProvider.schedule({
    sessionId: 'test-session', teacherUid: 'teacher-1',
    title: 'اختبار بث', subjectId: 'math', startsAt: new Date(Date.now() + 60000),
  });
  assert.equal(plan.provider, 'mock');
  assert.equal(plan.status, 'mock_scheduled');
  assert.equal(plan.liveEnabled, false);
  assert.equal(plan.joinUrl, null);
  assert.equal(plan.recordingPath, null);
});
