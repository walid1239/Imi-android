const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CoreError, createStatus, sendFriendRequest, createOrGetDirectConversation,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  blockUser, unblockUser, createGroupConversation, addGroupParticipants,
} = require("../lib/shared/serverCore.js");
const { directConversationId } = require("../lib/conversationLogic.js");

function makeStore(seed = {}, teachers = {}) {
  const docs = new Map(Object.entries(seed));
  let nextId = 0;
  const now = 1_800_000_000_000;
  return {
    docs,
    runTransaction: async work => work({
      get: async path => ({ exists: docs.has(path), data: docs.get(path) ?? {} }),
      create: (path, data) => {
        if (docs.has(path)) throw new Error("already exists");
        docs.set(path, data);
      },
      set: (path, data) => docs.set(path, data),
      update: (path, data) => {
        if (!docs.has(path)) throw new Error("missing document");
        docs.set(path, { ...docs.get(path), ...data });
      },
      delete: path => docs.delete(path),
    }),
    newId: () => `status-${++nextId}`,
    nowMillis: () => now,
    serverTimestamp: () => ({ serverTimestamp: true }),
    timestampFromMillis: value => ({ millis: value, toMillis() { return value; } }),
    timestampToMillis: value => value && typeof value.toMillis === "function" ? value.toMillis() : undefined,
    isVerifiedTeacher: async uid => teachers[uid] === true,
    directConversationId,
    getDocument: async path => ({ exists: docs.has(path), data: docs.get(path) ?? {} }),
    getActiveCalls: async () => [],
  };
}

test("createStatus creates text-only status with exact 28-hour expiry", async () => {
  const store = makeStore();
  const result = await createStatus(store, "user_A", { text: " مرحبا " });
  assert.equal(result.statusId, "status-1");
  assert.equal(result.expiresAtMillis, 1_800_100_800_000);
  assert.equal(result.mediaPath, null);
  assert.equal(store.docs.get("users/user_A/statuses/status-1").text, "مرحبا");
});

test("createStatus rejects media on Spark and enforces the cooldown", async () => {
  const store = makeStore();
  await assert.rejects(createStatus(store, "user_A", { text: "", mediaType: "image/png" }),
    error => error instanceof CoreError && error.code === "failed-precondition");
  await createStatus(store, "user_A", { text: "first" });
  await assert.rejects(createStatus(store, "user_A", { text: "second" }),
    error => error instanceof CoreError && error.code === "resource-exhausted");
});

test("sendFriendRequest validates target and stores a pending request atomically", async () => {
  const store = makeStore({ "publicProfiles/user_B": { displayName: "B" } });
  const result = await sendFriendRequest(store, "user_A", { toUid: "user_B" });
  assert.equal(result.status, "pending");
  assert.equal(store.docs.get("friendRequests/user_A__user_B").fromUid, "user_A");
  await assert.rejects(sendFriendRequest(store, "user_A", { toUid: "user_B" }),
    error => error instanceof CoreError && error.code === "already-exists");
});

test("sendFriendRequest refuses teacher/student private relationships", async () => {
  const store = makeStore({ "publicProfiles/student": {} }, { teacher: true });
  await assert.rejects(sendFriendRequest(store, "teacher", { toUid: "student" }),
    error => error instanceof CoreError && error.code === "permission-denied");
});

test("direct conversation ID is symmetric and conversation creation checks both profiles", async () => {
  const store = makeStore({
    "publicProfiles/user_A": {},
    "publicProfiles/user_B": {},
  });
  const result = await createOrGetDirectConversation(store, "user_A", { otherUid: "user_B" });
  const reverse = await createOrGetDirectConversation(store, "user_B", { otherUid: "user_A" });
  assert.equal(result.conversationId, reverse.conversationId);
  const conversation = store.docs.get(`conversations/${result.conversationId}`);
  assert.deepEqual(conversation.participants, ["user_A", "user_B"]);
});

test("acceptFriendRequest verifies recipient, blocks and creates reciprocal friendship", async () => {
  const store = makeStore({
    "friendRequests/sender__recipient": { fromUid: "sender", toUid: "recipient", status: "pending" },
  });
  await assert.rejects(acceptFriendRequest(store, "intruder", { requestId: "sender__recipient" }),
    error => error instanceof CoreError && error.code === "permission-denied");
  const result = await acceptFriendRequest(store, "recipient", { requestId: "sender__recipient" });
  assert.equal(result.status, "accepted");
  assert.equal(store.docs.get("users/recipient/friends/sender").status, "accepted");
  assert.equal(store.docs.get("users/sender/friends/recipient").status, "accepted");
});

test("rejectFriendRequest is recipient-only and idempotent after rejection", async () => {
  const store = makeStore({
    "friendRequests/sender__recipient": { fromUid: "sender", toUid: "recipient", status: "pending" },
  });
  await assert.rejects(rejectFriendRequest(store, "intruder", { requestId: "sender__recipient" }),
    error => error instanceof CoreError && error.code === "permission-denied");
  assert.equal((await rejectFriendRequest(store, "recipient", { requestId: "sender__recipient" })).status, "rejected");
  assert.equal((await rejectFriendRequest(store, "recipient", { requestId: "sender__recipient" })).status, "rejected");
});

test("removeFriend deletes reciprocal edges and marks accepted requests removed", async () => {
  const store = makeStore({
    "users/a/friends/b": { status: "accepted" },
    "users/b/friends/a": { status: "accepted" },
    "friendRequests/a__b": { fromUid: "a", toUid: "b", status: "accepted" },
  });
  assert.equal((await removeFriend(store, "a", { friendUid: "b" })).status, "removed");
  assert.equal(store.docs.has("users/a/friends/b"), false);
  assert.equal(store.docs.has("users/b/friends/a"), false);
  assert.equal(store.docs.get("friendRequests/a__b").status, "removed");
});

test("blockUser removes friendship, closes direct chat and active calls", async () => {
  const store = makeStore({
    "publicProfiles/b": {},
    "users/a/friends/b": { status: "accepted" }, "users/b/friends/a": { status: "accepted" },
    "conversations/a__b": { participants: ["a", "b"], status: "active" },
    "friendRequests/a__b": { status: "pending" },
  });
  assert.equal((await blockUser(store, "a", { targetUid: "b" })).status, "blocked");
  assert.equal(store.docs.has("users/a/blockedUsers/b"), true);
  assert.equal(store.docs.has("users/a/friends/b"), false);
  assert.equal(store.docs.get("conversations/a__b").status, "blocked");
});
test("unblockUser only restores direct chat when reverse block is absent", async () => {
  const store = makeStore({
    "users/a/blockedUsers/b": {}, "users/b/blockedUsers/a": {},
    "conversations/a__b": { status: "blocked" },
  });
  await unblockUser(store, "a", { targetUid: "b" });
  assert.equal(store.docs.has("users/a/blockedUsers/b"), false);
  assert.equal(store.docs.get("conversations/a__b").status, "blocked");
});
test("createGroupConversation requires mutual friendship and creates admin membership", async () => {
  const store = makeStore({
    "publicProfiles/a": {}, "publicProfiles/b": {}, "publicProfiles/c": {},
    "users/a/friends/b": { status: "accepted" }, "users/b/friends/a": { status: "accepted" },
    "users/a/friends/c": { status: "accepted" }, "users/c/friends/a": { status: "accepted" },
  });
  const result = await createGroupConversation(store, "a", { name: "الفريق", participantUids: ["b", "c"] });
  const group = store.docs.get("conversations/" + result.conversationId);
  assert.deepEqual(group.participants, ["a", "b", "c"]);
  assert.deepEqual(group.admins, ["a"]);
});
test("addGroupParticipants is admin-only and revalidates mutual friendship", async () => {
  const store = makeStore({
    "conversations/g": { type: "group", admins: ["a"], participants: ["a", "b"] },
    "publicProfiles/c": {},
    "users/a/friends/c": { status: "accepted" }, "users/c/friends/a": { status: "accepted" },
  });
  await assert.rejects(addGroupParticipants(store, "x", { conversationId: "g", participantUids: ["c"] }),
    error => error instanceof CoreError && error.code === "permission-denied");
  const result = await addGroupParticipants(store, "a", { conversationId: "g", participantUids: ["c"] });
  assert.equal(result.participantCount, 3);
});
