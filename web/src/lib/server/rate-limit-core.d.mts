export type RateLimitWindow = { windowStartedAt: number; count: number };
export type RateLimitPolicy = { label: string; count: number; windowMs: number };
export type RateLimitState = { windows: Record<string, RateLimitWindow> };
export interface RateLimitTransaction {
  get(key: string): Promise<RateLimitState | null>;
  set(key: string, value: RateLimitState): void;
}
export interface RateLimitStore {
  runTransaction<T>(work: (transaction: RateLimitTransaction) => Promise<T>): Promise<T>;
}
export function reserveRateLimitWindows(
  store: RateLimitStore,
  key: string,
  policies: RateLimitPolicy[],
  now: number
): Promise<void>;
