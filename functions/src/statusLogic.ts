export const STATUS_LIFETIME_MS = 28 * 60 * 60 * 1000;
export const STATUS_COOLDOWN_MS = 30 * 1000;

export type ValidatedStatusInput = {
  text: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp";
};

export function validateStatusInput(textValue: unknown, mediaTypeValue: unknown): ValidatedStatusInput {
  const text = typeof textValue === "string" ? textValue.trim() : "";
  if (text.length > 700) throw new Error("نص الحالة يتجاوز 700 حرف.");

  const allowedMediaTypes = ["image/jpeg", "image/png", "image/webp"] as const;
  if (mediaTypeValue !== undefined && !allowedMediaTypes.includes(mediaTypeValue as typeof allowedMediaTypes[number])) {
    throw new Error("نوع صورة الحالة غير مدعوم.");
  }
  if (!text && mediaTypeValue === undefined) throw new Error("أضف نصاً أو صورة قبل النشر.");

  return {
    text,
    ...(mediaTypeValue === undefined ? {} : { mediaType: mediaTypeValue as ValidatedStatusInput["mediaType"] }),
  };
}

export function statusExpiryMillis(createdAtMillis: number): number {
  return createdAtMillis + STATUS_LIFETIME_MS;
}

export function isStatusCooldownActive(lastCreatedAtMillis: number | undefined, nowMillis: number): boolean {
  return lastCreatedAtMillis !== undefined && nowMillis - lastCreatedAtMillis < STATUS_COOLDOWN_MS;
}
