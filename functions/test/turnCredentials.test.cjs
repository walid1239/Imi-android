const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { createTurnConfiguration } = require("../lib/turnCredentials.js");

test("TURN credentials are short-lived, user-bound HMAC credentials", () => {
  const now = 1_800_000_000_000;
  const result = createTurnConfiguration("user-123", "local-secret", "turn:turn.example.test:3478, turns:turn.example.test:5349", now);
  const expectedUsername = `${Math.floor(now / 1000) + 3600}:user-123`;
  assert.equal(result.configured, true);
  assert.equal(result.expiresAt, Math.floor(now / 1000) + 3600);
  assert.equal(result.iceServers[1].username, expectedUsername);
  assert.equal(result.iceServers[1].credential, createHmac("sha1", "local-secret").update(expectedUsername).digest("base64"));
  assert.deepEqual(result.iceServers[1].urls, ["turn:turn.example.test:3478", "turns:turn.example.test:5349"]);
});

test("TURN is safely disabled when the secret or TURN URLs are absent", () => {
  const withoutSecret = createTurnConfiguration("user-123", undefined, "turn:turn.example.test:3478");
  const withoutUrls = createTurnConfiguration("user-123", "local-secret", undefined);
  for (const result of [withoutSecret, withoutUrls]) {
    assert.equal(result.configured, false);
    assert.equal(result.expiresAt, null);
    assert.deepEqual(result.iceServers, [{ urls: ["stun:stun.l.google.com:19302"] }]);
  }
});

test("TURN URLs reject non-TURN schemes and credentials have a bounded lifetime", () => {
  const result = createTurnConfiguration("user-123", "local-secret", "https://example.test,turn:turn.example.test:3478", 1_800_000_000_000, 999999);
  assert.deepEqual(result.iceServers[1].urls, ["turn:turn.example.test:3478"]);
  assert.equal(result.expiresAt, Math.floor(1_800_000_000_000 / 1000) + 6 * 60 * 60);
});
