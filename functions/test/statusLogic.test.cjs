const test = require("node:test");
const assert = require("node:assert/strict");
const {
  STATUS_LIFETIME_MS,
  STATUS_COOLDOWN_MS,
  validateStatusInput,
  statusExpiryMillis,
  isStatusCooldownActive,
} = require("../lib/statusLogic.js");

test("status expiry is exactly 28 hours after the trusted creation timestamp", () => {
  const createdAt = 1_800_000_000_000;
  assert.equal(statusExpiryMillis(createdAt) - createdAt, 28 * 60 * 60 * 1000);
  assert.equal(STATUS_LIFETIME_MS, 100_800_000);
});

test("status input trims text and accepts supported image MIME types", () => {
  assert.deepEqual(validateStatusInput("  مرحبا  ", "image/webp"), {
    text: "مرحبا",
    mediaType: "image/webp",
  });
  assert.deepEqual(validateStatusInput("نص فقط", undefined), { text: "نص فقط" });
});

test("status input rejects empty payloads, oversized text, and unsupported media", () => {
  assert.throws(() => validateStatusInput("   ", undefined), /أضف نصاً أو صورة/);
  assert.throws(() => validateStatusInput("x".repeat(701), undefined), /700 حرف/);
  assert.throws(() => validateStatusInput("", "video/mp4"), /نوع صورة الحالة/);
});

test("status cooldown blocks attempts before 30 seconds but allows at the boundary", () => {
  const last = 1_800_000_000_000;
  assert.equal(isStatusCooldownActive(last, last + STATUS_COOLDOWN_MS - 1), true);
  assert.equal(isStatusCooldownActive(last, last + STATUS_COOLDOWN_MS), false);
  assert.equal(isStatusCooldownActive(undefined, last), false);
});
