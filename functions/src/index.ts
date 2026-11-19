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


// Academy authoring is deliberately server-only. Never trust a client-supplied role.
type CreateCourseInput = { title?: unknown; description?: unknown; category?: unknown };
type CreateLessonInput = { courseId?: unknown; title?: unknown; content?: unknown; videoUrl?: unknown; order?: unknown };

function requireAdmin(request: { auth?: { uid: string; token: Record<string, unknown> } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "هذه العملية متاحة لمشرف IMI موثّق فقط.");
  }
  return uid;
}

function academyText(value: unknown, field: string, maxLength: number, optional = false): string {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") throw new HttpsError("invalid-argument", `حقل ${field} يجب أن يكون نصاً.`);
  const normalized = value.trim();
  if ((!optional && normalized.length === 0) || normalized.length > maxLength) {
    throw new HttpsError("invalid-argument", `حقل ${field} فارغ أو يتجاوز الحد المسموح.`);
  }
  return normalized;
}

export const createCourse = onCall<CreateCourseInput>(async (request) => {
  const adminUid = requireAdmin(request);
  const title = academyText(request.data?.title, "العنوان", 120);
  const description = academyText(request.data?.description, "الوصف", 4000, true);
  const category = academyText(request.data?.category, "التصنيف", 60);
  const courseRef = db.collection("courses").doc();
  await courseRef.create({
    title, description, category, published: false,
    createdAt: FieldValue.serverTimestamp(), createdBy: adminUid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { courseId: courseRef.id, published: false };
});

export const createCourseLesson = onCall<CreateLessonInput>(async (request) => {
  const adminUid = requireAdmin(request);
  const courseId = requireUid(request.data?.courseId, "معرّف الدورة غير صالح.");
  const title = academyText(request.data?.title, "عنوان الدرس", 120);
  const content = academyText(request.data?.content, "محتوى الدرس", 20000, true);
  const videoUrl = academyText(request.data?.videoUrl, "رابط الفيديو", 2048, true);
  if (videoUrl && !/^https:\/\//i.test(videoUrl)) {
    throw new HttpsError("invalid-argument", "رابط الفيديو يجب أن يبدأ بـ https://.");
  }
  const order = request.data?.order === undefined ? 0 : request.data.order;
  if (typeof order !== "number" || !Number.isSafeInteger(order) || order < 0 || order > 100000) {
    throw new HttpsError("invalid-argument", "ترتيب الدرس غير صالح.");
  }
  const courseRef = db.collection("courses").doc(courseId);
  const lessonRef = courseRef.collection("lessons").doc();
  await db.runTransaction(async (transaction) => {
    const course = await transaction.get(courseRef);
    if (!course.exists) throw new HttpsError("not-found", "الدورة غير موجودة.");
    if (course.get("published") === true) {
      throw new HttpsError("failed-precondition", "أوقف نشر الدورة قبل تعديل محتواها.");
    }
    transaction.create(lessonRef, {
      title, content, ...(videoUrl ? { videoUrl } : {}), order,
      published: false, createdAt: FieldValue.serverTimestamp(),
      createdBy: adminUid, updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { lessonId: lessonRef.id, published: false };
});

export const publishCourse = onCall<{ courseId?: unknown; published?: unknown }>(async (request) => {
  requireAdmin(request);
  const courseId = requireUid(request.data?.courseId, "معرّف الدورة غير صالح.");
  if (typeof request.data?.published !== "boolean") {
    throw new HttpsError("invalid-argument", "حدد حالة نشر صحيحة.");
  }
  const courseRef = db.collection("courses").doc(courseId);
  await db.runTransaction(async (transaction) => {
    const course = await transaction.get(courseRef);
    if (!course.exists) throw new HttpsError("not-found", "الدورة غير موجودة.");
    if (request.data?.published === true) {
      const lessons = await transaction.get(courseRef.collection("lessons"));
      if (lessons.empty) throw new HttpsError("failed-precondition", "أضف درساً واحداً على الأقل قبل نشر الدورة.");
    }
    transaction.update(courseRef, {
      published: request.data?.published,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { published: request.data.published };
});

export const publishCourseLesson = onCall<{ courseId?: unknown; lessonId?: unknown; published?: unknown }>(async (request) => {
  requireAdmin(request);
  const courseId = requireUid(request.data?.courseId, "معرّف الدورة غير صالح.");
  const lessonId = requireUid(request.data?.lessonId, "معرّف الدرس غير صالح.");
  if (typeof request.data?.published !== "boolean") {
    throw new HttpsError("invalid-argument", "حدد حالة نشر صحيحة.");
  }
  const courseRef = db.collection("courses").doc(courseId);
  const lessonRef = courseRef.collection("lessons").doc(lessonId);
  await db.runTransaction(async (transaction) => {
    const [course, lesson] = await Promise.all([
      transaction.get(courseRef), transaction.get(lessonRef),
    ]);
    if (!course.exists || !lesson.exists) throw new HttpsError("not-found", "الدورة أو الدرس غير موجود.");
    if (request.data?.published === true && course.get("published") !== true) {
      throw new HttpsError("failed-precondition", "انشر الدورة أولاً ثم انشر الدرس.");
    }
    transaction.update(lessonRef, {
      published: request.data?.published,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { published: request.data.published };
});


// One-to-one call lifecycle. Identity and state transitions are server-authoritative.
type CreateCallInput = { conversationId?: unknown; calleeUid?: unknown; kind?: unknown };
type CallActionInput = { callId?: unknown };
function callParticipant(data: FirebaseFirestore.DocumentData | undefined, uid: string): boolean {
  return !!data && (data.callerUid === uid || data.calleeUid === uid);
}

export const createCall = onCall<CreateCallInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const conversationId = requireUid(request.data?.conversationId, "معرّف المحادثة غير صالح.");
  const calleeUid = requireUid(request.data?.calleeUid, "معرّف المتلقي غير صالح.");
  const kind = request.data?.kind;
  if (kind !== "audio" && kind !== "video") throw new HttpsError("invalid-argument", "نوع المكالمة غير صالح.");
  if (calleeUid === uid) throw new HttpsError("invalid-argument", "لا يمكنك الاتصال بنفسك.");

  const conversationRef = db.collection("conversations").doc(conversationId);
  const callerFriendRef = db.collection("users").doc(uid).collection("friends").doc(calleeUid);
  const calleeFriendRef = db.collection("users").doc(calleeUid).collection("friends").doc(uid);
  const callRef = db.collection("calls").doc();
  await db.runTransaction(async (tx) => {
    const [conversation, callerFriend, calleeFriend] = await Promise.all([
      tx.get(conversationRef), tx.get(callerFriendRef), tx.get(calleeFriendRef),
    ]);
    const participants = conversation.get("participants");
    if (!conversation.exists || !Array.isArray(participants) || participants.length !== 2
      || !participants.includes(uid) || !participants.includes(calleeUid)) {
      throw new HttpsError("permission-denied", "المكالمة مسموحة فقط بين طرفي محادثة ثنائية.");
    }
    if (!callerFriend.exists || !calleeFriend.exists
      || callerFriend.get("status") !== "accepted" || calleeFriend.get("status") !== "accepted") {
      throw new HttpsError("failed-precondition", "يجب أن تكون الصداقة مؤكدة لدى الطرفين.");
    }
    const now = Timestamp.now();
    tx.create(callRef, {
      callerUid: uid, calleeUid, conversationId, kind, status: "ringing",
      createdAt: now, updatedAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 45_000),
    });
  });
  return { callId: callRef.id, status: "ringing", expiresAtMillis: Date.now() + 45_000 };
});

export const respondToCall = onCall<CallActionInput & { decision?: unknown }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const callId = requireUid(request.data?.callId, "معرّف المكالمة غير صالح.");
  const decision = request.data?.decision;
  if (decision !== "accepted" && decision !== "rejected") throw new HttpsError("invalid-argument", "قرار المكالمة غير صالح.");
  const ref = db.collection("calls").doc(callId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "المكالمة غير موجودة.");
    if (snap.get("calleeUid") !== uid) throw new HttpsError("permission-denied", "المتلقي فقط يمكنه الرد.");
    if (snap.get("status") !== "ringing") throw new HttpsError("failed-precondition", "لم تعد المكالمة في حالة رنين.");
    if ((snap.get("expiresAt") as Timestamp).toMillis() <= Date.now()) {
      tx.update(ref, { status: "missed", updatedAt: FieldValue.serverTimestamp() });
      throw new HttpsError("deadline-exceeded", "انتهت مهلة المكالمة.");
    }
    tx.update(ref, { status: decision, updatedAt: FieldValue.serverTimestamp(), respondedAt: FieldValue.serverTimestamp() });
  });
  return { status: decision };
});

export const endCall = onCall<CallActionInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const callId = requireUid(request.data?.callId, "معرّف المكالمة غير صالح.");
  const ref = db.collection("calls").doc(callId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "المكالمة غير موجودة.");
    if (!callParticipant(snap.data(), uid)) throw new HttpsError("permission-denied", "لست طرفاً في هذه المكالمة.");
    if (!["ringing", "accepted"].includes(snap.get("status"))) return;
    tx.update(ref, { status: "ended", endedBy: uid, updatedAt: FieldValue.serverTimestamp(), endedAt: FieldValue.serverTimestamp() });
  });
  return { status: "ended" };
});
