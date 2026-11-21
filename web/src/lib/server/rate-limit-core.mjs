export async function reserveRateLimitWindows(store, key, policies, now) {
  await store.runTransaction(async transaction => {
    const current = await transaction.get(key);
    const nextWindows = { ...(current?.windows ?? {}) };

    for (const policy of policies) {
      const previous = nextWindows[policy.label];
      const inWindow = previous && now - previous.windowStartedAt < policy.windowMs;
      const windowStartedAt = inWindow ? previous.windowStartedAt : now;
      const count = inWindow ? Number(previous.count ?? 0) : 0;
      if (count >= policy.count) {
        throw Object.assign(new Error('RATE_LIMIT'), { code: 'RATE_LIMIT' });
      }
      nextWindows[policy.label] = { windowStartedAt, count: count + 1 };
    }

    transaction.set(key, { windows: nextWindows });
  });
}
