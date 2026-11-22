import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const projectId = process.env.GCLOUD_PROJECT || "demo-imi-playwright";
if (!projectId.startsWith("demo-")) {
  throw new Error("Refusing admin proof outside a demo-* Firebase project.");
}

const app = initializeApp({ projectId }, "imi-admin-proof");
const auth = getAuth(app);
const db = getFirestore(app);
const uid = "imi-admin-health-proof";
const email = "imi-admin-health-proof@example.invalid";

try {
  try { await auth.deleteUser(uid); } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  const user = await auth.createUser({ uid, email, emailVerified: true });
  await auth.setCustomUserClaims(user.uid, { admin: true });
  const customToken = await auth.createCustomToken(user.uid);
  const signIn = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const signInBody = await signIn.json();
  assert.equal(signIn.ok, true, "Auth Emulator custom-token sign-in must succeed");
  assert.equal(typeof signInBody.idToken, "string");
  const decoded = await auth.verifyIdToken(signInBody.idToken, true);
  assert.equal(decoded.uid, uid);
  assert.equal(decoded.admin, true);

  await db.doc("adminHealth/probe").set({
    status: "ok",
    projectId,
    verifiedUid: uid,
    checkedAt: FieldValue.serverTimestamp(),
  });
  const snapshot = await db.doc("adminHealth/probe").get();
  assert.equal(snapshot.exists, true);
  assert.equal(snapshot.get("status"), "ok");
  assert.equal(snapshot.get("verifiedUid"), uid);

  process.stdout.write(
    "PASS prove-admin: Auth Emulator custom token issued; verifyIdToken(admin=true) succeeded; Firestore Emulator write/read succeeded.\n",
  );
} finally {
  await deleteApp(app);
}
