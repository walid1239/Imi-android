import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { reserveRateLimitWindows } from "./rate-limit-core.mjs";
import { applyTeacherClaimsOutboxOperation } from "../../../../functions/src/teacherClaimsOutbox";
import { createTeacherAgreementAcceptances } from "../../../../functions/src/teacherAgreements";
import { cleanupAccountData } from "../../../../functions/src/shared/accountDeletion";
import { directConversationId } from "../../../../functions/src/conversationLogic";
import { NextResponse } from "next/server";
import {
  createStatus, sendFriendRequest, createOrGetDirectConversation,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  blockUser, unblockUser, createGroupConversation, addGroupParticipants,
  type StorePort, type TransactionPort, CoreError,
} from "../../../../functions/src/shared/serverCore";
import { authenticateBearer, publicErrorMessage } from "../../../../functions/src/shared/serverAuth";

type Operation = "submitTeacherApplication" | "reviewTeacherApplication" | "saveTeacherProfile" | "publishCurriculum" | "createStatus" | "sendFriendRequest" | "createOrGetDirectConversation" | "acceptFriendRequest" | "rejectFriendRequest" | "removeFriend" | "blockUser" | "unblockUser" | "createGroupConversation" | "addGroupParticipants" | "prepareReel" | "submitReel" | "reviewReel" | "deleteMyAccount";
const limits: Record<Operation, { count: number; windowMs: number }> = {
  submitTeacherApplication: { count: 3, windowMs: 24 * 60 * 60_000 },
  reviewTeacherApplication: { count: 60, windowMs: 60_000 },
  saveTeacherProfile: { count: 5, windowMs: 60_000 },
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
  prepareReel: { count: 3, windowMs: 60 * 60_000 },
  submitReel: { count: 3, windowMs: 60 * 60_000 },
  reviewReel: { count: 60, windowMs: 60_000 },
  deleteMyAccount: { count: 1, windowMs: 24 * 60 * 60_000 },
  publishCurriculum: { count: 5, windowMs: 60_000 },
};

export function adminApp(request: Request): App {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const usingEmulators = process.env.IMI_USE_FIREBASE_EMULATORS === "true"
    && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST)
    && Boolean(projectId?.startsWith("demo-"));
  if (!projectId || (!usingEmulators && projectId !== "imi-indroid")) {
    throw new Error("Firebase project configuration is unavailable.");
  }
  const existing = getApps().find(app => app.name === "imi-server-api");
  if (usingEmulators) return existing ?? initializeApp({ projectId }, "imi-server-api");

  const oidcToken = request.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN;
  if (!oidcToken) throw new Error("Vercel OIDC identity token is unavailable.");

  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  const serviceAccountEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  if (!projectNumber || !poolId || !providerId || !serviceAccountEmail) {
    throw new Error("Google Workload Identity Federation is not configured.");
  }

  const tokenFile = "/tmp/imi-vercel-oidc-token";
  const configFile = "/tmp/imi-wif-config.json";
  // Unique same-directory temporary files plus renameSync prevent partial reads and
  // collisions when concurrent requests refresh the shared credential files.
  const tokenTmp = `${tokenFile}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tokenTmp, oidcToken, { mode: 0o600 });
  renameSync(tokenTmp, tokenFile);

  const configTmp = `${configFile}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(configTmp, JSON.stringify({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    credential_source: { file: { path: tokenFile } },
  }), { mode: 0o600 });
  renameSync(configTmp, configFile);

  process.env.GOOGLE_APPLICATION_CREDENTIALS = configFile;
  if (existing) return existing;
  return initializeApp({ credential: applicationDefault(), projectId }, "imi-server-api");
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
  const key = createHash("sha256").update(`${operation}:${uid}`).digest("hex");
  const ref = db.doc(`apiRateLimits/${key}`);
  await reserveRateLimitWindows({
    runTransaction: work => db.runTransaction(async transaction => work({
      get: async () => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return null;
        const stored = (snapshot.get("windows") ?? {}) as Record<string, { windowStartedAt: Timestamp; count: number }>;
        return {
          windows: Object.fromEntries(Object.entries(stored).map(([label, value]) => [
            label, { windowStartedAt: value.windowStartedAt.toMillis(), count: Number(value.count) }
          ]))
        };
      },
      set: (_key, value) => transaction.set(ref, {
        operation,
        uidHash: key,
        windows: Object.fromEntries(Object.entries(value.windows).map(([label, window]) => [
          label, { windowStartedAt: Timestamp.fromMillis(window.windowStartedAt), count: window.count }
        ]))
      })
    }))
  }, key, policies, now);
}

export async function handleDeleteAccount(request: Request): Promise<Response> {
  try {
    assertOrigin(request);
    if (request.method !== "POST") return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
    if (process.env.IMI_ACCOUNT_DELETION_ENABLED !== "true") {
      return NextResponse.json(
        { error: "حذف الحساب معطّل افتراضياً حتى اكتمال التحقق من جميع مسارات التنظيف." },
        { status: 503 }
      );
    }
    if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2048) {
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
    if (body.confirmation !== "DELETE") {
      return NextResponse.json({ error: "اكتب DELETE لتأكيد حذف الحساب وبياناته." }, { status: 400 });
    }

    const app = adminApp(request);
    const authorization = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const decoded = await getAuth(app).verifyIdToken(match[1], true);
    const authTime = Number(decoded.auth_time ?? 0) * 1000;
    if (!authTime || Date.now() - authTime > 5 * 60_000) {
      return NextResponse.json({ error: "لأمان حسابك، سجّل الدخول من جديد ثم أعد طلب الحذف." }, { status: 412 });
    }

    await applyRateLimit(app, decoded.uid, "deleteMyAccount");
    await cleanupAccountData(
      getFirestore(app) as unknown as Parameters<typeof cleanupAccountData>[0],
      getStorage(app).bucket() as unknown as Parameters<typeof cleanupAccountData>[1],
      decoded.uid
    );
    await getAuth(app).deleteUser(decoded.uid);
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
    const status = code === "auth/id-token-expired" || code === "auth/invalid-id-token" ? 401
      : code === "RATE_LIMIT" || code === "resource-exhausted" ? 429
      : 500;
    return NextResponse.json(
      { error: status === 500 ? "تعذر حذف الحساب بالكامل. أعد المحاولة بعد مراجعة حالة التخزين." : "تعذر تنفيذ طلب الحذف." },
      { status }
    );
  }
}

async function publishedNodeIds(app: App, value: unknown, type: "level" | "subject"): Promise<string[]> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12
    || value.some(id => typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]{1,100}$/.test(id))) {
    throw new CoreError("invalid-argument", "اختيارات المستوى أو المواد غير صالحة.");
  }
  const ids = [...new Set(value as string[])];
  const db = getFirestore(app);
  const docs = await Promise.all(ids.map(id => db.collection("curriculumNodes").doc(id).get()));
  if (docs.some(d => !d.exists || d.get("status") !== "published"
    || d.get("needsReview") === true || d.get("type") !== type)) {
    throw new CoreError("failed-precondition", "تتضمن الاختيارات عقدة غير منشورة أو من نوع غير صحيح.");
  }
  return ids;
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

    const app = adminApp(request);
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
      publishCurriculum: async () => {
        const admin = await getAuth(app).getUser(uid);
        if (admin.customClaims?.admin !== true) {
          throw new CoreError("permission-denied", "هذه العملية للمشرفين فقط.");
        }
        const scopeId = typeof body.scopeId === "string" ? body.scopeId.trim() : "";
        if (!/^[a-z0-9][a-z0-9_-]{1,100}$/.test(scopeId)) {
          throw new CoreError("invalid-argument", "معرّف النطاق غير صالح.");
        }
        const dryRun = body.dryRun !== false;
        if (!dryRun && body.confirmation !== "PUBLISH") {
          throw new CoreError("invalid-argument", "اكتب PUBLISH للتأكيد.");
        }
        const db = getFirestore(app);
        const all = await db.collection("curriculumNodes").get();
        const nodes = new Map<string, { parentId: string | null; type: string; status: string; needsReview: boolean; nameAr: string }>();
        for (const document of all.docs) {
          const value = document.data();
          nodes.set(document.id, {
            parentId: typeof value.parentId === "string" ? value.parentId : null,
            type: String(value.type ?? ""),
            status: String(value.status ?? ""),
            needsReview: value.needsReview === true,
            nameAr: typeof value.nameAr === "string" ? value.nameAr : "",
          });
        }
        const scope = nodes.get(scopeId);
        if (!scope || scope.type !== "level") {
          throw new CoreError("invalid-argument", "نطاق النشر يجب أن يكون مستوى دراسياً موجوداً.");
        }
        if (scope.parentId) {
          const parent = nodes.get(scope.parentId);
          if (!parent || parent.status !== "published" || parent.needsReview) {
            throw new CoreError("invalid-argument", "انشر العقدة الأب أولاً.");
          }
        }
        const children = new Map<string, string[]>();
        for (const [id, node] of nodes) {
          if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), id]);
        }
        const targets: string[] = [];
        const seen = new Set<string>();
        const queue = [scopeId];
        while (queue.length) {
          const id = queue.shift() as string;
          if (seen.has(id)) continue;
          seen.add(id);
          const node = nodes.get(id);
          if (!node) continue;
          if (node.status === "hidden" && node.needsReview
            && ["level", "track", "subject", "unit"].includes(node.type)
            && node.nameAr.trim()) targets.push(id);
          queue.push(...(children.get(id) ?? []));
        }
        if (targets.length > 5000) {
          throw new CoreError("resource-exhausted", "نطاق النشر أكبر من الحد الآمن؛ قسّمه إلى مستويات أصغر.");
        }
        const byType: Record<string, number> = {};
        for (const id of targets) {
          const type = nodes.get(id)?.type ?? "unknown";
          byType[type] = (byType[type] ?? 0) + 1;
        }
        if (!dryRun) {
          for (let offset = 0; offset < targets.length; offset += 400) {
            const batch = db.batch();
            for (const id of targets.slice(offset, offset + 400)) {
              batch.update(db.collection("curriculumNodes").doc(id), {
                status: "published",
                needsReview: false,
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
            await batch.commit();
          }
          await db.collection("adminAuditLogs").add({
            action: "publishCurriculum",
            actorUid: uid,
            scopeId,
            count: targets.length,
            byType,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        return { dryRun, scopeId, count: targets.length, byType };
      },
      prepareReel: async () => {
        const reelId = typeof body.reelId === "string" ? body.reelId.trim() : "";
        const caption = typeof body.caption === "string" ? body.caption.trim() : "";
        const contentType = body.contentType;
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(reelId)) throw new CoreError("invalid-argument", "معرّف المقطع غير صالح.");
        if (caption.length > 300) throw new CoreError("invalid-argument", "الوصف يتجاوز 300 حرف.");
        if (contentType !== "video/mp4" && contentType !== "video/webm") throw new CoreError("invalid-argument", "صيغة الفيديو غير مدعومة.");
        const extension = contentType === "video/webm" ? "webm" : "mp4";
        const storagePath = `reels/${uid}/${reelId}/video.${extension}`;
        const reelRef = getFirestore(app).collection("reels").doc(reelId);
        await getFirestore(app).runTransaction(async transaction => {
          const existing = await transaction.get(reelRef);
          if (existing.exists) throw new CoreError("already-exists", "هذا المقطع مسجل مسبقاً.");
          transaction.create(reelRef, {
            ownerUid: uid, caption, storagePath, contentType,
            status: "uploading", createdAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: null,
          });
        });
        return { reelId, status: "uploading", storagePath };
      },
      submitReel: async () => {
        const reelId = typeof body.reelId === "string" ? body.reelId.trim() : "";
        const caption = typeof body.caption === "string" ? body.caption.trim() : "";
        const contentType = body.contentType;
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(reelId)) throw new CoreError("invalid-argument", "معرّف المقطع غير صالح.");
        if (caption.length > 300) throw new CoreError("invalid-argument", "الوصف يتجاوز 300 حرف.");
        if (contentType !== "video/mp4" && contentType !== "video/webm") throw new CoreError("invalid-argument", "صيغة الفيديو غير مدعومة.");
        const extension = contentType === "video/webm" ? "webm" : "mp4";
        const expectedPath = `reels/${uid}/${reelId}/video.${extension}`;
        if (body.storagePath !== expectedPath) throw new CoreError("invalid-argument", "مسار الفيديو لا يطابق حسابك أو معرّف المقطع.");
        let metadata: Record<string, unknown>;
        try {
          const [actual] = await getStorage(app).bucket().file(expectedPath).getMetadata();
          metadata = actual as Record<string, unknown>;
        } catch {
          throw new CoreError("not-found", "لم يتم العثور على الفيديو المرفوع.");
        }
        const size = Number(metadata.size ?? 0);
        if (metadata.contentType !== contentType || !Number.isFinite(size) || size <= 0 || size > 100 * 1024 * 1024) {
          throw new CoreError("failed-precondition", "بيانات الفيديو أو حجمه لا تطابق الشروط.");
        }
        const reelRef = getFirestore(app).collection("reels").doc(reelId);
        await getFirestore(app).runTransaction(async transaction => {
          const existing = await transaction.get(reelRef);
          if (!existing.exists || existing.get("ownerUid") !== uid
            || existing.get("status") !== "uploading"
            || existing.get("storagePath") !== expectedPath
            || existing.get("contentType") !== contentType) {
            throw new CoreError("failed-precondition", "لم يتم تجهيز مستند المقطع أو لا تطابق بياناته الملف.");
          }
          transaction.update(reelRef, {
            caption, status: "pending", updatedAt: FieldValue.serverTimestamp(),
          });
        });
        return { reelId, status: "pending" };
      },
      reviewReel: async () => {
        const admin = await getAuth(app).getUser(uid);
        if (admin.customClaims?.admin !== true) throw new CoreError("permission-denied", "هذه العملية للمشرفين فقط.");
        const reelId = typeof body.reelId === "string" ? body.reelId.trim() : "";
        const decision = body.decision;
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(reelId) || !["approved", "rejected"].includes(String(decision))) {
          throw new CoreError("invalid-argument", "طلب المراجعة غير صالح.");
        }
        const validDecision = decision as "approved" | "rejected";
        const db = getFirestore(app);
        const reelRef = db.collection("reels").doc(reelId);
        await db.runTransaction(async transaction => {
          const reel = await transaction.get(reelRef);
          if (!reel.exists) throw new CoreError("not-found", "المقطع غير موجود.");
          if (reel.get("status") !== "pending") throw new CoreError("failed-precondition", "تمت مراجعة هذا المقطع مسبقاً.");
          transaction.update(reelRef, { status: validDecision, reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp(), reviewNote: note });
          transaction.create(db.collection("moderationLogs").doc(), {
            actorUid: uid, action: validDecision === "approved" ? "reel_approved" : "reel_rejected",
            targetId: reelId, createdAt: FieldValue.serverTimestamp(),
          });
        });
        return { reelId, status: validDecision };
      },
      submitTeacherApplication: async () => {
        const record = await getAuth(app).getUser(uid);
        if (record.customClaims?.teacherVerified === true) {
          throw new CoreError("already-exists", "هذا الحساب موثق كأستاذ بالفعل.");
        }
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        if (fullName.length < 3 || fullName.length > 80) {
          throw new CoreError("invalid-argument", "الاسم الكامل مطلوب (3-80 حرفاً).");
        }
        const proofUrl = typeof body.proofUrl === "string" ? body.proofUrl.trim() : "";
        let parsed: URL;
        try { parsed = new URL(proofUrl); }
        catch { throw new CoreError("invalid-argument", "رابط الإثبات غير صالح."); }
        if (parsed.protocol !== "https:" || !parsed.hostname || proofUrl.length > 500
          || parsed.username || parsed.password) {
          throw new CoreError("invalid-argument", "يجب أن يكون رابط الإثبات https صالحاً.");
        }
        const [subjectIds, levelIds] = await Promise.all([
          publishedNodeIds(app, body.subjectIds, "subject"),
          publishedNodeIds(app, body.levelIds, "level"),
        ]);
        const db = getFirestore(app);
        const ref = db.collection("teacherApplications").doc(uid);
        await db.runTransaction(async tx => {
          const old = await tx.get(ref);
          if (old.exists && old.get("status") === "pending") {
            throw new CoreError("already-exists", "لديك طلب توثيق قيد المراجعة بالفعل.");
          }
          tx.set(ref, {
            uid, fullName, subjectIds, levelIds, proofUrl, status: "pending",
            submittedAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: null,
          });
        });
        return { status: "pending" };
      },
      saveTeacherProfile: async () => {
        const account = await getAuth(app).getUser(uid);
        if (account.customClaims?.teacherVerified !== true) {
          throw new CoreError("permission-denied", "يجب توثيق حساب الأستاذ أولاً.");
        }
        const bio = typeof body.bio === "string" ? body.bio.trim() : "";
        if (bio.length < 30 || bio.length > 1200) {
          throw new CoreError("invalid-argument", "النبذة مطلوبة ويجب أن تتراوح بين 30 و1200 حرف.");
        }
        const photoPath = typeof body.photoPath === "string" ? body.photoPath.trim() : "";
        if (photoPath !== "") {
          throw new CoreError("failed-precondition", "رفع صورة الأستاذ غير متاح حالياً؛ أرسل photoPath فارغاً.");
        }
        if (body.contentAgreement !== true || body.childSafetyAgreement !== true) {
          throw new CoreError("failed-precondition", "يجب قبول اتفاقية المحتوى والحقوق وقواعد حماية القاصرين.");
        }
        const [subjectIds, levelIds] = await Promise.all([
          publishedNodeIds(app, body.subjectIds, "subject"),
          publishedNodeIds(app, body.levelIds, "level"),
        ]);
        const db = getFirestore(app);
        const application = await db.collection("teacherApplications").doc(uid).get();
        if (!application.exists || application.get("status") !== "approved") {
          throw new CoreError("failed-precondition", "يجب اعتماد طلب توثيق الأستاذ قبل إنشاء الملف المهني.");
        }
        const displayName = typeof application.get("fullName") === "string"
          ? application.get("fullName") as string : "أستاذ IMI";
        const timestamp = FieldValue.serverTimestamp();
        await db.collection("teacherProfiles").doc(uid).set({
          uid, displayName, bio, photoPath: "", subjectIds, levelIds,
          verified: true, badge: "أستاذ موثّق",
          contentAgreement: true, childSafetyAgreement: true,
          agreementAcceptances: createTeacherAgreementAcceptances(uid, timestamp),
          profileComplete: true, published: true, updatedAt: timestamp,
        }, { merge: true });
        return { profileComplete: true, photoPath: "" };
      },
      reviewTeacherApplication: async () => {
        const actor = await getAuth(app).getUser(uid);
        if (actor.customClaims?.admin !== true) {
          throw new CoreError("permission-denied", "المشرف الموثق فقط يمكنه المراجعة.");
        }
        const targetUid = typeof body.uid === "string" ? body.uid : "";
        if (!/^[A-Za-z0-9_-]{2,128}$/.test(targetUid)) {
          throw new CoreError("invalid-argument", "معرّف الحساب غير صالح.");
        }
        if (typeof body.approved !== "boolean") {
          throw new CoreError("invalid-argument", "قرار المراجعة غير صالح.");
        }
        const approved = body.approved;
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
        const db = getFirestore(app);
        const ref = db.collection("teacherApplications").doc(targetUid);
        const status = approved ? "approved" : "rejected";
        await db.runTransaction(async tx => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new CoreError("not-found", "طلب الأستاذ غير موجود.");
          if (snap.get("status") === status) return;
          if (snap.get("status") !== "pending") {
            throw new CoreError("failed-precondition", "لم يعد الطلب قيد الانتظار.");
          }
          tx.update(ref, {
            status, reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp(), reviewNote: note,
          });
          tx.create(db.collection("moderationAudit").doc(), {
            actorUid: uid, targetUid,
            action: approved ? "teacher_application_approved" : "teacher_application_rejected",
            note, createdAt: FieldValue.serverTimestamp(),
          });
        });
        // Keep the reviewed decision durable and synchronize Auth claims synchronously.
        // Repeating the same review safely retries claim synchronization after a transient failure.
        const operationId = `teacher-application-${targetUid}-${status}`;
        const outboxRef = db.collection("teacherClaimsOutbox").doc(operationId);
        await applyTeacherClaimsOutboxOperation({
          targetUid, desiredTeacher: approved,
        }, {
          getUser: async userId => {
            const user = await getAuth(app).getUser(userId);
            return { customClaims: user.customClaims ?? {} };
          },
          setCustomClaims: async (userId, claims) => getAuth(app).setCustomUserClaims(userId, claims),
          markApplied: async () => {
            await outboxRef.set({
              targetUid, desiredTeacher: approved, status: "applied",
              updatedAt: FieldValue.serverTimestamp(), appliedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
          },
          markPending: async error => {
            await outboxRef.set({
              targetUid, desiredTeacher: approved, status: "pending",
              updatedAt: FieldValue.serverTimestamp(),
              lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown Auth claim synchronization error",
              attempts: FieldValue.increment(1),
            }, { merge: true });
          },
        });
        return { status, claimsSync: "applied" };
      },
      deleteMyAccount: async () => {
        throw new CoreError("failed-precondition", "Use the dedicated account deletion route.");
      },
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
