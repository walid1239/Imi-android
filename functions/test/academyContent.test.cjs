const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLessonSource, canPublishLessonSource } = require("../lib/academyContent.js");

const valid = {
  sourceType: "official",
  sourceName: "وزارة التربية الوطنية",
  sourceUrl: "https://www.men.gov.ma/programme",
  license: "إذن التضمين الرسمي",
  permissionNote: "رابط رسمي؛ يسمح بالاستشهاد مع النسبة",
};

test("accepts complete official source metadata with HTTPS", () => {
  assert.deepEqual(validateLessonSource(valid), valid);
});

test("rejects publishing metadata without required attribution fields", () => {
  for (const patch of [
    { sourceName: "" },
    { license: "" },
    { permissionNote: "" },
    { sourceUrl: "http://example.org" },
    { sourceUrl: "" },
  ]) {
    assert.throws(() => validateLessonSource({ ...valid, ...patch }));
  }
});

test("original content must be marked for human review", () => {
  assert.throws(() => validateLessonSource({
    ...valid, sourceType: "original", sourceUrl: "", permissionNote: "مسودة أصلية",
  }));
  assert.doesNotThrow(() => validateLessonSource({
    ...valid, sourceType: "original", sourceUrl: "", permissionNote: "مسودة أصلية تحتاج مراجعة بشرية",
  }));
});

test("teacher content must document agreement or permission", () => {
  assert.throws(() => validateLessonSource({
    ...valid, sourceType: "teacher-agreement", permissionNote: "محتوى أستاذ",
  }));
  assert.doesNotThrow(() => validateLessonSource({
    ...valid, sourceType: "teacher-agreement", permissionNote: "اتفاق مكتوب مع الأستاذ",
  }));
});

test("lesson cannot be published without author and reviewer identities", () => {
  assert.equal(canPublishLessonSource({ ...valid }, "reviewer"), false);
  assert.equal(canPublishLessonSource({ ...valid, addedBy: "author" }, ""), false);
  assert.equal(canPublishLessonSource({ ...valid, addedBy: "author" }, "reviewer"), true);
});
