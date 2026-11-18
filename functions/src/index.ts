import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const STATUS_LIFETIME_MS = 28 * 60 * 60 * 1000;
const STATUS_COOLDOWN_MS = 30 * 1000;

type CreateStatusInput = {
  text?: unknown;
  mediaType?: unknown;
};

export const createStatus = onCall<CreateStatusInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");

  const text = typeof request.data?.text === "string" ? request.data.text.trim() : "";
  const mediaType = request.data?.mediaType;
  const allowedMediaTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (text.length > 700) {
    throw new HttpsError("invalid-argument", "نص الحالة يتجاوز 700 حرف.");
  }
  if (mediaType !== undefined && !allowedMediaTypes.has(String(mediaType))) {
    throw new HttpsError("invalid-argument", "نوع صورة الحالة غير مدعوم.");
  }
  if (!text && mediaType === undefined) {
    throw new HttpsError("invalid-argument", "أضف نصاً أو صورة قبل النشر.");
  }

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + STATUS_LIFETIME_MS);
  const statusRef = db.collection("users").doc(uid).collection("statuses").doc();
  const rateRef = db.collection("statusRateLimits").doc(uid);

  await db.runTransaction(async (transaction) => {
    const rate = await transaction.get(rateRef);
    const lastCreatedAt = rate.get("lastCreatedAt") as Timestamp | undefined;
    if (lastCreatedAt && now.toMillis() - lastCreatedAt.toMillis() < STATUS_COOLDOWN_MS) {
      throw new HttpsError("resource-exhausted", "انتظر قليلاً قبل نشر حالة أخرى.");
    }
    transaction.set(rateRef, { lastCreatedAt: now, uid });
    const mediaExtension = mediaType === "image/png" ? "png"
      : mediaType === "image/webp" ? "webp" : "jpg";
    const mediaPath = mediaType ? `users/${uid}/statuses/${statusRef.id}/status.${mediaExtension}` : undefined;
    const status: Record<string, unknown> = {
      ownerUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    };
    if (text) status.text = text;
    if (mediaPath) status.mediaPath = mediaPath;
    transaction.create(statusRef, status);
  });

  const mediaExtension = mediaType === "image/png" ? "png"
    : mediaType === "image/webp" ? "webp" : "jpg";
  return {
    statusId: statusRef.id,
    expiresAtMillis: expiresAt.toMillis(),
    mediaPath: mediaType ? `users/${uid}/statuses/${statusRef.id}/status.${mediaExtension}` : null,
  };
});
