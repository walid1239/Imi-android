import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import { createIceServerConfiguration, nextIceRestartCount, nextRateLimitState, resolveIceUid } from "./turnCredentials";
import { directConversationId } from "./conversationLogic";
import { messageNotificationPreview } from "./notificationLogic";
import { canPublishLessonSource, validateLessonSource } from "./academyContent";
import { CoreError, createStatus as coreCreateStatus, sendFriendRequest as coreSendFriendRequest, createOrGetDirectConversation as coreCreateOrGetDirectConversation, acceptFriendRequest as coreAcceptFriendRequest, rejectFriendRequest as coreRejectFriendRequest, removeFriend as coreRemoveFriend, type StorePort, type TransactionPort } from "./shared/serverCore";

const configuredStorageBucket = process.env.IMI_STORAGE_BUCKET?.trim();
initializeApp(configuredStorageBucket ? { storageBucket: configuredStorageBucket } : undefined);
const db = getFirestore();

const coreStore: StorePort = {
  runTransaction: <T>(work: (tx: TransactionPort) => Promise<T>) => db.runTransaction(async transaction => work({
    get: async path => {
      const snapshot = await transaction.get(db.doc(path));
      return { exists: snapshot.exists, data: snapshot.data() ?? {} };
    },
    create: (path, data) => transaction.create(db.doc(path), data),
    set: (path, data) => transaction.set(db.doc(path), data),
    update: (path, data) => transaction.update(db.doc(path), data),
    delete: path => transaction.delete(db.doc(path)),
  })),
  newId: () => db.collection("_ids").doc().id,
  nowMillis: () => Date.now(),
  serverTimestamp: () => FieldValue.serverTimestamp(),
  timestampFromMillis: value => Timestamp.fromMillis(value),
  timestampToMillis: value => {
    if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") return (value as Timestamp).toMillis();
    if (value instanceof Date) return value.getTime();
    return typeof value === "number" ? value : undefined;
  },
  isVerifiedTeacher: async uid => (await getAuth().getUser(uid)).customClaims?.teacherVerified === true,
  directConversationId,
  getDocument: async path => { const snapshot = await db.doc(path).get(); return { exists: snapshot.exists, data: snapshot.data() ?? {} }; },
  getActiveCalls: async (callerUid, calleeUid) => {
    const snapshot = await db.collection("calls").where("callerUid", "==", callerUid)
      .where("calleeUid", "==", calleeUid).where("status", "in", ["ringing", "accepted"]).get();
    return snapshot.docs.map(item => ({ id: item.id }));
  },
};
async function runCore<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof CoreError) throw new HttpsError(error.code, error.message);
    throw error;
  }
}


async function assertNoTeacherStudentPrivateChat(firstUid: string, secondUid: string) {
  const [first, second] = await Promise.all([
    getAuth().getUser(firstUid), getAuth().getUser(secondUid),
  ]);
  const firstTeacher = first.customClaims?.teacherVerified === true;
  const secondTeacher = second.customClaims?.teacherVerified === true;
  if (firstTeacher !== secondTeacher) {
    throw new HttpsError("permission-denied", "التواصل الخاص بين الأستاذ والتلميذ غير متاح. استخدم قنوات الأكاديمية العامة والمراقبة.");
  }
}
const TURN_SECRET = defineSecret("TURN_SECRET");
const TURN_HOST = defineString("TURN_HOST", { default: "" });
const TURN_PORT = defineString("TURN_PORT", { default: "3478" });
const TURN_TTL_SECONDS = defineString("TURN_TTL_SECONDS", { default: "3600" });
const STUN_URLS = defineString("STUN_URLS", { default: "stun:stun.l.google.com:19302" });
const TURN_ALLOW_ANONYMOUS = defineString("TURN_ALLOW_ANONYMOUS", { default: "false" });
const ICE_RATE_LIMIT_PER_MINUTE = defineString("ICE_RATE_LIMIT_PER_MINUTE", { default: "10" });

type CreateStatusInput = {
  text?: unknown;
  mediaType?: unknown;
};

export const createStatus = onCall<CreateStatusInput>(async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  return runCore(() => coreCreateStatus(coreStore, request.auth!.uid, request.data ?? {}));
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

type CreateOrGetDirectConversationInput = { otherUid?: unknown };

/**
 * Creates a deterministic direct conversation using Admin SDK. The browser
 * never needs permission to read a not-yet-created private conversation ID.
 */
export const createOrGetDirectConversation = onCall<CreateOrGetDirectConversationInput>(async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  return runCore(() => coreCreateOrGetDirectConversation(coreStore, request.auth!.uid, request.data ?? {}));
});

export const sendFriendRequest = onCall<SendFriendRequestInput>(async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  return runCore(() => coreSendFriendRequest(coreStore, request.auth!.uid, request.data ?? {}));
});

export const acceptFriendRequest = onCall<FriendRequestActionInput>(async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  return runCore(() => coreAcceptFriendRequest(coreStore, request.auth!.uid, request.data ?? {}));
});

export const rejectFriendRequest = onCall<FriendRequestActionInput>(async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  return runCore(() => coreRejectFriendRequest(coreStore, request.auth!.uid, request.data ?? {}));
});

export const removeFriend = onCall<RemoveFriendInput>(async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  return runCore(() => coreRemoveFriend(coreStore, request.auth!.uid, request.data ?? {}));
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


// Reels are uploaded into a private owner path, then registered as pending.
// Only an administrator can approve them; clients cannot forge publication metadata.
type SubmitReelInput = { reelId?: unknown; caption?: unknown; storagePath?: unknown; contentType?: unknown };
type ReviewReelInput = { reelId?: unknown; decision?: unknown; note?: unknown };

export const submitReel = onCall<SubmitReelInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const reelId = typeof request.data?.reelId === "string" ? request.data.reelId.trim() : "";
  const caption = typeof request.data?.caption === "string" ? request.data.caption.trim() : "";
  const contentType = request.data?.contentType;
  const storagePath = request.data?.storagePath;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(reelId)) throw new HttpsError("invalid-argument", "معرّف المقطع غير صالح.");
  if (caption.length > 300) throw new HttpsError("invalid-argument", "الوصف يتجاوز 300 حرف.");
  if (contentType !== "video/mp4" && contentType !== "video/webm") throw new HttpsError("invalid-argument", "صيغة الفيديو غير مدعومة.");
  const extension = contentType === "video/webm" ? "webm" : "mp4";
  const expectedPath = `reels/${uid}/${reelId}/video.${extension}`;
  if (storagePath !== expectedPath) throw new HttpsError("invalid-argument", "مسار الفيديو لا يطابق حسابك أو معرّف المقطع.");
  const file = getStorage().bucket().file(expectedPath);
  let metadata: Record<string, unknown>;
  try {
    const [actual] = await file.getMetadata();
    metadata = actual as Record<string, unknown>;
  } catch {
    throw new HttpsError("not-found", "لم يتم العثور على الفيديو المرفوع.");
  }
  const size = Number(metadata.size ?? 0);
  if (metadata.contentType !== contentType || !Number.isFinite(size) || size <= 0 || size > 100 * 1024 * 1024) {
    throw new HttpsError("failed-precondition", "بيانات الفيديو أو حجمه لا تطابق الشروط.");
  }
  const reelRef = db.collection("reels").doc(reelId);
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(reelRef);
    if (existing.exists) throw new HttpsError("already-exists", "هذا المقطع مسجل مسبقاً.");
    transaction.create(reelRef, {
      ownerUid: uid, caption, storagePath: expectedPath, contentType,
      status: "pending", createdAt: FieldValue.serverTimestamp(),
      reviewedAt: null, reviewedBy: null,
    });
  });
  return { reelId, status: "pending" };
});

export const reviewReel = onCall<ReviewReelInput>(async (request) => {
  const adminUid = requireAdmin(request);
  const reelId = typeof request.data?.reelId === "string" ? request.data.reelId.trim() : "";
  const decision = request.data?.decision;
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(reelId) || !["approved", "rejected"].includes(String(decision))) {
    throw new HttpsError("invalid-argument", "طلب المراجعة غير صالح.");
  }
  const reelRef = db.collection("reels").doc(reelId);
  await db.runTransaction(async transaction => {
    const reel = await transaction.get(reelRef);
    if (!reel.exists) throw new HttpsError("not-found", "المقطع غير موجود.");
    if (reel.get("status") !== "pending") throw new HttpsError("failed-precondition", "تمت مراجعة هذا المقطع مسبقاً.");
    transaction.update(reelRef, {
      status: decision, reviewedBy: adminUid, reviewedAt: FieldValue.serverTimestamp(),
      reviewNote: note,
    });
    transaction.create(db.collection("moderationLogs").doc(), {
      actorUid: adminUid, action: decision === "approved" ? "reel_approved" : "reel_rejected",
      targetId: reelId, createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { reelId, status: decision };
});

// Academy authoring is deliberately server-only. Never trust a client-supplied role.
type CreateCourseInput = { title?: unknown; description?: unknown; category?: unknown };
type CreateLessonInput = { courseId?: unknown; title?: unknown; content?: unknown; videoUrl?: unknown; order?: unknown; sourceType?: unknown; sourceName?: unknown; sourceUrl?: unknown; license?: unknown; permissionNote?: unknown };

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
  let source: ReturnType<typeof validateLessonSource>;
  try {
    source = validateLessonSource(request.data ?? {});
  } catch (error) {
    throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "بيانات مصدر الدرس غير صالحة.");
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
      ...source, addedBy: adminUid, reviewStatus: "draft",
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

type ReviewCurriculumNodeInput = { nodeId?: unknown; approved?: unknown };

export const reviewCurriculumNode = onCall<ReviewCurriculumNodeInput>(async request => {
  const adminUid = requireAdmin(request);
  const nodeId = requireUid(request.data?.nodeId, "معرّف عنصر المنهاج غير صالح.");
  if (typeof request.data?.approved !== "boolean") throw new HttpsError("invalid-argument", "قرار اعتماد المنهاج غير صالح.");
  const approved = request.data.approved;
  const nodeRef = db.collection("curriculumNodes").doc(nodeId);
  const operationId = `curriculum-${nodeId}-${Date.now()}`;
  const auditRef = db.collection("moderationAudit").doc(operationId);
  const result = await db.runTransaction(async transaction => {
    const node = await transaction.get(nodeRef);
    if (!node.exists) throw new HttpsError("not-found", "عنصر المنهاج غير موجود.");
    const desiredStatus = approved ? "published" : "hidden";
    const desiredReview = !approved;
    if (node.get("status") === desiredStatus && node.get("needsReview") === desiredReview) {
      return { status: desiredStatus, needsReview: desiredReview, idempotent: true };
    }
    if (approved && node.get("needsReview") !== true) {
      throw new HttpsError("failed-precondition", "هذا العنصر لا ينتظر اعتماداً جديداً.");
    }
    const parentId = node.get("parentId");
    if (approved && typeof parentId === "string") {
      const parentRef = db.collection("curriculumNodes").doc(parentId);
      const parent = await transaction.get(parentRef);
      if (!parent.exists || parent.get("status") !== "published" || parent.get("needsReview") === true) {
        throw new HttpsError("failed-precondition", "اعتمد العنصر الأب أولاً قبل نشر هذا العنصر.");
      }
    }
    const now = FieldValue.serverTimestamp();
    transaction.update(nodeRef, {
      status: desiredStatus, needsReview: desiredReview,
      reviewedBy: adminUid, reviewedAt: now, updatedAt: now,
    });
    transaction.create(auditRef, {
      actorUid: adminUid, action: approved ? "curriculum_node_approved" : "curriculum_node_rejected",
      targetType: "curriculumNode", targetId: nodeId, operationId, createdAt: now,
    });
    return { status: desiredStatus, needsReview: desiredReview, idempotent: false };
  });
  return { ...result, operationId };
});

type ReportAcademyLessonInput = { courseId?: unknown; lessonId?: unknown; reason?: unknown; details?: unknown };
const allowedReportReasons = ["incorrect", "inappropriate", "copyright", "other"] as const;

export const reportAcademyLesson = onCall<ReportAcademyLessonInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول لإرسال بلاغ.");
  const courseId = requireUid(request.data?.courseId, "معرّف الدورة غير صالح.");
  const lessonId = requireUid(request.data?.lessonId, "معرّف الدرس غير صالح.");
  const reason = academyText(request.data?.reason, "سبب البلاغ", 32);
  if (!(allowedReportReasons as readonly string[]).includes(reason)) throw new HttpsError("invalid-argument", "سبب البلاغ غير مدعوم.");
  const details = academyText(request.data?.details, "تفاصيل البلاغ", 500, true);
  const courseRef = db.collection("courses").doc(courseId);
  const lessonRef = courseRef.collection("lessons").doc(lessonId);
  const rateRef = db.collection("reportRateLimits").doc(uid);
  const reportRef = db.collection("contentReports").doc();
  await db.runTransaction(async (transaction) => {
    const [course, lesson, rate] = await Promise.all([transaction.get(courseRef), transaction.get(lessonRef), transaction.get(rateRef)]);
    if (!course.exists || course.get("published") !== true || !lesson.exists || lesson.get("published") !== true) {
      throw new HttpsError("not-found", "المحتوى غير متاح للإبلاغ.");
    }
    const now = Timestamp.now();
    const lastReportAt = rate.get("lastReportAt") as Timestamp | undefined;
    if (lastReportAt && now.toMillis() - lastReportAt.toMillis() < 30_000) {
      throw new HttpsError("resource-exhausted", "انتظر 30 ثانية قبل إرسال بلاغ آخر.");
    }
    transaction.create(reportRef, {
      reporterUid: uid, targetType: "academyLesson", courseId, lessonId, reason, details,
      status: "open", createdAt: now, updatedAt: now,
    });
    transaction.set(rateRef, { uid, lastReportAt: now, updatedAt: now }, { merge: true });
  });
  return { status: "submitted", reportId: reportRef.id };
});

type ReviewContentReportInput = { reportId?: unknown; status?: unknown; note?: unknown };
export const reviewContentReport = onCall<ReviewContentReportInput>(async (request) => {
  const adminUid = requireAdmin(request);
  const reportId = requireUid(request.data?.reportId, "معرّف البلاغ غير صالح.");
  const status = request.data?.status;
  if (status !== "resolved" && status !== "dismissed") throw new HttpsError("invalid-argument", "حالة مراجعة البلاغ غير صالحة.");
  const note = academyText(request.data?.note, "ملاحظة المراجعة", 500, true);
  const reportRef = db.collection("contentReports").doc(reportId);
  const logRef = db.collection("moderationLogs").doc();
  await db.runTransaction(async (transaction) => {
    const report = await transaction.get(reportRef);
    if (!report.exists) throw new HttpsError("not-found", "البلاغ غير موجود.");
    if (report.get("status") !== "open") throw new HttpsError("failed-precondition", "تمت مراجعة هذا البلاغ مسبقاً.");
    const now = FieldValue.serverTimestamp();
    transaction.update(reportRef, { status, reviewNote: note, reviewedBy: adminUid, reviewedAt: now, updatedAt: now });
    transaction.create(logRef, {
      actorUid: adminUid, action: status === "resolved" ? "report_resolved" : "report_dismissed",
      targetType: report.get("targetType") || "unknown",
      targetId: report.get("lessonId") || report.get("targetId") || reportId,
      reportId, createdAt: now,
    });
  });
  return { status };
});

export const publishCourseLesson = onCall<{ courseId?: unknown; lessonId?: unknown; published?: unknown }>(async (request) => {
  const adminUid = requireAdmin(request);
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
    if (request.data?.published === true && !canPublishLessonSource(lesson.data() ?? {}, adminUid)) {
      throw new HttpsError("failed-precondition", "لا يمكن نشر الدرس قبل استكمال بيانات المصدر والإذن وتوثيق المراجعة.");
    }
    transaction.update(lessonRef, {
      published: request.data?.published,
      ...(request.data?.published === true ? {
        reviewStatus: "reviewed",
        reviewedBy: adminUid,
        reviewedAt: FieldValue.serverTimestamp(),
      } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { published: request.data.published };
});


// Create durable in-app notifications from trusted Firestore message events.
export const notifyConversationMessage = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const message = event.data;
    if (!message) return;
    const senderUid = message.get("senderUid");
    const conversationId = event.params.conversationId;
    const messageId = event.params.messageId;
    if (typeof senderUid !== "string" || !senderUid) return;

    const conversation = await db.collection("conversations").doc(conversationId).get();
    const participants = conversation.get("participants");
    if (!conversation.exists || !Array.isArray(participants) || !participants.includes(senderUid)) return;

    const preview = messageNotificationPreview({
      type: message.get("type"),
      text: message.get("text"),
    });
    const recipients = participants.filter((uid): uid is string =>
      typeof uid === "string" && uid !== senderUid
    );

    await Promise.all(recipients.map(async (recipientUid) => {
      const notificationRef = db.collection("users").doc(recipientUid)
        .collection("notifications").doc(`${conversationId}_${messageId}`);
      const notificationCreated = await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(notificationRef);
        if (existing.exists) return false; // Idempotent across event retries; preserve readAt.
        transaction.create(notificationRef, {
          type: "message",
          senderUid,
          conversationId,
          messageId,
          preview,
          createdAt: FieldValue.serverTimestamp(),
          readAt: null,
        });
        return true;
      });
      if (!notificationCreated) return;

      const tokenSnapshot = await db.collection("users").doc(recipientUid)
        .collection("fcmTokens").limit(500).get();
      const tokens = tokenSnapshot.docs.filter((tokenDoc) => {
        const token = tokenDoc.get("token");
        return typeof token === "string" && token.length > 20;
      });
      if (tokens.length === 0) return;

      try {
        const pushResult = await getMessaging().sendEachForMulticast({
          tokens: tokens.map((tokenDoc) => tokenDoc.get("token") as string),
          notification: { title: "رسالة جديدة في IMI", body: preview },
          data: { type: "message", conversationId, messageId, senderUid },
        });
        const invalidTokens = pushResult.responses.flatMap((response, index) => {
          const code = response.error?.code;
          return code === "messaging/registration-token-not-registered"
            || code === "messaging/invalid-registration-token"
            ? [tokens[index].ref]
            : [];
        });
        await Promise.all(invalidTokens.map(tokenRef => tokenRef.delete()));
      } catch {
        // Push is best-effort; the durable in-app notification remains available.
      }
    }));
  }
);

// Notify the callee when a trusted callable creates an incoming call.
export const notifyIncomingCall = onDocumentCreated("calls/{callId}", async (event) => {
  const call = event.data;
  if (!call) return;
  const callerUid = call.get("callerUid");
  const calleeUid = call.get("calleeUid");
  const conversationId = call.get("conversationId");
  const kind = call.get("kind");
  if (typeof callerUid !== "string" || typeof calleeUid !== "string"
    || typeof conversationId !== "string" || (kind !== "audio" && kind !== "video")) return;

  const notificationRef = db.collection("users").doc(calleeUid)
    .collection("notifications").doc(`call_${event.params.callId}`);
  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(notificationRef);
    if (existing.exists) return false;
    transaction.create(notificationRef, {
      type: "call",
      senderUid: callerUid,
      conversationId,
      callId: event.params.callId,
      preview: kind === "video" ? "مكالمة فيديو واردة" : "مكالمة صوتية واردة",
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
    });
    return true;
  });
  if (!created) return;

  const tokenSnapshot = await db.collection("users").doc(calleeUid)
    .collection("fcmTokens").limit(500).get();
  const tokens = tokenSnapshot.docs.filter(tokenDoc => {
    const token = tokenDoc.get("token");
    return typeof token === "string" && token.length > 20;
  });
  if (tokens.length === 0) return;

  try {
    const pushResult = await getMessaging().sendEachForMulticast({
      tokens: tokens.map(tokenDoc => tokenDoc.get("token") as string),
      notification: {
        title: "مكالمة واردة في IMI",
        body: kind === "video" ? "لديك مكالمة فيديو واردة." : "لديك مكالمة صوتية واردة.",
      },
      data: {
        type: "call",
        callId: event.params.callId,
        conversationId,
        callerUid,
        kind,
      },
    });
    const invalidTokens = pushResult.responses.flatMap((response, index) => {
      const code = response.error?.code;
      return code === "messaging/registration-token-not-registered"
        || code === "messaging/invalid-registration-token"
        ? [tokens[index].ref]
        : [];
    });
    await Promise.all(invalidTokens.map(tokenRef => tokenRef.delete()));
  } catch {
    // The in-app call notification remains available if push delivery fails.
  }
});

// Expire unanswered calls on the server so callers do not remain in a ringing state.
export const expireRingingCalls = onSchedule("every 1 minutes", async () => {
  const expiredCalls = await db.collection("calls")
    .where("status", "==", "ringing")
    .where("expiresAt", "<=", Timestamp.now())
    .limit(100)
    .get();
  if (expiredCalls.empty) return;
  const batch = db.batch();
  expiredCalls.docs.forEach(call => {
    batch.update(call.ref, {
      status: "missed",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
});

// One-to-one call lifecycle. Identity and state transitions are server-authoritative.
type CreateCallInput = { conversationId?: unknown; calleeUid?: unknown; kind?: unknown };
type CallActionInput = { callId?: unknown };
function callParticipant(data: Record<string, unknown> | undefined, uid: string): boolean {
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

  await assertNoTeacherStudentPrivateChat(uid, calleeUid);
  const conversationRef = db.collection("conversations").doc(conversationId);
  const callerFriendRef = db.collection("users").doc(uid).collection("friends").doc(calleeUid);
  const calleeFriendRef = db.collection("users").doc(calleeUid).collection("friends").doc(uid);
  const callerBlockRef = db.collection("users").doc(uid).collection("blockedUsers").doc(calleeUid);
  const calleeBlockRef = db.collection("users").doc(calleeUid).collection("blockedUsers").doc(uid);
  const callRef = db.collection("calls").doc();
  await db.runTransaction(async (tx) => {
    const [conversation, callerFriend, calleeFriend, callerBlock, calleeBlock] = await Promise.all([
      tx.get(conversationRef), tx.get(callerFriendRef), tx.get(calleeFriendRef),
      tx.get(callerBlockRef), tx.get(calleeBlockRef),
    ]);
    if (callerBlock.exists || calleeBlock.exists) throw new HttpsError("permission-denied", "لا يمكن بدء مكالمة بسبب إعدادات الحظر.");
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
      offerRevision: 0, answerRevision: -1, iceRestartCount: 0,
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
    const callerUid = String(snap.get("callerUid") ?? "");
    const conversationId = String(snap.get("conversationId") ?? "");
    const [callerBlock, calleeBlock, conversation] = await Promise.all([
      tx.get(db.doc("users/" + callerUid + "/blockedUsers/" + uid)),
      tx.get(db.doc("users/" + uid + "/blockedUsers/" + callerUid)),
      tx.get(db.doc("conversations/" + conversationId)),
    ]);
    const participants = conversation.get("participants");
    if (callerBlock.exists || calleeBlock.exists || !conversation.exists
      || conversation.get("status") === "blocked" || !Array.isArray(participants)
      || !participants.includes(callerUid) || !participants.includes(uid)) {
      tx.update(ref, { status: "ended", endedBy: uid, endedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return;
    }
    if ((snap.get("expiresAt") as Timestamp).toMillis() <= Date.now()) {
      tx.update(ref, { status: "missed", updatedAt: FieldValue.serverTimestamp() });
      return;
    }
    tx.update(ref, { status: decision, updatedAt: FieldValue.serverTimestamp(), respondedAt: FieldValue.serverTimestamp() });
  });
  const latest = await ref.get();
  const finalStatus = latest.get("status");
  if (finalStatus === "missed") return { status: "missed" };
  if (finalStatus !== decision) {
    throw new HttpsError("permission-denied", "تم إنهاء المكالمة أو منعها بسبب الحظر.");
  }
  return { status: decision };
});

type RestartCallIceInput = { callId?: unknown; sdp?: unknown };

export const restartCallIce = onCall<RestartCallIceInput>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const callId = requireUid(request.data?.callId, "معرّف المكالمة غير صالح.");
  const sdp = request.data?.sdp;
  if (typeof sdp !== "string" || sdp.length < 1 || sdp.length > 200000) {
    throw new HttpsError("invalid-argument", "بيانات إعادة الاتصال غير صالحة.");
  }
  const ref = db.collection("calls").doc(callId);
  let offerRevision = 0;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "المكالمة غير موجودة.");
    if (snapshot.get("callerUid") !== uid) {
      throw new HttpsError("permission-denied", "منشئ المكالمة فقط يمكنه بدء إعادة التفاوض.");
    }
    if (snapshot.get("status") !== "accepted" || !snapshot.get("offer")) {
      throw new HttpsError("failed-precondition", "لا يمكن إعادة الاتصال قبل قبول المكالمة.");
    }
    const callerUid = String(snapshot.get("callerUid") ?? "");
    const calleeUid = String(snapshot.get("calleeUid") ?? "");
    const [callerBlock, calleeBlock] = await Promise.all([
      transaction.get(db.doc("users/" + callerUid + "/blockedUsers/" + calleeUid)),
      transaction.get(db.doc("users/" + calleeUid + "/blockedUsers/" + callerUid)),
    ]);
    if (callerBlock.exists || calleeBlock.exists) {
      throw new HttpsError("permission-denied", "تم إيقاف المكالمة بسبب إعدادات الحظر.");
    }
    const nextCount = nextIceRestartCount(Number(snapshot.get("iceRestartCount") ?? 0));
    if (nextCount === null) {
      throw new HttpsError("resource-exhausted", "تم استنفاد محاولات إعادة الاتصال لهذه المكالمة.");
    }
    offerRevision = Number(snapshot.get("offerRevision") ?? 0) + 1;
    transaction.update(ref, {
      offer: { type: "offer", sdp },
      offerRevision,
      iceRestartCount: nextCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { offerRevision };
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


// Return short-lived WebRTC ICE configuration. The shared secret is server-only.
export const getIceServers = onCall({ secrets: [TURN_SECRET] }, async (request) => {
  const allowAnonymous = TURN_ALLOW_ANONYMOUS.value().toLowerCase() === "true";
  const uid = resolveIceUid(request.auth, allowAnonymous);
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول بحساب مسموح لاستخدام إعدادات الاتصال.");

  const rateRef = db.collection("iceServerRateLimits").doc(uid);
  const nowMs = Date.now();
  const limit = Math.max(1, Math.min(60, Number.parseInt(ICE_RATE_LIMIT_PER_MINUTE.value(), 10) || 10));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateRef);
    const state = nextRateLimitState(
      snapshot.exists ? (snapshot.get("windowStartedAt") as Timestamp).toMillis() : undefined,
      snapshot.exists ? snapshot.get("count") as number : undefined,
      nowMs,
      limit,
    );
    if (!state.allowed) {
      throw new HttpsError("resource-exhausted", "طلبات إعداد المكالمة كثيرة؛ انتظر دقيقة ثم أعد المحاولة.");
    }
    transaction.set(rateRef, {
      windowStartedAt: Timestamp.fromMillis(state.windowStartedAtMs),
      count: state.count,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const turnHost = TURN_HOST.value().trim();
  // Do not read TURN credentials when TURN is not configured; this is STUN-only mode.
  const turnSecret = turnHost ? (TURN_SECRET.value() || undefined) : undefined;
  const configuration = createIceServerConfiguration(
    uid,
    turnSecret,
    turnHost,
    TURN_PORT.value(),
    STUN_URLS.value(),
    nowMs,
    Number.parseInt(TURN_TTL_SECONDS.value(), 10) || 3600,
  );
  return {
    iceServers: configuration.iceServers,
    turnAvailable: configuration.configured,
    expiresAt: configuration.expiresAt,
  };
});

export { submitTeacherApplication, reviewTeacherApplication, saveTeacherProfile, scheduleTeacherLiveSession, createTeacherContent, reviewTeacherContent, applyTeacherClaimsOutbox, reconcileTeacherClaims } from "./teacher";

export { blockUser, unblockUser, createGroupConversation, addGroupParticipants } from "./socialSafety";

export { deleteMyAccount } from "./account";

export { academyCurriculumAdminAction } from "./curriculumAdmin";
