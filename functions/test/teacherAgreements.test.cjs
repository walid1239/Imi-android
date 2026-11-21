const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TEACHER_CONTENT_RIGHTS_AGREEMENT_VERSION,
  TEACHER_CHILD_SAFETY_AGREEMENT_VERSION,
  createTeacherAgreementAcceptances,
} = require("../lib/teacherAgreements.js");

test("records separate versioned teacher agreement acceptances", () => {
  const serverTimestamp = { sentinel: "server timestamp" };
  const accepted = createTeacherAgreementAcceptances("teacher_123", serverTimestamp);
  assert.deepEqual(accepted.contentRights, {
    version: TEACHER_CONTENT_RIGHTS_AGREEMENT_VERSION,
    acceptedBy: "teacher_123",
    acceptedAt: serverTimestamp,
  });
  assert.deepEqual(accepted.childSafety, {
    version: TEACHER_CHILD_SAFETY_AGREEMENT_VERSION,
    acceptedBy: "teacher_123",
    acceptedAt: serverTimestamp,
  });
  assert.notEqual(accepted.contentRights.version, "");
  assert.notEqual(accepted.childSafety.version, "");
});

test("rejects malformed teacher identity or missing server timestamp", () => {
  assert.throws(() => createTeacherAgreementAcceptances("../bad", new Date()));
  assert.throws(() => createTeacherAgreementAcceptances("teacher_123", undefined));
});
