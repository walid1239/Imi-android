export const LESSON_SOURCE_TYPES = [
  "official",
  "open-license",
  "embed",
  "original",
  "teacher-agreement",
] as const;

export type LessonSourceType = typeof LESSON_SOURCE_TYPES[number];

export type LessonSourceInput = {
  sourceType?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  license?: unknown;
  permissionNote?: unknown;
};

export type ValidatedLessonSource = {
  sourceType: LessonSourceType;
  sourceName: string;
  sourceUrl?: string;
  license: string;
  permissionNote: string;
};

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`حقل ${field} مطلوب.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`حقل ${field} مطلوب ويجب ألا يتجاوز ${maxLength} حرفاً.`);
  return normalized;
}

export function validateLessonSource(input: LessonSourceInput): ValidatedLessonSource {
  if (typeof input.sourceType !== "string" || !LESSON_SOURCE_TYPES.includes(input.sourceType as LessonSourceType)) {
    throw new Error("نوع مصدر الدرس غير صالح.");
  }
  const sourceType = input.sourceType as LessonSourceType;
  const sourceName = requiredText(input.sourceName, "اسم المصدر", 160);
  const license = requiredText(input.license, "الترخيص", 160);
  const permissionNote = requiredText(input.permissionNote, "ملاحظة الإذن", 1000);
  const rawUrl = input.sourceUrl === undefined || input.sourceUrl === null ? "" : input.sourceUrl;
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) throw new Error("رابط المصدر غير صالح.");
  const sourceUrl = rawUrl.trim();
  if (["official", "open-license", "embed"].includes(sourceType) && !sourceUrl) {
    throw new Error("رابط المصدر مطلوب لهذا النوع.");
  }
  if (sourceUrl) {
    let parsed: URL;
    try { parsed = new URL(sourceUrl); } catch { throw new Error("رابط المصدر غير صالح."); }
    if (parsed.protocol !== "https:") throw new Error("يجب أن يستخدم رابط المصدر HTTPS.");
  }
  if (sourceType === "original" && !/مراجعة|review/i.test(permissionNote)) {
    throw new Error("يجب توضيح أن المحتوى الأصلي يحتاج إلى مراجعة بشرية.");
  }
  if (sourceType === "teacher-agreement" && !/اتفاق|إذن|موافقة|agreement|permission/i.test(permissionNote)) {
    throw new Error("يجب توثيق الاتفاق أو الإذن مع الأستاذ.");
  }
  return {
    sourceType,
    sourceName,
    ...(sourceUrl ? { sourceUrl } : {}),
    license,
    permissionNote,
  };
}

export function canPublishLessonSource(source: Record<string, unknown>, reviewerUid: string): boolean {
  try {
    validateLessonSource(source);
    return typeof source.addedBy === "string"
      && source.addedBy.length > 0
      && reviewerUid.trim().length > 0;
  } catch {
    return false;
  }
}
