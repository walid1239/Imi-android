import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { directConversationId } from "../../../../functions/src/conversationLogic";
import { canPublishLessonSource, validateLessonSource } from "../../../../functions/src/academyContent";
import { NextResponse } from "next/server";
import {
  CoreError, createStatus, sendFriendRequest, createOrGetDirectConversation,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  blockUser, unblockUser, createGroupConversation, addGroupParticipants,
  type StorePort, type TransactionPort,
} from "../../../../functions/src/shared/serverCore";
import { authenticateBearer, publicErrorMessage } from "../../../../functions/src/shared/serverAuth";

type Operation = "createStatus" | "sendFriendRequest" | "createOrGetDirectConversation" | "acceptFriendRequest" | "rejectFriendRequest" | "removeFriend" | "blockUser" | "unblockUser" | "createGroupConversation" | "addGroupParticipants" | "enrollInCourse" | "completeCourseLesson" | "reportAcademyLesson" | "academyAdmin";
const limits: Record<Operation, { count: number; windowMs: number }> = {
  createStatus: { count: 2, windowMs: 60_000 },
  sendFriendRequest: { count: 10, windowMs: 60 * 60_000 },
  createOrGetDirectConversation: { count: 20, windowMs: 60_000 },
  acceptFriendRequest: { count: 30, windowMs: 60_000 },
  rejectFriendRequest: { count: 30, windowMs: 60_000 },
  removeFriend: { count: 10, windowMs: 60_000 },
  blockUser: { count: 10, windowMs: 60_000 },
  unblockUser: { count: 20, windowMs: 60_000 },
  createGroupConversation: { count: 5, windowMs: 60_000 },
  addGroupParticipants: { count: 10, windowMs: 60_000 },
  enrollInCourse: { count: 10, windowMs: 60_000 },
  completeCourseLesson: { count: 30, windowMs: 60_000 },
  reportAcademyLesson: { count: 2, windowMs: 60_000 },
  academyAdmin: { count: 20, windowMs: 60_000 },
};

function adminApp(): App {
  const existing = getApps().find(app => app.name === "imi-server-api");
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const usingEmulators = process.env.IMI_USE_FIREBASE_EMULATORS === "true"
    && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST)
    && Boolean(projectId?.startsWith("demo-"));
  if (!projectId || (!usingEmulators && projectId !== "imi-indroid")) {
    throw new Error("Firebase project configuration is unavailable.");
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId }, "imi-server-api");
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Server credentials are not configured.");
  const serviceAccount = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
  if (serviceAccount.project_id !== projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Server credentials are invalid.");
  }
  return initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]), projectId }, "imi-server-api");
}

function assertOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // Native clients do not send Origin; bearer auth remains mandatory.
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || url.protocol.slice(0, -1);
  const requestOrigin = host ? `${protocol}://${host}` : url.origin;
  if (origin !== requestOrigin && origin !== url.origin) {
    throw new Error("ORIGIN_REJECTED");
  }
}

function makeStore(app: App): StorePort {
  const db = getFirestore(app);
  const auth = getAuth(app);
  return {
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
    getDocument: async path => { const snapshot = await db.doc(path).get(); return { exists: snapshot.exists, data: snapshot.data() ?? {} }; },
    getActiveCalls: async (callerUid, calleeUid) => {
      const snapshot = await db.collection("calls").where("callerUid", "==", callerUid)
        .where("calleeUid", "==", calleeUid).where("status", "in", ["ringing", "accepted"]).get();
      return snapshot.docs.map(item => ({ id: item.id }));
    },
    newId: () => db.collection("_imi_ids").doc().id,
    nowMillis: () => Date.now(),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    timestampFromMillis: value => Timestamp.fromMillis(value),
    timestampToMillis: value => {
      if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") return (value as Timestamp).toMillis();
      if (value instanceof Date) return value.getTime();
      return typeof value === "number" ? value : undefined;
    },
    isVerifiedTeacher: async uid => (await auth.getUser(uid)).customClaims?.teacherVerified === true,
    directConversationId,
  };
}

async function applyRateLimit(app: App, uid: string, operation: Operation): Promise<void> {
  const db = getFirestore(app);
  const policies = operation === "sendFriendRequest"
    ? [{ label: "hour", count: 10, windowMs: 60 * 60_000 }, { label: "day", count: 30, windowMs: 24 * 60 * 60_000 }]
    : [{ label: "window", ...limits[operation] }];
  const now = Date.now();
  const refs = policies.map(policy => {
    const key = createHash("sha256").update(`${operation}:${uid}:${policy.label}`).digest("hex");
    return { ...policy, key, ref: db.doc(`apiRateLimits/${key}`) };
  });
  await db.runTransaction(async tx => {
    const snapshots = await Promise.all(refs.map(item => tx.get(item.ref)));
    for (let index = 0; index < refs.length; index += 1) {
      const policy = refs[index];
      const snapshot = snapshots[index];
      const start = snapshot.exists ? (snapshot.get("windowStartedAt") as Timestamp).toMillis() : now;
      const current = snapshot.exists && now - start < policy.windowMs ? Number(snapshot.get("count") ?? 0) : 0;
      if (current >= policy.count) throw new CoreError("resource-exhausted", "RATE_LIMIT");
      tx.set(policy.ref, {
        operation, uidHash: policy.key, windowStartedAt: Timestamp.fromMillis(current ? start : now),
        count: current + 1,
      });
    }
  });
}

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.trim())) {
    throw new CoreError("invalid-argument", `معرّف ${label} غير صالح.`);
  }
  return value.trim();
}

function academyText(value: unknown, label: string, max: number, optional = false): string {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") throw new CoreError("invalid-argument", `حقل ${label} يجب أن يكون نصاً.`);
  const normalized = value.trim();
  if ((!optional && !normalized) || normalized.length > max) {
    throw new CoreError("invalid-argument", `حقل ${label} فارغ أو يتجاوز الحد المسموح.`);
  }
  return normalized;
}

async function requireAdmin(app: App, uid: string): Promise<void> {
  const user = await getAuth(app).getUser(uid);
  if (user.customClaims?.admin !== true) {
    throw new CoreError("permission-denied", "هذه العملية متاحة لمشرف IMI موثّق فقط.");
  }
}

async function academyAdminAction(app: App, uid: string, body: Record<string, unknown>) {
  await requireAdmin(app, uid);
  const firestore = getFirestore(app);
  const action = body.action;
  const title = (value: unknown, label: string, max: number, optional = false) => academyText(value, label, max, optional);

  if (action === "createCourse") {
    const courseTitle = title(body.title, "العنوان", 120);
    const description = title(body.description, "الوصف", 4000, true);
    const category = title(body.category, "التصنيف", 60);
    const ref = firestore.collection("courses").doc();
    await ref.create({ title: courseTitle, description, category, published: false,
      createdAt: FieldValue.serverTimestamp(), createdBy: uid, updatedAt: FieldValue.serverTimestamp() });
    return { courseId: ref.id, published: false };
  }

  if (action === "createCourseLesson") {
    const courseId = requiredId(body.courseId, "الدورة");
    const lessonTitle = title(body.title, "عنوان الدرس", 120);
    const content = title(body.content, "محتوى الدرس", 20000, true);
    const videoUrl = title(body.videoUrl, "رابط الفيديو", 2048, true);
    if (videoUrl) throw new CoreError("failed-precondition", "رفع الفيديو وروابط الفيديو غير متاحة في المرحلة المجانية الأولى؛ أضف درساً نصياً.");
    const order = body.order === undefined ? 0 : body.order;
    if (typeof order !== "number" || !Number.isSafeInteger(order) || order < 0 || order > 100000) {
      throw new CoreError("invalid-argument", "ترتيب الدرس غير صالح.");
    }
    let source: ReturnType<typeof validateLessonSource>;
    try { source = validateLessonSource(body); }
    catch (error) { throw new CoreError("invalid-argument", error instanceof Error ? error.message : "بيانات مصدر الدرس غير صالحة."); }
    const courseRef = firestore.collection("courses").doc(courseId);
    const lessonRef = courseRef.collection("lessons").doc();
    await firestore.runTransaction(async tx => {
      const course = await tx.get(courseRef);
      if (!course.exists) throw new CoreError("not-found", "الدورة غير موجودة.");
      if (course.get("published") === true) throw new CoreError("failed-precondition", "أوقف نشر الدورة قبل تعديل محتواها.");
      tx.create(lessonRef, {
        title: lessonTitle, content, order, ...source, addedBy: uid, reviewStatus: "draft",
        published: false, createdAt: FieldValue.serverTimestamp(), createdBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { lessonId: lessonRef.id, published: false };
  }

  if (action === "publishCourse") {
    const courseId = requiredId(body.courseId, "الدورة");
    if (typeof body.published !== "boolean") throw new CoreError("invalid-argument", "حدد حالة نشر صحيحة.");
    const courseRef = firestore.collection("courses").doc(courseId);
    await firestore.runTransaction(async tx => {
      const course = await tx.get(courseRef);
      if (!course.exists) throw new CoreError("not-found", "الدورة غير موجودة.");
      if (body.published === true) {
        const lessons = await tx.get(courseRef.collection("lessons"));
        if (lessons.empty) throw new CoreError("failed-precondition", "أضف درساً واحداً على الأقل قبل نشر الدورة.");
      }
      tx.update(courseRef, { published: body.published, updatedAt: FieldValue.serverTimestamp() });
    });
    return { published: body.published };
  }

  if (action === "publishCourseLesson") {
    const courseId = requiredId(body.courseId, "الدورة");
    const lessonId = requiredId(body.lessonId, "الدرس");
    if (typeof body.published !== "boolean") throw new CoreError("invalid-argument", "حدد حالة نشر صحيحة.");
    const courseRef = firestore.collection("courses").doc(courseId);
    const lessonRef = courseRef.collection("lessons").doc(lessonId);
    await firestore.runTransaction(async tx => {
      const [course, lesson] = await Promise.all([tx.get(courseRef), tx.get(lessonRef)]);
      if (!course.exists || !lesson.exists) throw new CoreError("not-found", "الدورة أو الدرس غير موجود.");
      if (body.published === true && course.get("published") !== true) {
        throw new CoreError("failed-precondition", "انشر الدورة أولاً ثم انشر الدرس.");
      }
      if (body.published === true && !canPublishLessonSource(lesson.data() ?? {}, uid)) {
        throw new CoreError("failed-precondition", "لا يمكن نشر الدرس قبل استكمال بيانات المصدر والإذن وتوثيق المراجعة.");
      }
      tx.update(lessonRef, {
        published: body.published,
        ...(body.published === true ? { reviewStatus: "reviewed", reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp() } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { published: body.published };
  }

  if (action === "reviewTeacherContent") {
    const contentId = requiredId(body.contentId, "المحتوى");
    if (typeof body.approved !== "boolean") throw new CoreError("invalid-argument", "بيانات المراجعة غير صالحة.");
    const approved = body.approved;
    const desiredStatus = approved ? "published" : "rejected";
    const ref = firestore.collection("teacherContent").doc(contentId);
    return firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new CoreError("not-found", "المحتوى غير موجود.");
      if (snapshot.get("status") === desiredStatus) return { status: desiredStatus, idempotent: true };
      if (snapshot.get("status") !== "draft") throw new CoreError("failed-precondition", "المحتوى ليس مسودة قابلة للمراجعة.");
      const operationId = `teacher-content-${contentId}-${snapshot.updateTime?.toMillis() ?? Date.now()}`;
      const auditRef = firestore.collection("moderationAudit").doc(operationId);
      const now = FieldValue.serverTimestamp();
      tx.update(ref, {
        status: desiredStatus, published: approved, reviewStatus: approved ? "approved" : "rejected",
        needsHumanReview: !approved, reviewedBy: uid, reviewedAt: now,
        reviewNote: typeof body.note === "string" ? body.note.trim().slice(0, 500) : "",
        updatedAt: now, reviewOperationId: operationId,
      });
      tx.create(auditRef, { actorUid: uid, targetUid: snapshot.get("ownerUid"), contentId,
        action: approved ? "teacher_content_published" : "teacher_content_rejected", operationId, createdAt: now });
      return { status: desiredStatus, idempotent: false };
    });
  }

  if (action === "reviewContentReport") {
    const reportId = requiredId(body.reportId, "البلاغ");
    if (body.status !== "resolved" && body.status !== "dismissed") throw new CoreError("invalid-argument", "حالة مراجعة البلاغ غير صالحة.");
    const note = title(body.note, "ملاحظة المراجعة", 500, true);
    const ref = firestore.collection("contentReports").doc(reportId);
    const logRef = firestore.collection("moderationLogs").doc();
    await firestore.runTransaction(async tx => {
      const report = await tx.get(ref);
      if (!report.exists) throw new CoreError("not-found", "البلاغ غير موجود.");
      if (report.get("status") !== "open") throw new CoreError("failed-precondition", "تمت مراجعة هذا البلاغ مسبقاً.");
      const now = FieldValue.serverTimestamp();
      tx.update(ref, { status: body.status, reviewNote: note, reviewedBy: uid, reviewedAt: now, updatedAt: now });
      tx.create(logRef, { actorUid: uid, action: body.status === "resolved" ? "report_resolved" : "report_dismissed",
        targetType: report.get("targetType") || "unknown", targetId: report.get("lessonId") || report.get("targetId") || reportId,
        reportId, createdAt: now });
    });
    return { status: body.status };
  }

  if (action === "createCurriculumNode") {
    const nodeId = requiredId(body.nodeId, "معرّف عنصر المنهاج");
    if (!/^[a-z0-9][a-z0-9_-]{1,100}$/.test(nodeId)) throw new CoreError("invalid-argument", "معرّف عنصر المنهاج غير صالح.");
    const type = body.type;
    if (!["level", "track", "subject", "unit"].includes(String(type))) throw new CoreError("invalid-argument", "نوع عنصر المنهاج غير صالح.");
    const nameAr = title(body.nameAr, "الاسم العربي", 160);
    const nameFr = title(body.nameFr, "الاسم الفرنسي", 160, true);
    const language = body.language === "fr" ? "fr" : "ar";
    const order = body.order;
    if (typeof order !== "number" || !Number.isSafeInteger(order) || order < 1 || order > 100000) throw new CoreError("invalid-argument", "ترتيب عنصر المنهاج غير صالح.");
    const parentId = body.parentId === null || body.parentId === "" ? null : requiredId(body.parentId, "العنصر الأب");
    const ref = firestore.collection("curriculumNodes").doc(nodeId);
    await firestore.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) throw new CoreError("already-exists", "معرّف عنصر المنهاج مستخدم.");
      if (parentId) {
        const parent = await tx.get(firestore.collection("curriculumNodes").doc(parentId));
        if (!parent.exists) throw new CoreError("not-found", "العنصر الأب غير موجود.");
      }
      tx.create(ref, {
        id: nodeId, parentId, type, nameAr, nameFr, language, order,
        semester: null, officialSource: null, needsReview: true, status: "hidden",
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        createdBy: uid,
      });
    });
    return { nodeId, status: "hidden", needsReview: true };
  }

  if (action === "reorderCurriculumNode") {
    const nodeId = requiredId(body.nodeId, "عنصر المنهاج");
    if (body.delta !== -1 && body.delta !== 1) throw new CoreError("invalid-argument", "قيمة تغيير الترتيب غير صالحة.");
    const ref = firestore.collection("curriculumNodes").doc(nodeId);
    return firestore.runTransaction(async tx => {
      const node = await tx.get(ref);
      if (!node.exists) throw new CoreError("not-found", "عنصر المنهاج غير موجود.");
      const current = node.get("order");
      const order = Math.max(1, (typeof current === "number" && Number.isSafeInteger(current) ? current : 1) + body.delta);
      tx.update(ref, { order, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
      return { nodeId, order };
    });
  }

  if (action === "mergeCurriculumNode") {
    const nodeId = requiredId(body.nodeId, "العنصر المراد دمجه");
    const targetId = requiredId(body.targetId, "العنصر الهدف");
    if (nodeId === targetId) throw new CoreError("invalid-argument", "لا يمكن دمج العنصر في نفسه.");
    const nodes = firestore.collection("curriculumNodes");
    const sourceRef = nodes.doc(nodeId);
    const targetRef = nodes.doc(targetId);
    return firestore.runTransaction(async tx => {
      const [source, target] = await Promise.all([tx.get(sourceRef), tx.get(targetRef)]);
      if (!source.exists || !target.exists) throw new CoreError("not-found", "العنصر المصدر أو الهدف غير موجود.");
      if (source.get("type") !== target.get("type")) throw new CoreError("failed-precondition", "يجب أن يكون العنصران من النوع نفسه.");
      if (target.get("status") !== "published" || target.get("needsReview") === true) {
        throw new CoreError("failed-precondition", "يجب أن يكون العنصر الهدف منشوراً ومعتمداً.");
      }
      let ancestorId = target.get("parentId");
      const seen = new Set<string>([targetId]);
      while (typeof ancestorId === "string" && ancestorId) {
        if (ancestorId === nodeId) throw new CoreError("failed-precondition", "لا يمكن الدمج داخل أحد أحفاد العنصر المصدر.");
        if (seen.has(ancestorId)) throw new CoreError("failed-precondition", "تحتوي شجرة المنهاج على حلقة غير صالحة.");
        seen.add(ancestorId);
        const ancestor = await tx.get(nodes.doc(ancestorId));
        if (!ancestor.exists) break;
        ancestorId = ancestor.get("parentId");
      }
      const children = await tx.get(nodes.where("parentId", "==", nodeId));
      for (const child of children.docs) tx.update(child.ref, { parentId: targetId, updatedAt: FieldValue.serverTimestamp() });
      tx.update(sourceRef, { status: "hidden", needsReview: false, mergedInto: targetId, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
      return { nodeId, targetId, movedChildren: children.size, status: "hidden" };
    });
  }

  if (action === "reviewCurriculumNode") {
    const nodeId = requiredId(body.nodeId, "عنصر المنهاج");
    if (typeof body.approved !== "boolean") throw new CoreError("invalid-argument", "قرار اعتماد المنهاج غير صالح.");
    const approved = body.approved;
    const nodeRef = firestore.collection("curriculumNodes").doc(nodeId);
    const operationId = `curriculum-${nodeId}-${Date.now()}`;
    const auditRef = firestore.collection("moderationAudit").doc(operationId);
    return firestore.runTransaction(async tx => {
      const node = await tx.get(nodeRef);
      if (!node.exists) throw new CoreError("not-found", "عنصر المنهاج غير موجود.");
      const desiredStatus = approved ? "published" : "hidden";
      const desiredReview = !approved;
      if (node.get("status") === desiredStatus && node.get("needsReview") === desiredReview) {
        return { status: desiredStatus, needsReview: desiredReview, idempotent: true, operationId };
      }
      if (approved && node.get("needsReview") !== true) throw new CoreError("failed-precondition", "هذا العنصر لا ينتظر اعتماداً جديداً.");
      const parentId = node.get("parentId");
      if (approved && typeof parentId === "string") {
        const parent = await tx.get(firestore.collection("curriculumNodes").doc(parentId));
        if (!parent.exists || parent.get("status") !== "published" || parent.get("needsReview") === true) {
          throw new CoreError("failed-precondition", "اعتمد العنصر الأب أولاً قبل نشر هذا العنصر.");
        }
      }
      const now = FieldValue.serverTimestamp();
      tx.update(nodeRef, { status: desiredStatus, needsReview: desiredReview, reviewedBy: uid, reviewedAt: now, updatedAt: now });
      tx.create(auditRef, { actorUid: uid, action: approved ? "curriculum_node_approved" : "curriculum_node_rejected",
        targetType: "curriculumNode", targetId: nodeId, operationId, createdAt: now });
      return { status: desiredStatus, needsReview: desiredReview, idempotent: false, operationId };
    });
  }

  if (action === "reviewTeacherApplication") {
    const targetUid = requiredId(body.uid, "حساب الأستاذ");
    if (typeof body.approved !== "boolean") throw new CoreError("invalid-argument", "قرار المراجعة غير صالح.");
    const approved = body.approved;
    const desiredStatus = approved ? "approved" : "rejected";
    const note = title(body.note, "ملاحظة المراجعة", 500, true);
    const applicationRef = firestore.collection("teacherApplications").doc(targetUid);
    const result = await firestore.runTransaction(async tx => {
      const application = await tx.get(applicationRef);
      if (!application.exists) throw new CoreError("not-found", "طلب الأستاذ غير موجود.");
      if (application.get("status") === desiredStatus) {
        const existingOperation = application.get("reviewOperationId");
        const operationId = typeof existingOperation === "string" && existingOperation
          ? existingOperation
          : `route-teacher-${targetUid}-${application.updateTime?.toMillis() ?? 0}`;
        return { operationId, idempotent: true };
      }
      if (application.get("status") !== "pending") {
        throw new CoreError("failed-precondition", "تمت مراجعة هذا الطلب بقرار مختلف أو لم يعد قيد الانتظار.");
      }
      const operationId = `route-teacher-${targetUid}-${application.updateTime?.toMillis() ?? Date.now()}`;
      const outboxRef = firestore.collection("teacherClaimsOutbox").doc(operationId);
      const auditRef = firestore.collection("moderationAudit").doc(operationId);
      tx.update(applicationRef, {
        status: desiredStatus, reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp(),
        reviewNote: note, reviewOperationId: operationId,
      });
      tx.create(auditRef, {
        actorUid: uid, targetUid,
        action: approved ? "teacher_application_approved" : "teacher_application_rejected",
        note, operationId, createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(outboxRef, {
        operationId, targetUid, desiredTeacher: approved, status: "pending",
        attempts: 0, actorUid: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      return { operationId, idempotent: false };
    });
    const target = await getAuth(app).getUser(targetUid);
    const claims = { ...(target.customClaims ?? {}) };
    if (approved) { claims.teacher = true; claims.teacherVerified = true; }
    else { delete claims.teacher; delete claims.teacherVerified; }
    await getAuth(app).setCustomUserClaims(targetUid, claims);
    await firestore.collection("teacherClaimsOutbox").doc(result.operationId).set({
      status: "applied", appliedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      attempts: FieldValue.increment(1),
    }, { merge: true });
    return { status: desiredStatus, claimsSync: "applied", idempotent: result.idempotent };
  }

  throw new CoreError("invalid-argument", "عملية إدارة الأكاديمية غير معروفة.");
}

async function enrollInCourse(app: App, uid: string, body: Record<string, unknown>) {
  const firestore = getFirestore(app);
  const courseId = requiredId(body.courseId, "الدورة");
  const courseRef = firestore.collection("courses").doc(courseId);
  const enrollmentRef = firestore.collection("users").doc(uid).collection("enrollments").doc(courseId);
  return firestore.runTransaction(async tx => {
    const [course, enrollment] = await Promise.all([tx.get(courseRef), tx.get(enrollmentRef)]);
    if (!course.exists || course.get("published") !== true) {
      throw new CoreError("not-found", "هذه الدورة غير متاحة حالياً.");
    }
    if (!enrollment.exists) {
      tx.create(enrollmentRef, {
        courseId, completedLessonIds: [],
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return { status: "enrolled" as const };
  });
}

async function completeCourseLesson(app: App, uid: string, body: Record<string, unknown>) {
  const firestore = getFirestore(app);
  const courseId = requiredId(body.courseId, "الدورة");
  const lessonId = requiredId(body.lessonId, "الدرس");
  const courseRef = firestore.collection("courses").doc(courseId);
  const lessonRef = courseRef.collection("lessons").doc(lessonId);
  const enrollmentRef = firestore.collection("users").doc(uid).collection("enrollments").doc(courseId);
  await firestore.runTransaction(async tx => {
    const [course, lesson, enrollment] = await Promise.all([
      tx.get(courseRef), tx.get(lessonRef), tx.get(enrollmentRef),
    ]);
    if (!course.exists || course.get("published") !== true || !lesson.exists || lesson.get("published") !== true) {
      throw new CoreError("not-found", "الدورة أو الدرس غير متاح.");
    }
    if (!enrollment.exists) {
      throw new CoreError("failed-precondition", "سجّل في الدورة قبل إكمال الدروس.");
    }
    const completed = enrollment.get("completedLessonIds");
    if (Array.isArray(completed) && completed.includes(lessonId)) return;
    tx.update(enrollmentRef, {
      completedLessonIds: FieldValue.arrayUnion(lessonId),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: "completed", courseId, lessonId };
}

async function reportAcademyLesson(app: App, uid: string, body: Record<string, unknown>) {
  const firestore = getFirestore(app);
  const courseId = requiredId(body.courseId, "الدورة");
  const lessonId = requiredId(body.lessonId, "الدرس");
  const reason = academyText(body.reason, "سبب البلاغ", 32);
  if (!["incorrect", "inappropriate", "copyright", "other"].includes(reason)) {
    throw new CoreError("invalid-argument", "سبب البلاغ غير مدعوم.");
  }
  const details = academyText(body.details, "تفاصيل البلاغ", 500, true);
  const courseRef = firestore.collection("courses").doc(courseId);
  const lessonRef = courseRef.collection("lessons").doc(lessonId);
  const rateRef = firestore.collection("reportRateLimits").doc(uid);
  const reportRef = firestore.collection("contentReports").doc();
  await firestore.runTransaction(async tx => {
    const [course, lesson, rate] = await Promise.all([tx.get(courseRef), tx.get(lessonRef), tx.get(rateRef)]);
    if (!course.exists || course.get("published") !== true || !lesson.exists || lesson.get("published") !== true) {
      throw new CoreError("not-found", "المحتوى غير متاح للإبلاغ.");
    }
    const now = Timestamp.now();
    const lastReportAt = rate.get("lastReportAt") as Timestamp | undefined;
    if (lastReportAt && now.toMillis() - lastReportAt.toMillis() < 30_000) {
      throw new CoreError("resource-exhausted", "انتظر 30 ثانية قبل إرسال بلاغ آخر.");
    }
    tx.create(reportRef, {
      reporterUid: uid, targetType: "academyLesson", courseId, lessonId, reason, details,
      status: "open", createdAt: now, updatedAt: now,
    });
    tx.set(rateRef, { uid, lastReportAt: now, updatedAt: now }, { merge: true });
  });
  return { status: "submitted", reportId: reportRef.id };
}

export async function handleImiPost(request: Request, operation: Operation): Promise<Response> {
  try {
    assertOrigin(request);
    if (request.method !== "POST") return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
    if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8192) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const app = adminApp();
    const uid = await authenticateBearer(request.headers.get("authorization"), {
      verifyIdToken: token => getAuth(app).verifyIdToken(token, true),
    });
    await applyRateLimit(app, uid, operation);
    const store = makeStore(app);
    const handlers = {
      createStatus: () => createStatus(store, uid, body),
      sendFriendRequest: () => sendFriendRequest(store, uid, body),
      createOrGetDirectConversation: () => createOrGetDirectConversation(store, uid, body),
      acceptFriendRequest: () => acceptFriendRequest(store, uid, body),
      rejectFriendRequest: () => rejectFriendRequest(store, uid, body),
      removeFriend: () => removeFriend(store, uid, body),
      blockUser: () => blockUser(store, uid, body),
      unblockUser: () => unblockUser(store, uid, body),
      createGroupConversation: () => createGroupConversation(store, uid, body),
      addGroupParticipants: () => addGroupParticipants(store, uid, body),
      enrollInCourse: () => enrollInCourse(app, uid, body),
      completeCourseLesson: () => completeCourseLesson(app, uid, body),
      reportAcademyLesson: () => reportAcademyLesson(app, uid, body),
      academyAdmin: () => academyAdminAction(app, uid, body),
    };
    const result = await handlers[operation]();
    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "ORIGIN_REJECTED") {
      return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return NextResponse.json({ error: "تم تجاوز حد الطلبات؛ حاول لاحقاً." }, { status: 429 });
    }
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "unauthenticated") {
      const mapped = publicErrorMessage(error);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    const mapped = publicErrorMessage(error);
    if (mapped.status !== 500) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    // No exception text, tokens, service-account data or Firebase response bodies are returned or logged.
    return NextResponse.json({ error: "الخدمة غير متاحة حالياً أو حدث خطأ داخلي." }, { status: 503 });
  }
}
