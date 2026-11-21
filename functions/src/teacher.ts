import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { applyTeacherClaimsOutboxOperation } from "./teacherClaimsOutbox";
import { mockLiveProvider } from "./liveProvider";
import { createTeacherAgreementAcceptances } from "./teacherAgreements";

type AppInput = { fullName?: unknown; subjectIds?: unknown; levelIds?: unknown; evidencePath?: unknown };
type ProfileInput = { photoPath?: unknown; bio?: unknown; subjectIds?: unknown; levelIds?: unknown; contentAgreement?: unknown; childSafetyAgreement?: unknown };
type ReviewInput = { uid?: unknown; approved?: unknown; note?: unknown };
type LiveInput = { title?: unknown; subjectId?: unknown; startsAt?: unknown };

function clean(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length >= min && result.length <= max ? result : null;
}
function uid(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{2,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", "معرّف الحساب غير صالح.");
  }
  return value;
}
async function curriculumIds(value: unknown, type: "level" | "subject"): Promise<string[]> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12
    || value.some(id => typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]{1,100}$/.test(id))) {
    throw new HttpsError("invalid-argument", "اختيارات المستوى أو المواد غير صالحة.");
  }
  const ids = [...new Set(value as string[])];
  const db = getFirestore();
  const docs = await Promise.all(ids.map(id => db.collection("curriculumNodes").doc(id).get()));
  if (docs.some(doc => !doc.exists || doc.get("status") !== "published" || doc.get("needsReview") === true || doc.get("type") !== type)) {
    throw new HttpsError("failed-precondition", "تتضمن الاختيارات عقدة غير منشورة أو من نوع غير صحيح.");
  }
  return ids;
}

export const submitTeacherApplication = onCall<AppInput>(async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  if (request.auth?.token.teacherVerified === true) throw new HttpsError("already-exists", "هذا الحساب موثق كأستاذ بالفعل.");
  const fullName = clean(request.data?.fullName, 3, 80);
  const evidencePath = clean(request.data?.evidencePath, 10, 300);
  if (!fullName) throw new HttpsError("invalid-argument", "الاسم الكامل مطلوب.");
  if (!evidencePath || !evidencePath.startsWith("teacher-verification/" + userId + "/") || evidencePath.includes("..")) {
    throw new HttpsError("invalid-argument", "مسار وثيقة الإثبات غير صالح.");
  }
  const [subjectIds, levelIds] = await Promise.all([
    curriculumIds(request.data?.subjectIds, "subject"), curriculumIds(request.data?.levelIds, "level"),
  ]);
  let metadata: { size?: string | number; contentType?: string };
  try {
    const [file] = await getStorage().bucket().file(evidencePath).getMetadata();
    metadata = file;
  } catch {
    throw new HttpsError("failed-precondition", "ارفع وثيقة الإثبات الخاصة أولاً.");
  }
  const size = Number(metadata.size ?? 0);
  if (size <= 0 || size > 10 * 1024 * 1024
    || !["application/pdf", "image/jpeg", "image/png"].includes(metadata.contentType ?? "")) {
    throw new HttpsError("invalid-argument", "يسمح بملف PDF أو صورة JPEG/PNG لا يتجاوز حجمها 10 ميغابايت.");
  }
  const ref = getFirestore().collection("teacherApplications").doc(userId);
  const old = await ref.get();
  if (old.exists && old.get("status") === "pending") {
    throw new HttpsError("already-exists", "لديك طلب توثيق قيد المراجعة بالفعل.");
  }
  await ref.set({
    uid: userId, fullName, subjectIds, levelIds, evidencePath, status: "pending",
    submittedAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: null,
  });
  return { status: "pending" };
});

export const reviewTeacherApplication = onCall<ReviewInput>(async request => {
  if (request.auth?.token.admin !== true) throw new HttpsError("permission-denied", "المشرف الموثق فقط يمكنه مراجعة الطلبات.");
  const actorUid = request.auth.uid;
  const targetUid = uid(request.data?.uid);
  if (typeof request.data?.approved !== "boolean") throw new HttpsError("invalid-argument", "قرار المراجعة غير صالح.");
  const approved = request.data.approved;
  const desiredStatus = approved ? "approved" : "rejected";
  const note = typeof request.data.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  const db = getFirestore(), ref = db.collection("teacherApplications").doc(targetUid);

  const result = await db.runTransaction(async transaction => {
    const application = await transaction.get(ref);
    if (!application.exists) throw new HttpsError("not-found", "طلب الأستاذ غير موجود.");
    if (application.get("status") === desiredStatus) {
      return { status: desiredStatus, operationId: String(application.get("reviewOperationId") ?? ""), idempotent: true };
    }
    if (application.get("status") !== "pending") {
      throw new HttpsError("failed-precondition", "تمت مراجعة هذا الطلب بقرار مختلف أو لم يعد قيد الانتظار.");
    }
    const operationId = `teacher-${targetUid}-${application.updateTime?.toMillis() ?? Date.now()}`;
    const auditRef = db.collection("moderationAudit").doc(operationId);
    const outboxRef = db.collection("teacherClaimsOutbox").doc(operationId);
    const now = FieldValue.serverTimestamp();
    transaction.update(ref, {
      status: desiredStatus, reviewedBy: actorUid, reviewedAt: now,
      reviewNote: note, reviewOperationId: operationId,
    });
    transaction.create(auditRef, {
      actorUid, targetUid,
      action: approved ? "teacher_application_approved" : "teacher_application_rejected",
      note, operationId, createdAt: now,
    });
    transaction.create(outboxRef, {
      operationId, targetUid, desiredTeacher: approved, status: "pending",
      attempts: 0, actorUid, createdAt: now, updatedAt: now,
    });
    return { status: desiredStatus, operationId, idempotent: false };
  });
  return { ...result, claimsSync: result.operationId ? "queued" : "reconciliation_required" };
});

export const saveTeacherProfile = onCall<ProfileInput>(async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  if (request.auth?.token.teacherVerified !== true) throw new HttpsError("permission-denied", "يجب توثيق حساب الأستاذ أولاً.");
  const photoPath = clean(request.data?.photoPath, 10, 300);
  const bio = clean(request.data?.bio, 30, 1200);
  if (!photoPath || !photoPath.startsWith("teachers/" + userId + "/avatar/") || photoPath.includes("..") || !bio) {
    throw new HttpsError("invalid-argument", "أكمل الصورة الشخصية والنبذة.");
  }
  if (request.data?.contentAgreement !== true || request.data?.childSafetyAgreement !== true) {
    throw new HttpsError("failed-precondition", "يجب قبول اتفاقية المحتوى والحقوق وقواعد حماية القاصرين.");
  }
  const [subjectIds, levelIds] = await Promise.all([
    curriculumIds(request.data?.subjectIds, "subject"), curriculumIds(request.data?.levelIds, "level"),
  ]);
  let metadata: { size?: string | number; contentType?: string };
  try { const [file] = await getStorage().bucket().file(photoPath).getMetadata(); metadata = file; }
  catch { throw new HttpsError("failed-precondition", "صورة الأستاذ غير موجودة."); }
  if (!String(metadata.contentType ?? "").startsWith("image/") || Number(metadata.size ?? 0) > 5 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "الصورة غير صالحة أو تتجاوز 5 ميغابايت.");
  }
  const application = await getFirestore().collection("teacherApplications").doc(userId).get();
  const displayName = typeof application.get("fullName") === "string" ? application.get("fullName") : "أستاذ IMI";
  await getFirestore().collection("teacherProfiles").doc(userId).set({
    uid: userId, displayName, bio, photoPath, subjectIds, levelIds, verified: true, badge: "أستاذ موثّق",
    contentAgreement: true, childSafetyAgreement: true,
    agreementAcceptances: createTeacherAgreementAcceptances(userId, FieldValue.serverTimestamp()),
    profileComplete: true, published: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { profileComplete: true };
});

export const scheduleTeacherLiveSession = onCall<LiveInput>(async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  if (request.auth?.token.teacherVerified !== true) throw new HttpsError("permission-denied", "جدولة البث للأستاذ الموثق فقط.");
  const title = clean(request.data?.title, 4, 120);
  const subjectId = clean(request.data?.subjectId, 2, 110);
  const startsAtText = clean(request.data?.startsAt, 10, 40);
  const startsAt = startsAtText ? new Date(startsAtText) : null;
  if (!title || !subjectId || !startsAt || !Number.isFinite(startsAt.getTime())
    || startsAt.getTime() < Date.now() + 5 * 60_000 || startsAt.getTime() > Date.now() + 180 * 86400_000) {
    throw new HttpsError("invalid-argument", "عنوان البث أو المادة أو الموعد غير صالح.");
  }
  const db = getFirestore(), profile = await db.collection("teacherProfiles").doc(userId).get();
  if (!profile.exists || profile.get("profileComplete") !== true || profile.get("published") !== true
    || profile.get("contentAgreement") !== true || profile.get("childSafetyAgreement") !== true
    || !Array.isArray(profile.get("subjectIds")) || !profile.get("subjectIds").includes(subjectId)) {
    throw new HttpsError("failed-precondition", "أكمل صفحة الأستاذ المنشورة والاتفاقيات واختر مادة ضمن ملفك قبل جدولة البث.");
  }
  const ref = db.collection("teacherLiveSessions").doc();
  const plan = await mockLiveProvider.schedule({
    sessionId: ref.id, teacherUid: userId, title, subjectId, startsAt,
  });
  await ref.create({
    id: ref.id, teacherUid: userId, title, subjectId, startsAt: Timestamp.fromDate(startsAt),
    ...plan, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return { sessionId: ref.id, status: "mock_scheduled", liveEnabled: false };
});


type TeacherContentInput = {
  contentId?: unknown; title?: unknown; content?: unknown; kind?: unknown;
  levelId?: unknown; trackId?: unknown; subjectId?: unknown; unitId?: unknown;
  mediaPath?: unknown; contentType?: unknown; fileName?: unknown;
  sourceType?: unknown; sourceName?: unknown; sourceUrl?: unknown;
  license?: unknown; permissionNote?: unknown;
};
type ReviewTeacherContentInput = { contentId?: unknown; approved?: unknown; note?: unknown };

async function curriculumNode(idValue: unknown, expectedType: "level" | "track" | "subject" | "unit") {
  const id = clean(idValue, 2, 110);
  if (!id) throw new HttpsError("invalid-argument", "اختيار المنهاج غير صالح.");
  const snapshot = await getFirestore().collection("curriculumNodes").doc(id).get();
  if (!snapshot.exists || snapshot.get("status") !== "published" || snapshot.get("needsReview") === true || snapshot.get("type") !== expectedType) {
    throw new HttpsError("failed-precondition", "يجب اختيار عقدة منشورة صحيحة من شجرة المنهاج.");
  }
  return { id, data: snapshot.data()! };
}

export const createTeacherContent = onCall<TeacherContentInput>(async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  if (request.auth?.token.teacherVerified !== true) throw new HttpsError("permission-denied", "النشر متاح للأستاذ الموثق فقط.");
  const db = getFirestore(), profile = await db.collection("teacherProfiles").doc(userId).get();
  if (!profile.exists || profile.get("profileComplete") !== true || profile.get("published") !== true
    || profile.get("contentAgreement") !== true || profile.get("childSafetyAgreement") !== true) {
    throw new HttpsError("failed-precondition", "أكمل صفحة الأستاذ والاتفاقيات قبل إضافة المحتوى.");
  }
  const contentId = clean(request.data?.contentId, 8, 128);
  const title = clean(request.data?.title, 4, 140);
  const kind = request.data?.kind;
  if (!contentId || !/^[A-Za-z0-9_-]+$/.test(contentId) || !title
    || !["text", "video", "image", "pdf", "embed"].includes(String(kind))) {
    throw new HttpsError("invalid-argument", "عنوان المحتوى أو نوعه أو معرّفه غير صالح.");
  }
  const [level, track, subject] = await Promise.all([
    curriculumNode(request.data?.levelId, "level"),
    curriculumNode(request.data?.trackId, "track"),
    curriculumNode(request.data?.subjectId, "subject"),
  ]);
  if (track.data.parentId !== level.id || subject.data.parentId !== track.id) {
    throw new HttpsError("failed-precondition", "ترتيب المستوى والشعبة والمادة غير متطابق في شجرة المنهاج.");
  }
  let unitId: string | null = null;
  if (request.data?.unitId) {
    const unit = await curriculumNode(request.data.unitId, "unit");
    if (unit.data.parentId !== subject.id) throw new HttpsError("failed-precondition", "الوحدة لا تتبع المادة المختارة.");
    unitId = unit.id;
  }
  const sourceType = request.data?.sourceType;
  const sourceName = clean(request.data?.sourceName, 2, 120);
  const license = clean(request.data?.license, 2, 200);
  const permissionNote = clean(request.data?.permissionNote, 5, 600);
  const sourceUrl = typeof request.data?.sourceUrl === "string" ? request.data.sourceUrl.trim() : "";
  if (!["original", "teacher-agreement", "official", "open-license", "embed"].includes(String(sourceType))
    || !sourceName || !license || !permissionNote
    || (sourceType !== "original" && (!/^https:\/\//i.test(sourceUrl) || sourceUrl.length > 500))) {
    throw new HttpsError("invalid-argument", "بيانات المصدر والترخيص والإذن مطلوبة قبل حفظ المحتوى.");
  }
  const body = typeof request.data?.content === "string" ? request.data.content.trim() : "";
  if (kind === "text" && body.length < 50) throw new HttpsError("invalid-argument", "الدرس النصي يجب أن يحتوي على 50 حرفاً على الأقل.");
  if (kind === "embed") {
    let host = "";
    try { host = new URL(sourceUrl).hostname.toLowerCase(); } catch { /* invalid URL is rejected below */ }
    if (sourceType !== "embed" || !["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(host)) {
      throw new HttpsError("invalid-argument", "يسمح فقط بتضمين رابط يوتيوب صالح.");
    }
  }
  if (body.length > 20000) throw new HttpsError("invalid-argument", "محتوى الدرس يتجاوز الحد المسموح.");
  let mediaPath: string | null = null, contentType: string | null = null, fileName: string | null = null;
  if (kind !== "text" && kind !== "embed") {
    mediaPath = clean(request.data?.mediaPath, 10, 400);
    contentType = clean(request.data?.contentType, 3, 100);
    fileName = clean(request.data?.fileName, 1, 120);
    if (!mediaPath || !mediaPath.startsWith("teacher-content/" + userId + "/" + contentId + "/") || mediaPath.includes("..") || !contentType || !fileName) {
      throw new HttpsError("invalid-argument", "مسار الملف أو بياناته غير صالحة.");
    }
    let metadata: { size?: string | number; contentType?: string };
    try { const [file] = await getStorage().bucket().file(mediaPath).getMetadata(); metadata = file; }
    catch { throw new HttpsError("failed-precondition", "ارفع الملف إلى مساحة الأستاذ الخاصة أولاً."); }
    const size = Number(metadata.size ?? 0), actualType = String(metadata.contentType ?? "");
    const allowed = kind === "video"
      ? actualType === "video/mp4" || actualType === "video/webm"
      : kind === "image"
        ? ["image/jpeg", "image/png", "image/webp"].includes(actualType)
        : actualType === "application/pdf";
    const max = kind === "video" ? 100 * 1024 * 1024 : kind === "image" ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (!allowed || size <= 0 || size > max || actualType !== contentType) {
      throw new HttpsError("invalid-argument", "نوع الملف أو حجمه غير مسموح.");
    }
  }
  const ref = db.collection("teacherContent").doc(contentId);
  if ((await ref.get()).exists) throw new HttpsError("already-exists", "معرّف المحتوى مستخدم بالفعل.");
  await ref.create({
    id: contentId, ownerUid: userId, title, body, kind,
    levelId: level.id, trackId: track.id, subjectId: subject.id, unitId,
    curriculumNodeIds: [level.id, track.id, subject.id, ...(unitId ? [unitId] : [])],
    mediaPath, contentType, fileName,
    sourceType, sourceName, sourceUrl: sourceUrl || null, license, permissionNote,
    reviewTier: "light", reviewStatus: "pending", needsHumanReview: true,
    status: "draft", published: false,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return { contentId, status: "draft", needsHumanReview: true };
});

export const reviewTeacherContent = onCall<ReviewTeacherContentInput>(async request => {
  if (request.auth?.token.admin !== true) throw new HttpsError("permission-denied", "المشرف الموثق فقط يمكنه مراجعة المحتوى.");
  const actorUid = request.auth.uid;
  const contentId = clean(request.data?.contentId, 8, 128);
  if (!contentId || !/^[A-Za-z0-9_-]+$/.test(contentId) || typeof request.data?.approved !== "boolean") {
    throw new HttpsError("invalid-argument", "بيانات المراجعة غير صالحة.");
  }
  const approved = request.data.approved;
  const desiredStatus = approved ? "published" : "rejected";
  const db = getFirestore(), ref = db.collection("teacherContent").doc(contentId);
  return db.runTransaction(async transaction => {
    const content = await transaction.get(ref);
    if (!content.exists) throw new HttpsError("not-found", "المحتوى غير موجود.");
    if (content.get("status") === desiredStatus) return { status: desiredStatus, idempotent: true };
    if (content.get("status") !== "draft") throw new HttpsError("failed-precondition", "المحتوى ليس مسودة قابلة للمراجعة.");
    const operationId = `teacher-content-${contentId}-${content.updateTime?.toMillis() ?? Date.now()}`;
    const auditRef = db.collection("moderationAudit").doc(operationId);
    const now = FieldValue.serverTimestamp();
    transaction.update(ref, {
      status: desiredStatus, published: approved,
      reviewStatus: approved ? "approved" : "rejected",
      needsHumanReview: !approved,
      reviewedBy: actorUid, reviewedAt: now,
      reviewNote: typeof request.data.note === "string" ? request.data.note.trim().slice(0, 500) : "",
      updatedAt: now, reviewOperationId: operationId,
    });
    transaction.create(auditRef, {
      actorUid, targetUid: content.get("ownerUid"),
      contentId, action: approved ? "teacher_content_published" : "teacher_content_rejected",
      operationId, createdAt: now,
    });
    return { status: desiredStatus, idempotent: false };
  });
});

async function applyTeacherClaimsOperation(operationId: string, operation: { targetUid: string; desiredTeacher: boolean }) {
  const db = getFirestore();
  const outboxRef = db.collection("teacherClaimsOutbox").doc(operationId);
  await applyTeacherClaimsOutboxOperation(operation, {
    getUser: async targetUid => {
      const user = await getAuth().getUser(targetUid);
      return { customClaims: user.customClaims ?? {} };
    },
    setCustomClaims: async (targetUid, claims) => getAuth().setCustomUserClaims(targetUid, claims),
    markApplied: async () => {
      await db.runTransaction(async transaction => {
        const current = await transaction.get(outboxRef);
        if (!current.exists || current.get("status") === "applied") return;
        transaction.update(outboxRef, {
          status: "applied", appliedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(), lastError: FieldValue.delete(),
          attempts: FieldValue.increment(1),
        });
      });
    },
    markPending: async error => {
      await outboxRef.set({
        status: "pending", updatedAt: FieldValue.serverTimestamp(),
        attempts: FieldValue.increment(1),
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown Auth claim synchronization error",
      }, { merge: true });
    },
  });
}

export const applyTeacherClaimsOutbox = onDocumentCreated(
  { document: "teacherClaimsOutbox/{operationId}", retry: true },
  async event => {
    const snapshot = event.data;
    if (!snapshot) return;
    const data = snapshot.data();
    if (typeof data.targetUid !== "string" || typeof data.desiredTeacher !== "boolean") {
      throw new Error("Invalid teacher claims outbox record.");
    }
    await applyTeacherClaimsOperation(event.params.operationId, {
      targetUid: data.targetUid, desiredTeacher: data.desiredTeacher,
    });
  },
);

export const reconcileTeacherClaims = onSchedule("every 15 minutes", async () => {
  const db = getFirestore();
  const pending = await db.collection("teacherClaimsOutbox").where("status", "==", "pending").limit(100).get();
  for (const operation of pending.docs) {
    const data = operation.data();
    if (typeof data.targetUid !== "string" || typeof data.desiredTeacher !== "boolean") continue;
    try {
      await applyTeacherClaimsOperation(operation.id, {
        targetUid: data.targetUid, desiredTeacher: data.desiredTeacher,
      });
    } catch {
      // Keep processing other outbox entries; the next scheduled pass retries failures.
    }
  }

  const reviewed = await db.collection("teacherApplications")
    .where("status", "in", ["approved", "rejected"])
    .orderBy("reviewedAt", "desc")
    .limit(100)
    .get();
  for (const application of reviewed.docs) {
    const targetUid = application.id;
    const desiredTeacher = application.get("status") === "approved";
    try {
      const user = await getAuth().getUser(targetUid);
      const current = user.customClaims ?? {};
      const matches = desiredTeacher
        ? current.teacher === true && current.teacherVerified === true
        : current.teacher !== true && current.teacherVerified !== true;
      if (matches) continue;
      const operationId = String(application.get("reviewOperationId") ?? `legacy-${targetUid}-${application.updateTime?.toMillis() ?? 0}`);
      await applyTeacherClaimsOutboxOperation({ targetUid, desiredTeacher }, {
        getUser: async () => ({ customClaims: current }),
        setCustomClaims: async (_uid, claims) => getAuth().setCustomUserClaims(targetUid, claims),
        markApplied: async () => { await db.collection("teacherClaimsReconciliation").doc(operationId).set({
          targetUid, desiredTeacher, detectedMismatch: true,
          repairedAt: FieldValue.serverTimestamp(), status: "repaired",
        }, { merge: true }); },
        markPending: async error => { await db.collection("teacherClaimsReconciliation").doc(operationId).set({
          targetUid, desiredTeacher, detectedMismatch: true,
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
          checkedAt: FieldValue.serverTimestamp(), status: "pending",
        }, { merge: true }); },
      });
    } catch {
      // Auth or Firestore may be temporarily unavailable; retry on the next scheduled pass.
    }
  }
});
