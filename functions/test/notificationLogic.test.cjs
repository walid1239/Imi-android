const test = require("node:test");
const assert = require("node:assert/strict");
const { messageNotificationPreview } = require("../lib/notificationLogic.js");

test("message notification previews trim and bound user text", () => {
  assert.equal(messageNotificationPreview({ type: "text", text: "  مرحبا  " }), "مرحبا");
  assert.equal(messageNotificationPreview({ type: "text", text: "x".repeat(200) }).length, 120);
});

test("message notification previews describe media without exposing storage URLs", () => {
  assert.equal(messageNotificationPreview({ type: "image", text: "" }), "أرسل صورة");
  assert.equal(messageNotificationPreview({ type: "audio" }), "أرسل رسالة صوتية");
  assert.equal(messageNotificationPreview({ type: "video" }), "أرسل مقطع فيديو");
  assert.equal(messageNotificationPreview({ type: "unknown" }), "أرسل رسالة جديدة");
});
