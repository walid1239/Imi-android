const test = require("node:test");
const assert = require("node:assert/strict");
const { assertParentType, normalizedNode } = require("../lib/curriculumAdmin.js");

test("curriculum hierarchy accepts only level > track > subject > unit", () => {
  assert.doesNotThrow(() => assertParentType("level", null));
  assert.doesNotThrow(() => assertParentType("track", "level"));
  assert.doesNotThrow(() => assertParentType("subject", "track"));
  assert.doesNotThrow(() => assertParentType("unit", "subject"));
  assert.throws(() => assertParentType("track", null), error => error.code === "failed-precondition");
  assert.throws(() => assertParentType("subject", "level"), error => error.code === "failed-precondition");
  assert.throws(() => assertParentType("unit", "track"), error => error.code === "failed-precondition");
  assert.throws(() => assertParentType("level", "track"), error => error.code === "failed-precondition");
});

test("curriculum node normalization validates IDs, names, types and order", () => {
  const item = normalizedNode({
    id: "math_subject", type: "subject", parentId: "math_track",
    nameAr: "الرياضيات", nameFr: "Mathématiques", language: "fr", order: 3,
  });
  assert.equal(item.id, "math_subject");
  assert.equal(item.type, "subject");
  assert.equal(item.parentId, "math_track");
  assert.equal(item.language, "fr");
  assert.equal(item.order, 3);
  assert.throws(() => normalizedNode({
    id: "Bad ID", type: "subject", parentId: "math_track",
    nameAr: "الرياضيات", nameFr: "", order: 3,
  }), error => error.code === "invalid-argument");
  assert.throws(() => normalizedNode({
    id: "math_subject", type: "subject", parentId: "math_track",
    nameAr: "", nameFr: "", order: 3,
  }), error => error.code === "invalid-argument");
  assert.throws(() => normalizedNode({
    id: "math_subject", type: "subject", parentId: "math_track",
    nameAr: "الرياضيات", nameFr: "", order: 0,
  }), error => error.code === "invalid-argument");
});
