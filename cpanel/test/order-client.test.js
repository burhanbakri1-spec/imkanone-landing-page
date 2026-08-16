import assert from "node:assert/strict";
import test from "node:test";
import { createOrder, createOrderSubmissionTracker } from "../src/utils/orders.js";

test("one logical submission reuses its key and changed/new submissions rotate it", () => {
  const tracker = createOrderSubmissionTracker();
  const payload = { items: [{ productId: "p1", quantity: 1 }], customer: { name: "Buyer" } };
  const first = tracker.keyFor(payload);
  assert.equal(tracker.keyFor(structuredClone(payload)), first);

  const changed = tracker.keyFor({ ...payload, items: [{ productId: "p1", quantity: 2 }] });
  assert.notEqual(changed, first);

  tracker.confirm();
  assert.notEqual(tracker.keyFor(payload), first);
});

test("order transport requires and preserves the caller-owned key", async (t) => {
  const priorStorage = globalThis.localStorage;
  const priorFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: () => null, removeItem() {}, setItem() {} };
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(init);
    return new Response(JSON.stringify({ id: "o1" }), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  t.after(() => {
    globalThis.localStorage = priorStorage;
    globalThis.fetch = priorFetch;
  });

  const payload = { items: [{ productId: "p1", quantity: 1 }], customer: { name: "Buyer" } };
  await assert.rejects(createOrder(payload), /stable Idempotency-Key is required/);
  await createOrder({ ...payload, idempotencyKey: "logical-submit-1" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers["Idempotency-Key"], "logical-submit-1");
});
