import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { directConversationId } from "../../../../functions/src/conversationLogic";
import { NextResponse } from "next/server";
import {
  createStatus, sendFriendRequest, createOrGetDirectConversation,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  blockUser, unblockUser, createGroupConversation, addGroupParticipants,
  type StorePort, type TransactionPort,
} from "../../../../functions/src/shared/serverCore";
import { authenticateBearer, publicErrorMessage } from "../../../../functions/src/shared/serverAuth";

type Operation = "createStatus" | "sendFriendRequest" | "createOrGetDirectConversation" | "acceptFriendRequest" | "rejectFriendRequest" | "removeFriend" | "blockUser" | "unblockUser" | "createGroupConversation" | "addGroupParticipants";
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
      if (current >= policy.count) throw Object.assign(new Error("RATE_LIMIT"), { code: "resource-exhausted" });
      tx.set(policy.ref, {
        operation, uidHash: policy.key, windowStartedAt: Timestamp.fromMillis(current ? start : now),
        count: current + 1,
      });
    }
  });
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
