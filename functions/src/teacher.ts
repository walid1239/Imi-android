import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { mockLiveProvider } from "./liveProvider";

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
  if (docs.some(doc => !doc.exists || doc.get("status") !== "published" || doc.get("type") !== type)) {
    throw new HttpsError("failed-precondition", "تتضمن الاختيارات عقدة غير منشورة أو من نوع غير صحيح.");
  }
  return ids;
}

export const submitTeacherApplication = onCall<AppInput>(async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
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
  const targetUid = uid(request.data?.uid);
  if (typeof request.data?.approved !== "boolean") throw new HttpsError("invalid-argument", "قرار المراجعة غير صالح.");
  const approved = request.data.approved;
  const note = typeof request.data.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  const db = getFirestore(), ref = db.collection("teacherApplications").doc(targetUid);
  const application = await ref.get();
  if (!application.exists || application.get("status") !== "pending") {
    throw new HttpsError("failed-precondition", "لا يوجد طلب توثيق قيد المراجعة.");
  }
  const user = await getAuth().getUser(targetUid);
  const claims: Record<string, unknown> = { ...(user.customClaims ?? {}) };
  if (approved) { claims.teacher = true; claims.teacherVerified = true; }
  else { delete claims.teacher; delete claims.teacherVerified; }
  await getAuth().setCustomUserClaims(targetUid, claims);
  await ref.update({
    status: approved ? "approved" : "rejected", reviewedBy: request.auth.uid,
    reviewedAt: FieldValue.serverTimestamp(), reviewNote: note,
  });
  await db.collection("moderationAudit").add({
    actorUid: request.auth.uid, targetUid,
    action: approved ? "teacher_application_approved" : "teacher_application_rejected",
    note, createdAt: FieldValue.serverTimestamp(),
  });
  return { status: approved ? "approved" : "rejected" };
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
  await getFirestore().collection("teacherProfiles").doc(userId).set({
    uid: userId, bio, photoPath, subjectIds, levelIds, verified: true, badge: "أستاذ موثّق",
    contentAgreement: true, childSafetyAgreement: true, profileComplete: true, published: true,
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
