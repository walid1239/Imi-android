import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export const deleteMyAccount = onCall<{ confirmation?: unknown }>({ timeoutSeconds: 540, memory: "512MiB" }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  // Deletion remains disabled until every owned collection, subcollection,
  // cross-user reference, and Storage object has an Emulator-proven cleanup path.
  if (process.env.IMI_ACCOUNT_DELETION_ENABLED !== "true") {
    throw new HttpsError("failed-precondition", "حذف الحساب معطّل مؤقتاً حتى اكتمال تدقيق الحذف واختبارات عدم بقاء البيانات.");
  }
  if (request.data?.confirmation !== "DELETE") {
    throw new HttpsError("invalid-argument", "اكتب DELETE لتأكيد حذف الحساب وبياناته.");
  }
  const authTime = Number(request.auth?.token.auth_time ?? 0) * 1000;
  if (!authTime || Date.now() - authTime > 5 * 60_000) {
    throw new HttpsError("failed-precondition", "لأمان حسابك، سجّل الدخول من جديد ثم أعد طلب الحذف.");
  }

  const db = getFirestore();
  const bucket = getStorage().bucket();

  // Remove memberships from conversations; preserve group history for remaining members.
  const conversations = await db.collection("conversations").where("participants", "array-contains", uid).get();
  for (let i = 0; i < conversations.docs.length; i += 400) {
    const batch = db.batch();
    for (const snap of conversations.docs.slice(i, i + 400)) {
      const participants = snap.get("participants");
      if (!Array.isArray(participants)) continue;
      if (snap.get("type") === "group") {
        const remaining = participants.filter((member: unknown) => member !== uid);
        const admins = Array.isArray(snap.get("admins")) ? snap.get("admins").filter((member: unknown) => member !== uid) : [];
        const nextOwner = snap.get("ownerUid") === uid ? remaining[0] ?? null : snap.get("ownerUid");
        if (remaining.length === 0) batch.delete(snap.ref);
        else batch.update(snap.ref, { participants: remaining, admins: admins.length ? admins : [nextOwner].filter(Boolean), ownerUid: nextOwner, updatedAt: new Date() });
      } else {
        batch.update(snap.ref, { participants: [], status: "deleted", updatedAt: new Date() });
      }
    }
    await batch.commit();
  }

  // Remove calls involving this account.
  const [callerCalls, calleeCalls] = await Promise.all([
    db.collection("calls").where("callerUid", "==", uid).get(),
    db.collection("calls").where("calleeUid", "==", uid).get(),
  ]);
  const callDocs = new Map([...callerCalls.docs, ...calleeCalls.docs].map(doc => [doc.id, doc]));
  for (const call of callDocs.values()) await call.ref.delete();

  // Delete authored teacher content and its media.
  const teacherContent = await db.collection("teacherContent").where("ownerUid", "==", uid).get();
  for (const item of teacherContent.docs) await item.ref.delete();

  // Remove friend requests and authored ephemeral content.
  const requests = await Promise.all([
    db.collection("friendRequests").where("fromUid", "==", uid).get(),
    db.collection("friendRequests").where("toUid", "==", uid).get(),
  ]);
  for (const result of requests) for (const item of result.docs) await item.ref.delete();

  const ownReports = await db.collection("contentReports").where("reporterUid", "==", uid).get();
  for (const report of ownReports.docs) await report.ref.delete();

  for (const collectionName of ["reels", "statuses"]) {
    const result = await db.collection(collectionName).where("ownerUid", "==", uid).get().catch(() => null);
    if (result) for (const item of result.docs) await item.ref.delete();
  }

  await Promise.all([
    db.recursiveDelete(db.doc("users/" + uid)),
    db.doc("publicProfiles/" + uid).delete(),
    db.doc("teacherApplications/" + uid).delete(),
    db.doc("teacherProfiles/" + uid).delete(),
  ]);

  // Remove files under account-owned prefixes. Storage paths are scoped by UID.
  for (const prefix of ["users/" + uid + "/", "teacher-verification/" + uid + "/", "teachers/" + uid + "/", "teacher-content/" + uid + "/", "reels/" + uid + "/"]) {
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(files.map(file => file.delete().catch(() => undefined)));
  }

  await getAuth().deleteUser(uid);
  return { deleted: true };
});
