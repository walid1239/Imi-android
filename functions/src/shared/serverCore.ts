export type CoreErrorCode =
  | "unauthenticated" | "invalid-argument" | "resource-exhausted"
  | "permission-denied" | "not-found" | "already-exists" | "failed-precondition";

export class CoreError extends Error {
  constructor(readonly code: CoreErrorCode, message: string) {
    super(message);
    this.name = "CoreError";
  }
}

export type Snapshot = { exists: boolean; data: Record<string, unknown> };
export interface TransactionPort {
  get(path: string): Promise<Snapshot>;
  create(path: string, data: Record<string, unknown>): void;
  set(path: string, data: Record<string, unknown>): void;
  update(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
}
export interface StorePort {
  runTransaction<T>(work: (tx: TransactionPort) => Promise<T>): Promise<T>;
  newId(): string;
  nowMillis(): number;
  serverTimestamp(): unknown;
  timestampFromMillis(value: number): unknown;
  timestampToMillis(value: unknown): number | undefined;
  isVerifiedTeacher(uid: string): Promise<boolean>;
  directConversationId(firstUid: string, secondUid: string): string;
}

function requireUid(value: unknown, message: string, maxLength = 128): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > maxLength || value.includes("/")) {
    throw new CoreError("invalid-argument", message);
  }
  return value.trim();
}

function assertSamePrivateChatRole(firstTeacher: boolean, secondTeacher: boolean): void {
  if (firstTeacher !== secondTeacher) {
    throw new CoreError("permission-denied", "التواصل الخاص بين الأستاذ والتلميذ غير متاح. استخدم قنوات الأكاديمية العامة والمراقبة.");
  }
}

export function validateStatusInput(textValue: unknown, mediaTypeValue: unknown) {
  const text = typeof textValue === "string" ? textValue.trim() : "";
  if (text.length > 700) throw new CoreError("invalid-argument", "نص الحالة يتجاوز 700 حرف.");
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (mediaTypeValue !== undefined && !allowed.includes(String(mediaTypeValue))) {
    throw new CoreError("invalid-argument", "نوع صورة الحالة غير مدعوم.");
  }
  if (!text && mediaTypeValue === undefined) {
    throw new CoreError("invalid-argument", "أضف نصاً قبل النشر. رفع الصور غير متاح في مرحلة Spark.");
  }
  // Spark has no Firebase Storage access. Reject media metadata rather than create a broken status.
  if (mediaTypeValue !== undefined) {
    throw new CoreError("failed-precondition", "رفع الوسائط متوقف في المرحلة المجانية؛ انشر حالة نصية فقط.");
  }
  return { text };
}

export async function createStatus(
  store: StorePort,
  uidValue: unknown,
  input: { text?: unknown; mediaType?: unknown },
) {
  const uid = requireUid(uidValue, "معرّف المستخدم غير صالح.");
  const { text } = validateStatusInput(input.text, input.mediaType);
  const now = store.nowMillis();
  const statusId = store.newId();
  const expiresAtMillis = now + 28 * 60 * 60 * 1000;
  const ratePath = `statusRateLimits/${uid}`;
  const statusPath = `users/${uid}/statuses/${statusId}`;
  await store.runTransaction(async tx => {
    const rate = await tx.get(ratePath);
    const last = store.timestampToMillis(rate.data.lastCreatedAt);
    if (last !== undefined && now - last < 30_000) {
      throw new CoreError("resource-exhausted", "انتظر قليلاً قبل نشر حالة أخرى.");
    }
    tx.set(ratePath, { uid, lastCreatedAt: store.timestampFromMillis(now) });
    tx.create(statusPath, {
      ownerUid: uid,
      text,
      createdAt: store.serverTimestamp(),
      expiresAt: store.timestampFromMillis(expiresAtMillis),
    });
  });
  return { statusId, expiresAtMillis, mediaPath: null };
}

function friendRequestId(fromUid: string, toUid: string): string {
  return `${encodeURIComponent(fromUid)}__${encodeURIComponent(toUid)}`;
}

export async function sendFriendRequest(store: StorePort, uidValue: unknown, input: { toUid?: unknown }) {
  const uid = requireUid(uidValue, "معرّف المستخدم غير صالح.");
  const toUid = requireUid(input.toUid, "معرّف المستخدم المستهدف غير صالح.");
  if (toUid === uid) throw new CoreError("invalid-argument", "لا يمكنك إرسال طلب صداقة إلى نفسك.");
  const [actorTeacher, targetTeacher] = await Promise.all([
    store.isVerifiedTeacher(uid), store.isVerifiedTeacher(toUid),
  ]);
  assertSamePrivateChatRole(actorTeacher, targetTeacher);

  const outgoing = `friendRequests/${friendRequestId(uid, toUid)}`;
  const incoming = `friendRequests/${friendRequestId(toUid, uid)}`;
  await store.runTransaction(async tx => {
    const [profile, out, inc, ownFriend, targetFriend, ownBlock, targetBlock] = await Promise.all([
      tx.get(`publicProfiles/${toUid}`), tx.get(outgoing), tx.get(incoming),
      tx.get(`users/${uid}/friends/${toUid}`), tx.get(`users/${toUid}/friends/${uid}`),
      tx.get(`users/${uid}/blockedUsers/${toUid}`), tx.get(`users/${toUid}/blockedUsers/${uid}`),
    ]);
    if (ownBlock.exists || targetBlock.exists) throw new CoreError("permission-denied", "لا يمكن إرسال طلب صداقة بسبب إعدادات الحظر.");
    if (!profile.exists) throw new CoreError("not-found", "لم نعثر على هذا المستخدم في دليل IMI.");
    if (ownFriend.exists && ownFriend.data.status === "accepted" && targetFriend.exists && targetFriend.data.status === "accepted") {
      throw new CoreError("already-exists", "هذا المستخدم موجود بالفعل ضمن أصدقائك.");
    }
    if (inc.exists && inc.data.status === "pending") {
      throw new CoreError("failed-precondition", "لديك طلب صداقة وارد من هذا المستخدم؛ افتح الطلبات الواردة لقبوله.");
    }
    if (out.exists && out.data.status === "pending") {
      throw new CoreError("already-exists", "سبق أن أرسلت طلب صداقة وما زال قيد الانتظار.");
    }
    tx.set(outgoing, {
      fromUid: uid, toUid, status: "pending",
      createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp(),
    });
  });
  return { requestId: friendRequestId(uid, toUid), status: "pending" as const };
}


export async function acceptFriendRequest(
  store: StorePort, uidValue: unknown, input: { requestId?: unknown },
) {
  const uid = requireUid(uidValue, "معرّف المستخدم غير صالح.");
  const requestId = requireUid(input.requestId, "معرّف طلب الصداقة غير صالح.", 300);
  return store.runTransaction(async tx => {
    const requestPath = `friendRequests/${requestId}`;
    const request = await tx.get(requestPath);
    if (!request.exists) throw new CoreError("not-found", "طلب الصداقة غير موجود.");
    const fromUid = request.data.fromUid;
    if (request.data.toUid !== uid) throw new CoreError("permission-denied", "لا يمكنك قبول طلب موجّه إلى مستخدم آخر.");
    if (request.data.status === "accepted") return { status: "accepted" as const };
    if (request.data.status !== "pending" || typeof fromUid !== "string" || fromUid === uid) {
      throw new CoreError("failed-precondition", "هذا الطلب لم يعد صالحاً للقبول.");
    }
    const ownPath = `users/${uid}/friends/${fromUid}`;
    const senderPath = `users/${fromUid}/friends/${uid}`;
    const [ownFriend, senderFriend, ownBlock, senderBlock] = await Promise.all([
      tx.get(ownPath), tx.get(senderPath),
      tx.get(`users/${uid}/blockedUsers/${fromUid}`),
      tx.get(`users/${fromUid}/blockedUsers/${uid}`),
    ]);
    if (ownBlock.exists || senderBlock.exists) throw new CoreError("permission-denied", "لا يمكن قبول طلب الصداقة بسبب إعدادات الحظر.");
    if ((ownFriend.exists && ownFriend.data.status !== "accepted")
      || (senderFriend.exists && senderFriend.data.status !== "accepted")) {
      throw new CoreError("failed-precondition", "توجد علاقة صداقة غير متسقة؛ لم يتم تغييرها.");
    }
    const now = store.serverTimestamp();
    tx.update(requestPath, { status: "accepted", respondedAt: now, updatedAt: now });
    tx.set(ownPath, { uid: fromUid, status: "accepted", createdAt: now, updatedAt: now });
    tx.set(senderPath, { uid, status: "accepted", createdAt: now, updatedAt: now });
    return { status: "accepted" as const };
  });
}

export async function rejectFriendRequest(
  store: StorePort, uidValue: unknown, input: { requestId?: unknown },
) {
  const uid = requireUid(uidValue, "معرّف المستخدم غير صالح.");
  const requestId = requireUid(input.requestId, "معرّف طلب الصداقة غير صالح.", 300);
  return store.runTransaction(async tx => {
    const path = `friendRequests/${requestId}`;
    const request = await tx.get(path);
    if (!request.exists) throw new CoreError("not-found", "طلب الصداقة غير موجود.");
    if (request.data.toUid !== uid) throw new CoreError("permission-denied", "لا يمكنك رفض طلب موجّه إلى مستخدم آخر.");
    if (request.data.status === "rejected") return { status: "rejected" as const };
    if (request.data.status !== "pending") throw new CoreError("failed-precondition", "هذا الطلب لم يعد قيد الانتظار.");
    const now = store.serverTimestamp();
    tx.update(path, { status: "rejected", respondedAt: now, updatedAt: now });
    return { status: "rejected" as const };
  });
}

export async function removeFriend(
  store: StorePort, uidValue: unknown, input: { friendUid?: unknown },
) {
  const uid = requireUid(uidValue, "معرّف المستخدم غير صالح.");
  const friendUid = requireUid(input.friendUid, "معرّف الصديق غير صالح.");
  if (friendUid === uid) throw new CoreError("invalid-argument", "لا يمكن حذف نفسك من قائمة الأصدقاء.");
  const forward = `friendRequests/${friendRequestId(uid, friendUid)}`;
  const reverse = `friendRequests/${friendRequestId(friendUid, uid)}`;
  return store.runTransaction(async tx => {
    const ownPath = `users/${uid}/friends/${friendUid}`;
    const otherPath = `users/${friendUid}/friends/${uid}`;
    const [ownFriend, otherFriend, forwardRequest, reverseRequest] = await Promise.all([
      tx.get(ownPath), tx.get(otherPath), tx.get(forward), tx.get(reverse),
    ]);
    if (!ownFriend.exists || !otherFriend.exists
      || ownFriend.data.status !== "accepted" || otherFriend.data.status !== "accepted") {
      throw new CoreError("not-found", "هذه العلاقة ليست صداقة مؤكدة بين الحسابين.");
    }
    tx.delete(ownPath);
    tx.delete(otherPath);
    if (forwardRequest.exists && forwardRequest.data.status === "accepted") {
      tx.update(forward, { status: "removed", updatedAt: store.serverTimestamp() });
    }
    if (reverseRequest.exists && reverseRequest.data.status === "accepted") {
      tx.update(reverse, { status: "removed", updatedAt: store.serverTimestamp() });
    }
    return { status: "removed" as const };
  });
}

export async function createOrGetDirectConversation(
  store: StorePort,
  uidValue: unknown,
  input: { otherUid?: unknown },
) {
  const uid = requireUid(uidValue, "معرّف المستخدم غير صالح.");
  const otherUid = requireUid(input.otherUid, "معرّف المستخدم الآخر غير صالح.");
  if (otherUid === uid) throw new CoreError("invalid-argument", "لا يمكنك بدء محادثة مع نفسك.");
  const [firstTeacher, secondTeacher] = await Promise.all([
    store.isVerifiedTeacher(uid), store.isVerifiedTeacher(otherUid),
  ]);
  assertSamePrivateChatRole(firstTeacher, secondTeacher);
  const participants = [uid, otherUid].sort();
  const conversationId = store.directConversationId(uid, otherUid);
  await store.runTransaction(async tx => {
    const [conversation, ownProfile, otherProfile, ownBlock, otherBlock] = await Promise.all([
      tx.get(`conversations/${conversationId}`),
      tx.get(`publicProfiles/${uid}`), tx.get(`publicProfiles/${otherUid}`),
      tx.get(`users/${uid}/blockedUsers/${otherUid}`),
      tx.get(`users/${otherUid}/blockedUsers/${uid}`),
    ]);
    if (ownBlock.exists || otherBlock.exists) throw new CoreError("permission-denied", "لا يمكن بدء محادثة بسبب إعدادات الحظر.");
    if (!ownProfile.exists || !otherProfile.exists) {
      throw new CoreError("not-found", "يجب أن يكون الطرفان قد نشرا ملفيهما في دليل IMI أولاً.");
    }
    if (conversation.exists) {
      const current = conversation.data.participants;
      if (!Array.isArray(current) || current.length !== 2
        || current[0] !== participants[0] || current[1] !== participants[1]) {
        throw new CoreError("failed-precondition", "معرّف المحادثة مرتبط بأعضاء مختلفين.");
      }
      return;
    }
    tx.create(`conversations/${conversationId}`, {
      participants, createdBy: uid,
      createdAt: store.serverTimestamp(), lastMessage: "",
      lastMessageAt: store.serverTimestamp(),
    });
  });
  return { conversationId };
}
