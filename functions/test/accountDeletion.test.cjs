const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanupAccountData } = require("../lib/shared/accountDeletion.js");

function makeHarness({ failStorage = false, failFirstRecursiveDelete = false } = {}) {
  const state = {
    storageDeleteCalls: 0,
    storageObjectsDeleted: 0,
    recursiveDeleteCalls: 0,
    documentDeleteCalls: 0,
    batchCommits: 0,
    failStorage,
    failFirstRecursiveDelete,
  };
  const refs = new Map();
  function ref(path) {
    if (!refs.has(path)) {
      refs.set(path, {
        path,
        async get() {
          return { id: path.split("/").at(-1), exists: false, ref: this, get: () => undefined };
        },
        async delete() { state.documentDeleteCalls += 1; },
      });
    }
    return refs.get(path);
  }

  const conversation = {
    id: "direct_123",
    ref: ref("conversations/direct_123"),
    get(field) {
      if (field === "participants") return ["teacher_123"];
      if (field === "type") return "direct";
      return undefined;
    },
  };
  const emptySnapshot = { docs: [] };
  const queryFor = name => ({
    where() { return this; },
    async get() { return name === "conversations" ? { docs: [conversation] } : emptySnapshot; },
    doc(id) { return ref(`${name}/${id}`); },
  });

  const db = {
    collection(name) { return queryFor(name); },
    collectionGroup() { return queryFor("collectionGroup"); },
    doc(path) { return ref(path); },
    batch() {
      return {
        delete() {},
        update() {},
        async commit() { state.batchCommits += 1; },
      };
    },
    async recursiveDelete(documentRef) {
      state.recursiveDeleteCalls += 1;
      if (state.failFirstRecursiveDelete) {
        state.failFirstRecursiveDelete = false;
        throw new Error("simulated Firestore interruption");
      }
      state.documentDeleteCalls += 1;
      return documentRef.path;
    },
  };

  const storedFile = {
    name: "users/teacher_123/avatar.png",
    async delete() {
      state.storageDeleteCalls += 1;
      if (state.failStorage) throw new Error("simulated Storage outage");
      if (state.storageObjectsDeleted === 0) state.storageObjectsDeleted += 1;
    },
  };
  const bucket = {
    async getFiles({ prefix }) {
      return [prefix === "users/teacher_123/" && state.storageObjectsDeleted === 0 ? [storedFile] : []];
    },
    file(path) { return { ...storedFile, name: path }; },
  };

  return { db, bucket, state };
}

test("account cleanup can resume after a mid-cleanup Firestore failure without deleting Storage objects twice", async () => {
  const harness = makeHarness({ failFirstRecursiveDelete: true });

  await assert.rejects(
    cleanupAccountData(harness.db, harness.bucket, "teacher_123"),
    /simulated Firestore interruption/,
  );
  assert.equal(harness.state.storageObjectsDeleted, 1);
  assert.equal(harness.state.recursiveDeleteCalls, 1);

  await cleanupAccountData(harness.db, harness.bucket, "teacher_123");
  assert.equal(harness.state.storageObjectsDeleted, 1);
  assert.equal(harness.state.recursiveDeleteCalls, 3);
  assert.ok(harness.state.documentDeleteCalls > 0);
});

test("account cleanup does not swallow Storage deletion errors or begin Firestore mutation", async () => {
  const harness = makeHarness({ failStorage: true });

  await assert.rejects(
    cleanupAccountData(harness.db, harness.bucket, "teacher_123"),
    /simulated Storage outage/,
  );
  assert.equal(harness.state.storageDeleteCalls, 1);
  assert.equal(harness.state.recursiveDeleteCalls, 0);
  assert.equal(harness.state.documentDeleteCalls, 0);
  assert.equal(harness.state.batchCommits, 0);
});
