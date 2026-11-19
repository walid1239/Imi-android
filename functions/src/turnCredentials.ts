import { createHmac } from "node:crypto";

export type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

export type IceConfiguration = {
  configured: boolean;
  iceServers: IceServer[];
  expiresAt: number | null;
};

export function resolveIceUid(
  auth: { uid?: string; token?: Record<string, unknown> } | null | undefined,
  allowAnonymous: boolean,
): string | null {
  const uid = auth?.uid?.trim();
  if (!uid) return null;
  const provider = (auth?.token?.firebase as { sign_in_provider?: unknown } | undefined)?.sign_in_provider;
  if (provider === "anonymous" && !allowAnonymous) return null;
  return uid;
}

export function nextRateLimitState(
  windowStartedAtMs: number | undefined,
  count: number | undefined,
  nowMs: number,
  limit: number,
  windowMs = 60_000,
): { allowed: boolean; windowStartedAtMs: number; count: number } {
  if (!Number.isFinite(limit) || limit < 1) {
    return { allowed: false, windowStartedAtMs: nowMs, count: 0 };
  }
  if (
    !Number.isFinite(windowStartedAtMs) ||
    nowMs < (windowStartedAtMs as number) ||
    nowMs - (windowStartedAtMs as number) >= windowMs
  ) {
    return { allowed: true, windowStartedAtMs: nowMs, count: 1 };
  }
  const currentCount = Number.isFinite(count) && (count as number) >= 0 ? count as number : 0;
  if (currentCount >= limit) {
    return { allowed: false, windowStartedAtMs: windowStartedAtMs as number, count: currentCount };
  }
  return { allowed: true, windowStartedAtMs: windowStartedAtMs as number, count: currentCount + 1 };
}

function parseStunUrls(value: string | undefined): string[] {
  const urls = (value ?? "stun:stun.l.google.com:19302")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => /^stuns?:[a-z0-9.\-\[\]:]+(?::\d+)?$/i.test(url));
  return urls.length ? urls : ["stun:stun.l.google.com:19302"];
}

export function createIceServerConfiguration(
  uid: string,
  sharedSecret: string | undefined,
  hostValue: string | undefined,
  portValue: string | undefined,
  stunUrlsValue: string | undefined,
  nowMillis = Date.now(),
  ttlSecondsValue = 3600,
): IceConfiguration {
  const stunServers: IceServer[] = [{ urls: parseStunUrls(stunUrlsValue) }];
  const host = (hostValue ?? "").trim();
  const port = Number(portValue ?? "3478");
  if (
    !uid ||
    !sharedSecret ||
    !host ||
    !/^[a-z0-9.-]+$/i.test(host) ||
    host.startsWith(".") ||
    host.endsWith(".") ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return { configured: false, iceServers: stunServers, expiresAt: null };
  }

  const ttlSeconds = Number.isFinite(ttlSecondsValue)
    ? Math.min(Math.max(Math.floor(ttlSecondsValue), 300), 3600)
    : 3600;
  const expiresAt = Math.floor(nowMillis / 1000) + ttlSeconds;
  const username = `${expiresAt}:${uid}`;
  const credential = createHmac("sha1", sharedSecret).update(username).digest("base64");
  return {
    configured: true,
    iceServers: [
      ...stunServers,
      {
        urls: [
          `turn:${host}:${port}?transport=udp`,
          `turn:${host}:${port}?transport=tcp`,
        ],
        username,
        credential,
      },
    ],
    expiresAt,
  };
}
