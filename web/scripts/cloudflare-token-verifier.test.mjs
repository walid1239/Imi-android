import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createPublicKey, sign } from "node:crypto";
import { verifyFirebaseIdToken } from "../src/lib/server/cloudflare/firebase-id-token.mjs";

const projectId = "imi-indroid";
const now = 1_800_000_000;

function createKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
}

const { privateKey } = createKeyPair();
const publicJwk = createPublicKey(privateKey).export({ format: "jwk" });
publicJwk.kid = "test-key-1";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signedToken(overrides = {}, signingKey = privateKey) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key-1" }));
  const payload = base64url(JSON.stringify({
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "test-user-123",
    iat: now - 30,
    auth_time: now - 60,
    exp: now + 3300,
    ...overrides,
  }));
  const input = `${header}.${payload}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), signingKey).toString("base64url")}`;
}

function fetcherFor(jwk = publicJwk) {
  return async (url) => {
    assert.equal(
      url,
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    );
    return { ok: true, json: async () => ({ keys: [jwk] }) };
  };
}

test("verifies a Firebase ID token and returns only its authenticated UID", async () => {
  const result = await verifyFirebaseIdToken(signedToken(), {
    projectId, fetcher: fetcherFor(), nowSeconds: now,
  });
  assert.deepEqual(result, { uid: "test-user-123" });
});

test("rejects an expired token", async () => {
  await assert.rejects(
    verifyFirebaseIdToken(signedToken({ exp: now - 1 }), {
      projectId, fetcher: fetcherFor(), nowSeconds: now,
    }),
    /INVALID_FIREBASE_ID_TOKEN/,
  );
});

test("rejects a token issued for another Firebase project", async () => {
  await assert.rejects(
    verifyFirebaseIdToken(signedToken({ aud: "another-project" }), {
      projectId, fetcher: fetcherFor(), nowSeconds: now,
    }),
    /INVALID_FIREBASE_ID_TOKEN/,
  );
});

test("rejects a forged signature", async () => {
  const { privateKey: otherPrivateKey } = createKeyPair();
  await assert.rejects(
    verifyFirebaseIdToken(signedToken({}, otherPrivateKey), {
      projectId, fetcher: fetcherFor(), nowSeconds: now,
    }),
    /INVALID_FIREBASE_ID_TOKEN/,
  );
});

test("rejects an unknown signing key ID", async () => {
  await assert.rejects(
    verifyFirebaseIdToken(signedToken(), {
      projectId,
      fetcher: fetcherFor({ ...publicJwk, kid: "unknown-key" }),
      nowSeconds: now,
    }),
    /INVALID_FIREBASE_ID_TOKEN/,
  );
});

test("rejects malformed bearer material before making a network request", async () => {
  let fetched = false;
  await assert.rejects(
    verifyFirebaseIdToken("not-a-jwt", {
      projectId,
      fetcher: async () => { fetched = true; return { ok: true, json: async () => ({ keys: [] }) }; },
      nowSeconds: now,
    }),
    /INVALID_FIREBASE_ID_TOKEN/,
  );
  assert.equal(fetched, false);
});
