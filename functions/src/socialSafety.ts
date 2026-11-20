import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { directConversationId } from "./conversationLogic";

type UidInput = { targetUid?: unknown };
type GroupInput = { name?: unknown; participantUids?: unknown };
function validUid(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{2,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", "معرّف المستخدم غير صالح.");
  }
  return value;
}
function requireUser(request: { auth?: { uid: string } | null }): string {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  return request.auth.uid;
}
async function assertSamePrivateChatRole(ids: string[]) {
  const users = await Promise.all(ids.map(id => getAuth().getUser(id)));
  const roles = new Set(users.map(user => user.customClaims?.teacherVerified === true));
  if (roles.size > 1) {
    throw new HttpsError("permission-denied", "المجموعات الخاصة بين الأساتذة والتلاميذ غير متاحة؛ استخدم قنوات الأكاديمية المراقبة.");
  }
}
async function ensureNoBlock(db: Firestore, a: string, b: string) {
  const [ab, ba] = await Promise.all([
    db.doc("users/" + a + "/blockedUsers/" + b).get(),
    db.doc("users/" + b + "/blockedUsers/" + a).get(),
  ]);
  if (ab.exists || ba.exists) throw new HttpsError("permission-denied", "لا يمكن تنفيذ العملية بسبب إعدادات الحظر بين الحسابين.");
}
async function ensureFriends(db: FirebaseFirestore.Firestore, a: string, b: string) {
  const [ab, ba] = await Promise.all([
    db.doc("users/" + a + "/friends/" + b).get(),
    db.doc("users/" + b + "/friends/" + a).get(),
  ]);
  if (!ab.exists || !ba.exists || ab.get("status") !== "accepted" || ba.get("status") !== "accepted") {
    throw new HttpsError("failed-precondition", "يجب أن تكون الصداقة مؤكدة لدى الطرفين.");
  }
}

export const blockUser = onCall<UidInput>(async request => {
  const actor = requireUser(request), target = validUid(request.data?.targetUid);
  if (actor === target) throw new HttpsError("invalid-argument", "لا يمكنك حظر حسابك.");
  const db = getFirestore();
  const profile = await db.doc("publicProfiles/" + target).get();
  if (!profile.exists) throw new HttpsError("not-found", "الحساب غير موجود.");
  const directRef = db.collection("conversations").doc(directConversationId(actor, target));
  const direct = await directRef.get();
  const batch = db.batch();
  batch.set(db.doc("users/" + actor + "/blockedUsers/" + target), {
    uid: target, blockedAt: FieldValue.serverTimestamp(),
  });
  batch.delete(db.doc("users/" + actor + "/friends/" + target));
  batch.delete(db.doc("users/" + target + "/friends/" + actor));
  batch.delete(db.doc("friendRequests/" + encodeURIComponent(actor) + "__" + encodeURIComponent(target)));
  batch.delete(db.doc("friendRequests/" + encodeURIComponent(target) + "__" + encodeURIComponent(actor)));
  if (direct.exists) batch.update(directRef, { status: "blocked", lastMessage: "", updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { status: "blocked" };
});

export const unblockUser = onCall<UidInput>(async request => {
  const actor = requireUser(request), target = validUid(request.data?.targetUid);
  if (actor === target) throw new HttpsError("invalid-argument", "معرّف الحساب غير صالح.");
  const db = getFirestore();
  await db.doc("users/" + actor + "/blockedUsers/" + target).delete();
  const reverse = await db.doc("users/" + target + "/blockedUsers/" + actor).get();
  if (!reverse.exists) {
    const directRef = db.collection("conversations").doc(directConversationId(actor, target));
    const direct = await directRef.get();
    if (direct.exists && direct.get("status") === "blocked") {
      await directRef.update({ status: "active", updatedAt: FieldValue.serverTimestamp() });
    }
  }
  return { status: "unblocked" };
});

export const createGroupConversation = onCall<GroupInput>(async request => {
  const actor = requireUser(request);
  const name = typeof request.data?.name === "string" ? request.data.name.trim() : "";
  if (name.length < 2 || name.length > 80) throw new HttpsError("invalid-argument", "اسم المجموعة يجب أن يكون بين حرفين و80 حرفاً.");
  if (!Array.isArray(request.data?.participantUids) || request.data.participantUids.length < 2
    || request.data.participantUids.length > 49) {
    throw new HttpsError("invalid-argument", "اختر من عضوين إلى 49 عضواً بالإضافة إليك.");
  }
  const participants = [...new Set([actor, ...(request.data.participantUids as unknown[]).map(validUid)])];
  if (participants.length < 3 || participants.length > 50) throw new HttpsError("invalid-argument", "المجموعة تتطلب ثلاثة أعضاء على الأقل.");
  const db = getFirestore();
  await assertSamePrivateChatRole(participants);
  const checks = participants.filter(uid => uid !== actor);
  await Promise.all(checks.map(async uid => { await ensureNoBlock(db, actor, uid); await ensureFriends(db, actor, uid); }));
  const profiles = await Promise.all(participants.map(uid => db.doc("publicProfiles/" + uid).get()));
  if (profiles.some(profile => !profile.exists)) throw new HttpsError("not-found", "تعذر العثور على ملف أحد أعضاء المجموعة.");
  const ref = db.collection("conversations").doc();
  await ref.create({
    type: "group", name, ownerUid: actor, admins: [actor],
    participants: participants.sort(), createdBy: actor,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    lastMessage: "", lastMessageAt: FieldValue.serverTimestamp(),
  });
  return { conversationId: ref.id, participantCount: participants.length };
});

export const addGroupParticipants = onCall<GroupInput & { conversationId?: unknown }>(async request => {
  const actor = requireUser(request);
  const conversationId = validUid(request.data?.conversationId);
  if (!Array.isArray(request.data?.participantUids) || request.data.participantUids.length < 1
    || request.data.participantUids.length > 20) throw new HttpsError("invalid-argument", "عدد الأعضاء غير صالح.");
  const additions = [...new Set((request.data.participantUids as unknown[]).map(validUid))];
  const db = getFirestore(), ref = db.doc("conversations/" + conversationId);
  const conversation = await ref.get();
  if (!conversation.exists || conversation.get("type") !== "group") throw new HttpsError("not-found", "المجموعة غير موجودة.");
  const admins = conversation.get("admins"), current = conversation.get("participants");
  if (!Array.isArray(admins) || !admins.includes(actor) || !Array.isArray(current)) {
    throw new HttpsError("permission-denied", "مشرفو المجموعة فقط يمكنهم إضافة أعضاء.");
  }
  const fresh = additions.filter(uid => !current.includes(uid));
  if (current.length + fresh.length > 50) throw new HttpsError("resource-exhausted", "الحد الأقصى للمجموعة 50 عضواً.");
  await assertSamePrivateChatRole([...current, ...fresh]);
  await Promise.all(fresh.map(async uid => { await ensureNoBlock(db, actor, uid); await ensureFriends(db, actor, uid); }));
  const profiles = await Promise.all(fresh.map(uid => db.doc("publicProfiles/" + uid).get()));
  if (profiles.some(profile => !profile.exists)) throw new HttpsError("not-found", "تعذر العثور على ملف أحد الأعضاء.");
  await ref.update({ participants: [...current, ...fresh].sort(), updatedAt: FieldValue.serverTimestamp() });
  return { participantCount: current.length + fresh.length };
});
