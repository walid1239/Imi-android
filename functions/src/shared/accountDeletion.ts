import { createHash } from "node:crypto";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import type { Bucket, File } from "@google-cloud/storage";

const RATE_LIMIT_OPERATIONS = [
  "createStatus", "sendFriendRequest", "createOrGetDirectConversation",
  "acceptFriendRequest", "rejectFriendRequest", "removeFriend", "blockUser",
  "unblockUser", "createGroupConversation", "addGroupParticipants",
  "prepareReel", "submitReel", "reviewReel", "deleteMyAccount",
] as const;

function addStoragePath(paths: Set<string>, value: unknown, uid: string): void {
  if (typeof value !== "string" || value.includes("..")) return;
  const allowed = [
    `users/${uid}/`, `teacher-verification/${uid}/`, `teachers/${uid}/`,
    `teacher-content/${uid}/`, `reels/${uid}/`, `statuses/${uid}/`,
  ];
  if (allowed.some(prefix => value.startsWith(prefix))) paths.add(value);
}

async function deleteRefs(db: Firestore, refs: DocumentReference[]): Promise<void> {
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(offset, offset + 400)) batch.delete(ref);
    await batch.commit();
  }
}

async function collectFiles(bucket: Bucket, prefixes: Set<string>, exactPaths: Set<string>): Promise<File[]> {
  const files = new Map<string, File>();
  for (const prefix of prefixes) {
    const [found] = await bucket.getFiles({ prefix });
    for (const file of found) files.set(file.name, file);
  }
  for (const path of exactPaths) files.set(path, bucket.file(path));
  return [...files.values()];
}

export async function cleanupAccountData(db: Firestore, bucket: Bucket, uid: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{2,128}$/.test(uid)) throw new Error("Invalid account UID.");

  const [conversations, callerCalls, calleeCalls, teacherContent, outgoingRequests,
    incomingRequests, reports, reels, statuses, liveSessions, claimsOutbox,
    friendRefs, blockedRefs, application, teacherProfile, publicProfile] = await Promise.all([
    db.collection("conversations").where("participants", "array-contains", uid).get(),
    db.collection("calls").where("callerUid", "==", uid).get(),
    db.collection("calls").where("calleeUid", "==", uid).get(),
    db.collection("teacherContent").where("ownerUid", "==", uid).get(),
    db.collection("friendRequests").where("fromUid", "==", uid).get(),
    db.collection("friendRequests").where("toUid", "==", uid).get(),
    db.collection("contentReports").where("reporterUid", "==", uid).get(),
    db.collection("reels").where("ownerUid", "==", uid).get(),
    db.collection("statuses").where("ownerUid", "==", uid).get(),
    db.collection("teacherLiveSessions").where("teacherUid", "==", uid).get(),
    db.collection("teacherClaimsOutbox").where("targetUid", "==", uid).get(),
    db.collectionGroup("friends").where("uid", "==", uid).get(),
    db.collectionGroup("blockedUsers").where("uid", "==", uid).get(),
    db.doc(`teacherApplications/${uid}`).get(),
    db.doc(`teacherProfiles/${uid}`).get(),
    db.doc(`publicProfiles/${uid}`).get(),
  ]);

  const storagePrefixes = new Set<string>([
    `users/${uid}/`, `teacher-verification/${uid}/`, `teachers/${uid}/`,
    `teacher-content/${uid}/`, `reels/${uid}/`, `statuses/${uid}/`,
  ]);
  const exactStoragePaths = new Set<string>();
  const directConversations: DocumentReference[] = [];
  const emptyGroups: DocumentReference[] = [];
  const groupUpdates: Array<{ ref: DocumentReference; participants: string[]; admins: string[]; ownerUid: string | null }> = [];

  for (const conversation of conversations.docs) {
    const participants = conversation.get("participants");
    if (!Array.isArray(participants)) continue;
    const id = conversation.id;
    if (conversation.get("type") === "group") {
      const remaining = participants.filter((member: unknown): member is string => typeof member === "string" && member !== uid);
      const admins = Array.isArray(conversation.get("admins"))
        ? conversation.get("admins").filter((member: unknown): member is string => typeof member === "string" && member !== uid)
        : [];
      const ownerUid = conversation.get("ownerUid") === uid ? remaining[0] ?? null : String(conversation.get("ownerUid") ?? "") || null;
      if (remaining.length === 0) {
        emptyGroups.push(conversation.ref);
        storagePrefixes.add(`conversations/${id}/`);
      } else {
        groupUpdates.push({
          ref: conversation.ref,
          participants: remaining,
          admins: admins.length ? admins : [ownerUid].filter((value): value is string => Boolean(value)),
          ownerUid,
        });
        storagePrefixes.add(`conversations/${id}/${uid}/`);
      }
    } else {
      directConversations.push(conversation.ref);
      storagePrefixes.add(`conversations/${id}/`);
    }
  }

  const callRefs = [...new Map([...callerCalls.docs, ...calleeCalls.docs].map(item => [item.ref.path, item.ref])).values()];
  for (const item of teacherContent.docs) addStoragePath(exactStoragePaths, item.get("mediaPath") ?? item.get("storagePath"), uid);
  for (const item of reels.docs) addStoragePath(exactStoragePaths, item.get("storagePath") ?? item.get("mediaPath"), uid);
  for (const item of statuses.docs) addStoragePath(exactStoragePaths, item.get("mediaPath") ?? item.get("storagePath"), uid);
  for (const item of liveSessions.docs) addStoragePath(exactStoragePaths, item.get("recordingPath") ?? item.get("storagePath"), uid);
  if (application.exists) addStoragePath(exactStoragePaths, application.get("evidencePath"), uid);
  if (teacherProfile.exists) addStoragePath(exactStoragePaths, teacherProfile.get("photoPath"), uid);
  if (publicProfile.exists) addStoragePath(exactStoragePaths, publicProfile.get("photoPath"), uid);

  // Storage failures abort before Firestore/Auth deletion; retry remains possible.
  const files = await collectFiles(bucket, storagePrefixes, exactStoragePaths);
  await Promise.all(files.map(file => file.delete({ ignoreNotFound: true })));

  for (let offset = 0; offset < groupUpdates.length; offset += 400) {
    const batch = db.batch();
    for (const item of groupUpdates.slice(offset, offset + 400)) {
      batch.update(item.ref, {
        participants: item.participants,
        admins: item.admins,
        ownerUid: item.ownerUid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  await Promise.all([...directConversations, ...emptyGroups, ...callRefs].map(ref => db.recursiveDelete(ref)));

  const requests = [...outgoingRequests.docs, ...incomingRequests.docs];
  const uniqueRefs = (items: Array<{ ref: DocumentReference }>) =>
    [...new Map(items.map(item => [item.ref.path, item.ref])).values()];
  await Promise.all([
    deleteRefs(db, uniqueRefs([...requests, ...reports.docs, ...teacherContent.docs, ...reels.docs,
      ...statuses.docs, ...liveSessions.docs, ...claimsOutbox.docs, ...friendRefs.docs, ...blockedRefs.docs])),
    db.recursiveDelete(db.doc(`users/${uid}`)),
    db.doc(`publicProfiles/${uid}`).delete(),
    db.doc(`teacherApplications/${uid}`).delete(),
    db.doc(`teacherProfiles/${uid}`).delete(),
    db.doc(`reportRateLimits/${uid}`).delete(),
  ]);

  const rateLimitRefs = RATE_LIMIT_OPERATIONS.map(operation => {
    const key = createHash("sha256").update(`${operation}:${uid}`).digest("hex");
    return db.doc(`apiRateLimits/${key}`);
  });
  await deleteRefs(db, rateLimitRefs);
}
