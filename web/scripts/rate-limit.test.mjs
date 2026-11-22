import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserveRateLimitWindows } from '../src/lib/server/rate-limit-core.mjs';

class MemoryRateLimitStore {
  state = new Map();
  lock = Promise.resolve();

  async runTransaction(work) {
    const previous = this.lock;
    let release;
    this.lock = new Promise(resolve => { release = resolve; });
    await previous;
    const writes = new Map();
    const transaction = {
      get: async key => this.state.has(key) ? structuredClone(this.state.get(key)) : null,
      set: (key, value) => writes.set(key, structuredClone(value))
    };
    try {
      await work(transaction);
      for (const [key, value] of writes) this.state.set(key, value);
    } finally {
      release();
    }
  }
}

const minutePolicy = [{ label: 'minute', count: 2, windowMs: 60_000 }];

test('allows the configured number and rejects the next request', async () => {
  const store = new MemoryRateLimitStore();
  await reserveRateLimitWindows(store, 'user-op', minutePolicy, 1000);
  await reserveRateLimitWindows(store, 'user-op', minutePolicy, 2000);
  await assert.rejects(reserveRateLimitWindows(store, 'user-op', minutePolicy, 3000), { code: 'RATE_LIMIT' });
  assert.equal(store.state.get('user-op').windows.minute.count, 2);
});

test('resets a window after its duration without creating another document', async () => {
  const store = new MemoryRateLimitStore();
  await reserveRateLimitWindows(store, 'user-op', minutePolicy, 1000);
  await reserveRateLimitWindows(store, 'user-op', minutePolicy, 2000);
  await assert.rejects(reserveRateLimitWindows(store, 'user-op', minutePolicy, 3000), { code: 'RATE_LIMIT' });
  await reserveRateLimitWindows(store, 'user-op', minutePolicy, 61_001);
  assert.deepEqual(store.state.get('user-op').windows.minute, { windowStartedAt: 61_001, count: 1 });
  assert.equal(store.state.size, 1);
});

test('concurrent reservations remain atomic at the configured limit', async () => {
  const store = new MemoryRateLimitStore();
  const outcomes = await Promise.allSettled(
    Array.from({ length: 12 }, () => reserveRateLimitWindows(store, 'parallel-op', [{ label: 'hour', count: 3, windowMs: 3_600_000 }], 5000))
  );
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 3);
  assert.equal(outcomes.filter(result => result.status === 'rejected' && result.reason.code === 'RATE_LIMIT').length, 9);
  assert.equal(store.state.get('parallel-op').windows.hour.count, 3);
});

test('all policies reserve atomically and do not partially increment on rejection', async () => {
  const store = new MemoryRateLimitStore();
  const policies = [
    { label: 'hour', count: 3, windowMs: 3_600_000 },
    { label: 'day', count: 1, windowMs: 86_400_000 }
  ];
  await reserveRateLimitWindows(store, 'friend-request', policies, 1000);
  await assert.rejects(reserveRateLimitWindows(store, 'friend-request', policies, 2000), { code: 'RATE_LIMIT' });
  assert.equal(store.state.get('friend-request').windows.hour.count, 1);
  assert.equal(store.state.get('friend-request').windows.day.count, 1);
});
