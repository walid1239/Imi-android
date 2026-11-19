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


type SendFriendRequestInput = { toUid?: unknown };
type FriendRequestActionInput = { requestId?: unknown };
type RemoveFriendInput = { friendUid?: unknown };

function requireUid(value: unknown, message: string, maxLength = 128): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > maxLength || value.includes("/")) {
    throw new HttpsError("invalid-argument", message);
  }
  return value.trim();
}

function friendRequestId(fromUid: string, toUid: string): string {
  return `${encodeURIComponent(fromUid)}__${encodeURIComponent(toUid)}`;
}

export const sendFriendRequest = onCall<SendFriendRequestInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const toUid = requireUid(request.data?.toUid, "معرّف المستخدم المستهدف غير صالح.");
  if (toUid === uid) throw new HttpsError("invalid-argument", "لا يمكنك إرسال طلب صداقة إلى نفسك.");

  const outgoingRef = db.collection("friendRequests").doc(friendRequestId(uid, toUid));
  const incomingRef = db.collection("friendRequests").doc(friendRequestId(toUid, uid));
  const targetProfileRef = db.collection("publicProfiles").doc(toUid);
  const ownFriendRef = db.collection("users").doc(uid).collection("friends").doc(toUid);
  const targetFriendRef = db.collection("users").doc(toUid).collection("friends").doc(uid);

  await db.runTransaction(async (transaction) => {
    const [targetProfile, outgoing, incoming, ownFriend, targetFriend] = await Promise.all([
      transaction.get(targetProfileRef),
      transaction.get(outgoingRef),
      transaction.get(incomingRef),
      transaction.get(ownFriendRef),
      transaction.get(targetFriendRef),
    ]);
    if (!targetProfile.exists) throw new HttpsError("not-found", "لم نعثر على هذا المستخدم في دليل IMI.");
    if (ownFriend.exists && ownFriend.get("status") === "accepted"
      && targetFriend.exists && targetFriend.get("status") === "accepted") {
      throw new HttpsError("already-exists", "هذا المستخدم موجود بالفعل ضمن أصدقائك.");
    }
    if (incoming.exists && incoming.get("status") === "pending") {
      throw new HttpsError("failed-precondition", "لديك طلب صداقة وارد من هذا المستخدم؛ افتح الطلبات الواردة لقبوله.");
    }
    if (outgoing.exists && outgoing.get("status") === "pending") {
      throw new HttpsError("already-exists", "سبق أن أرسلت طلب صداقة وما زال قيد الانتظار.");
    }
    transaction.set(outgoingRef, {
      fromUid: uid,
      toUid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { requestId: outgoingRef.id, status: "pending" };
});

export const acceptFriendRequest = onCall<FriendRequestActionInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const requestId = requireUid(request.data?.requestId, "معرّف طلب الصداقة غير صالح.", 300);
  const requestRef = db.collection("friendRequests").doc(requestId);

  await db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new HttpsError("not-found", "طلب الصداقة غير موجود.");
    const fromUid = requestSnapshot.get("fromUid");
    const toUid = requestSnapshot.get("toUid");
    const status = requestSnapshot.get("status");
    if (toUid !== uid) throw new HttpsError("permission-denied", "لا يمكنك قبول طلب موجّه إلى مستخدم آخر.");
    if (status === "accepted") return;
    if (status !== "pending" || typeof fromUid !== "string" || fromUid === uid) {
      throw new HttpsError("failed-precondition", "هذا الطلب لم يعد صالحاً للقبول.");
    }
    const ownFriendRef = db.collection("users").doc(uid).collection("friends").doc(fromUid);
    const senderFriendRef = db.collection("users").doc(fromUid).collection("friends").doc(uid);
    const [ownFriend, senderFriend] = await Promise.all([
      transaction.get(ownFriendRef),
      transaction.get(senderFriendRef),
    ]);
    if ((ownFriend.exists && ownFriend.get("status") !== "accepted")
      || (senderFriend.exists && senderFriend.get("status") !== "accepted")) {
      throw new HttpsError("failed-precondition", "توجد علاقة صداقة غير متسقة؛ لم يتم تغييرها.");
    }
    const now = FieldValue.serverTimestamp();
    transaction.update(requestRef, { status: "accepted", respondedAt: now, updatedAt: now });
    transaction.set(ownFriendRef, { uid: fromUid, status: "accepted", createdAt: now, updatedAt: now });
    transaction.set(senderFriendRef, { uid, status: "accepted", createdAt: now, updatedAt: now });
  });
  return { status: "accepted" };
});

export const rejectFriendRequest = onCall<FriendRequestActionInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const requestId = requireUid(request.data?.requestId, "معرّف طلب الصداقة غير صالح.");
  const requestRef = db.collection("friendRequests").doc(requestId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "طلب الصداقة غير موجود.");
    if (snapshot.get("toUid") !== uid) throw new HttpsError("permission-denied", "لا يمكنك رفض طلب موجّه إلى مستخدم آخر.");
    if (snapshot.get("status") === "rejected") return;
    if (snapshot.get("status") !== "pending") throw new HttpsError("failed-precondition", "هذا الطلب لم يعد قيد الانتظار.");
    transaction.update(requestRef, { status: "rejected", respondedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  return { status: "rejected" };
});

export const removeFriend = onCall<RemoveFriendInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const friendUid = requireUid(request.data?.friendUid, "معرّف الصديق غير صالح.");
  if (friendUid === uid) throw new HttpsError("invalid-argument", "لا يمكن حذف نفسك من قائمة الأصدقاء.");

  const ownFriendRef = db.collection("users").doc(uid).collection("friends").doc(friendUid);
  const otherFriendRef = db.collection("users").doc(friendUid).collection("friends").doc(uid);
  const forwardRequestRef = db.collection("friendRequests").doc(friendRequestId(uid, friendUid));
  const reverseRequestRef = db.collection("friendRequests").doc(friendRequestId(friendUid, uid));
  await db.runTransaction(async (transaction) => {
    const [ownFriend, otherFriend, forwardRequest, reverseRequest] = await Promise.all([
      transaction.get(ownFriendRef),
      transaction.get(otherFriendRef),
      transaction.get(forwardRequestRef),
      transaction.get(reverseRequestRef),
    ]);
    if (!ownFriend.exists || !otherFriend.exists
      || ownFriend.get("status") !== "accepted"
      || otherFriend.get("status") !== "accepted") {
      throw new HttpsError("not-found", "هذه العلاقة ليست صداقة مؤكدة بين الحسابين.");
    }
    transaction.delete(ownFriendRef);
    transaction.delete(otherFriendRef);
    if (forwardRequest.exists && forwardRequest.get("status") === "accepted") {
      transaction.update(forwardRequestRef, { status: "removed", updatedAt: FieldValue.serverTimestamp() });
    }
    if (reverseRequest.exists && reverseRequest.get("status") === "accepted") {
      transaction.update(reverseRequestRef, { status: "removed", updatedAt: FieldValue.serverTimestamp() });
    }
  });
  return { status: "removed" };
});


type CourseEnrollmentInput = { courseId?: unknown; lessonId?: unknown };

export const enrollInCourse = onCall<CourseEnrollmentInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const courseId = requireUid(request.data?.courseId, "معرّف الدورة غير صالح.");
  const courseRef = db.collection("courses").doc(courseId);
  const enrollmentRef = db.collection("users").doc(uid).collection("enrollments").doc(courseId);

  const result = await db.runTransaction(async (transaction) => {
    const [course, enrollment] = await Promise.all([
      transaction.get(courseRef),
      transaction.get(enrollmentRef),
    ]);
    if (!course.exists || course.get("published") !== true) {
      throw new HttpsError("not-found", "هذه الدورة غير متاحة حالياً.");
    }
    if (enrollment.exists) return { status: "enrolled" as const };
    const now = FieldValue.serverTimestamp();
    transaction.create(enrollmentRef, {
      courseId,
      completedLessonIds: [],
      createdAt: now,
      updatedAt: now,
    });
    return { status: "enrolled" as const };
  });
  return result;
});

export const completeCourseLesson = onCall<CourseEnrollmentInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const courseId = requireUid(request.data?.courseId, "معرّف الدورة غير صالح.");
  const lessonId = requireUid(request.data?.lessonId, "معرّف الدرس غير صالح.");
  const courseRef = db.collection("courses").doc(courseId);
  const lessonRef = courseRef.collection("lessons").doc(lessonId);
  const enrollmentRef = db.collection("users").doc(uid).collection("enrollments").doc(courseId);

  await db.runTransaction(async (transaction) => {
    const [course, lesson, enrollment] = await Promise.all([
      transaction.get(courseRef),
      transaction.get(lessonRef),
      transaction.get(enrollmentRef),
    ]);
    if (!course.exists || course.get("published") !== true
      || !lesson.exists || lesson.get("published") !== true) {
      throw new HttpsError("not-found", "الدورة أو الدرس غير متاح.");
    }
    if (!enrollment.exists) throw new HttpsError("failed-precondition", "سجّل في الدورة قبل إكمال الدروس.");
    const completed = enrollment.get("completedLessonIds");
    if (Array.isArray(completed) && completed.includes(lessonId)) return;
    transaction.update(enrollmentRef, {
      completedLessonIds: FieldValue.arrayUnion(lessonId),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: "completed", courseId, lessonId };
});
