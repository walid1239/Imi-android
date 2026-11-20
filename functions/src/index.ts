import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  isStatusCooldownActive,
  statusExpiryMillis,
  validateStatusInput,
} from "./statusLogic";

initializeApp();
const db = getFirestore();

type CreateStatusInput = {
  text?: unknown;
  mediaType?: unknown;
};

export const createStatus = onCall<CreateStatusInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");

  let validated: ReturnType<typeof validateStatusInput>;
  try {
    validated = validateStatusInput(request.data?.text, request.data?.mediaType);
  } catch (error) {
    throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "بيانات الحالة غير صالحة.");
  }
  const { text, mediaType } = validated;

  const statusRef = db.collection("users").doc(uid).collection("statuses").doc();
  const rateRef = db.collection("statusRateLimits").doc(uid);
  let expiresAtMillis = 0;
  let mediaPath: string | undefined;

  await db.runTransaction(async (transaction) => {
    const rate = await transaction.get(rateRef);
    const lastCreatedAt = rate.get("lastCreatedAt") as Timestamp | undefined;
    const createdAt = Timestamp.now();
    if (isStatusCooldownActive(lastCreatedAt?.toMillis(), createdAt.toMillis())) {
      throw new HttpsError("resource-exhausted", "انتظر قليلاً قبل نشر حالة أخرى.");
    }

    expiresAtMillis = statusExpiryMillis(createdAt.toMillis());
    const expiresAt = Timestamp.fromMillis(expiresAtMillis);
    transaction.set(rateRef, { lastCreatedAt: createdAt, uid });

    const mediaExtension = mediaType === "image/png" ? "png"
      : mediaType === "image/webp" ? "webp" : "jpg";
    mediaPath = mediaType ? `users/${uid}/statuses/${statusRef.id}/status.${mediaExtension}` : undefined;
    const status: Record<string, unknown> = {
      ownerUid: uid,
      createdAt,
      expiresAt,
    };
    if (text) status.text = text;
    if (mediaPath) status.mediaPath = mediaPath;
    transaction.create(statusRef, status);
  });

  return {
    statusId: statusRef.id,
    expiresAtMillis,
    mediaPath: mediaPath ?? null,
  };
});
