const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const {
  createIceServerConfiguration,
  nextRateLimitState,
  nextIceRestartCount,
  resolveIceUid,
} = require("../lib/turnCredentials.js");

test("returns public STUN and short-lived user-bound TURN REST credentials", () => {
  const now = 1_800_000_000_000;
  const secret = "local-test-secret";
  const result = createIceServerConfiguration("user-123", secret, "turn.example.test", "3478", undefined, now);
  const username = `${Math.floor(now / 1000) + 3600}:user-123`;
  assert.equal(result.configured, true);
  assert.equal(result.expiresAt, Math.floor(now / 1000) + 3600);
  assert.deepEqual(result.iceServers[0].urls, ["stun:stun.l.google.com:19302"]);
  assert.deepEqual(result.iceServers[1].urls, [
    "turn:turn.example.test:3478?transport=udp",
    "turn:turn.example.test:3478?transport=tcp",
  ]);
  assert.equal(result.iceServers[1].username, username);
  assert.equal(result.iceServers[1].credential, createHmac("sha1", secret).update(username).digest("base64"));
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("falls back to public STUN only when TURN settings are absent or invalid", () => {
  for (const result of [
    createIceServerConfiguration("user-123", undefined, "turn.example.test", "3478", undefined),
    createIceServerConfiguration("user-123", "secret", undefined, "3478", undefined),
    createIceServerConfiguration("user-123", "secret", "https://evil.example", "3478", undefined),
  ]) {
    assert.equal(result.configured, false);
    assert.equal(result.expiresAt, null);
    assert.deepEqual(result.iceServers, [{ urls: ["stun:stun.l.google.com:19302"] }]);
  }
});

test("credential expiry is clamped to a maximum of one hour and is Unix seconds", () => {
  const now = 1_800_000_000_000;
  const result = createIceServerConfiguration("u", "s", "turn.example.test", "3478", "stun:stun.example.test:3478", now, 99_999);
  assert.equal(result.expiresAt, Math.floor(now / 1000) + 3600);
});

test("unauthenticated and disabled anonymous callers are rejected", () => {
  assert.equal(resolveIceUid(null, false), null);
  assert.equal(resolveIceUid({ uid: "guest-1", token: { firebase: { sign_in_provider: "anonymous" } } }, false), null);
  assert.equal(resolveIceUid({ uid: "guest-1", token: { firebase: { sign_in_provider: "anonymous" } } }, true), "guest-1");
  assert.equal(resolveIceUid({ uid: "user-1", token: { firebase: { sign_in_provider: "password" } } }, false), "user-1");
});

test("per-user rate limiter allows a bounded number per minute and resets", () => {
  let state = nextRateLimitState(undefined, undefined, 1000, 2);
  assert.deepEqual(state, { allowed: true, windowStartedAtMs: 1000, count: 1 });
  state = nextRateLimitState(state.windowStartedAtMs, state.count, 2000, 2);
  assert.deepEqual(state, { allowed: true, windowStartedAtMs: 1000, count: 2 });
  state = nextRateLimitState(state.windowStartedAtMs, state.count, 3000, 2);
  assert.equal(state.allowed, false);
  state = nextRateLimitState(state.windowStartedAtMs, state.count, 61_000, 2);
  assert.deepEqual(state, { allowed: true, windowStartedAtMs: 61_000, count: 1 });
});

test("ICE restart counter allows at most two server-authorized restarts", () => {
  assert.equal(nextIceRestartCount(0), 1);
  assert.equal(nextIceRestartCount(1), 2);
  assert.equal(nextIceRestartCount(2), null);
  assert.equal(nextIceRestartCount(-1), null);
});
