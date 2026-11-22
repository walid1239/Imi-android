const test = require("node:test");
const assert = require("node:assert/strict");
const { terminalCallResponse } = require("../lib/shared/callLogic.js");

test("respondToCall returns ended idempotently after a block ended the call", () => {
  assert.deepEqual(terminalCallResponse("ended"), { status: "ended" });
});

test("respondToCall returns an existing terminal result on retries", () => {
  assert.deepEqual(terminalCallResponse("accepted"), { status: "accepted" });
  assert.deepEqual(terminalCallResponse("rejected"), { status: "rejected" });
  assert.deepEqual(terminalCallResponse("missed"), { status: "missed" });
});

test("respondToCall only treats terminal states as idempotent", () => {
  assert.equal(terminalCallResponse("ringing"), null);
  assert.equal(terminalCallResponse("connecting"), null);
  assert.equal(terminalCallResponse(undefined), null);
});
