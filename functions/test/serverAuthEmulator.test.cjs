const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { authenticateBearer, publicErrorMessage } = require("../lib/shared/serverAuth.js");

const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

test("server auth rejects a missing bearer token", async () => {
  await assert.rejects(
    authenticateBearer(null, { verifyIdToken: async () => ({ uid: "should-not-run" }) }),
    error => error.code === "unauthenticated",
  );
});

test("server auth rejects a forged ID token against the Auth Emulator", { skip: !emulatorHost }, async () => {
  const app = initializeApp({ projectId: "demo-imi-security" }, "server-auth-emulator-test");
  try {
    const auth = getAuth(app);
    const forged = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1aWQiOiJhdHRhY2tlciIsImF1ZCI6ImRlbW8taW1pLXNlY3VyaXR5In0.forged-signature";
    await assert.rejects(
      authenticateBearer(`Bearer ${forged}`, { verifyIdToken: token => auth.verifyIdToken(token) }),
      error => error.code === "unauthenticated",
    );
  } finally {
    await deleteApp(app);
  }
});

test("unknown server errors never expose secret or exception details", () => {
  const secret = "private_key_DO_NOT_LEAK_123";
  const result = publicErrorMessage(new Error(secret));
  assert.equal(result.status, 500);
  assert.equal(result.message.includes(secret), false);
  assert.equal(result.message, "حدث خطأ داخلي. حاول لاحقاً.");
});
