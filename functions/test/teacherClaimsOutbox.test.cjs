const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyTeacherClaimsOutboxOperation,
  mergeTeacherClaims,
  teacherClaimsMatch,
} = require("../lib/teacherClaimsOutbox.js");

test("teacher claim changes preserve unrelated custom claims", () => {
  assert.deepEqual(
    mergeTeacherClaims({ admin: true, beta: "x", teacher: false }, true),
    { admin: true, beta: "x", teacher: true, teacherVerified: true },
  );
  assert.deepEqual(
    mergeTeacherClaims({ admin: true, beta: "x", teacher: true, teacherVerified: true }, false),
    { admin: true, beta: "x" },
  );
});

test("claim matching is idempotent for both approval and rejection", () => {
  assert.equal(teacherClaimsMatch({ teacher: true, teacherVerified: true }, true), true);
  assert.equal(teacherClaimsMatch({ admin: true }, false), true);
  assert.equal(teacherClaimsMatch({ teacher: true }, false), false);
  assert.equal(teacherClaimsMatch({ teacher: false, teacherVerified: true }, true), false);
});

test("Auth failure leaves the outbox pending and a retry can apply it", async () => {
  let currentClaims = { admin: true };
  let failAuth = true;
  let applied = 0;
  let pending = 0;
  const deps = {
    getUser: async () => ({ customClaims: currentClaims }),
    setCustomClaims: async (_uid, claims) => {
      if (failAuth) throw new Error("simulated Auth outage");
      currentClaims = claims;
    },
    markApplied: async () => { applied += 1; },
    markPending: async () => { pending += 1; },
  };
  const operation = { targetUid: "teacher_123", desiredTeacher: true };
  await assert.rejects(applyTeacherClaimsOutboxOperation(operation, deps), /simulated Auth outage/);
  assert.equal(pending, 1);
  assert.equal(applied, 0);
  failAuth = false;
  await applyTeacherClaimsOutboxOperation(operation, deps);
  assert.deepEqual(currentClaims, { admin: true, teacher: true, teacherVerified: true });
  assert.equal(applied, 1);
});

test("retry after Auth succeeds but outbox acknowledgement fails does not repeat the Auth write", async () => {
  let currentClaims = {};
  let authWrites = 0;
  let failAck = true;
  let pending = 0;
  const deps = {
    getUser: async () => ({ customClaims: currentClaims }),
    setCustomClaims: async (_uid, claims) => { authWrites += 1; currentClaims = claims; },
    markApplied: async () => {
      if (failAck) throw new Error("simulated Firestore acknowledgement outage");
    },
    markPending: async () => { pending += 1; },
  };
  const operation = { targetUid: "teacher_123", desiredTeacher: true };
  await assert.rejects(applyTeacherClaimsOutboxOperation(operation, deps), /acknowledgement outage/);
  assert.equal(authWrites, 1);
  assert.equal(pending, 1);
  failAck = false;
  await applyTeacherClaimsOutboxOperation(operation, deps);
  assert.equal(authWrites, 1);
});
