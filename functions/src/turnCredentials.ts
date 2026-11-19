import { createHmac } from "node:crypto";

export type TurnIceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

export type TurnConfiguration = {
  configured: boolean;
  iceServers: TurnIceServer[];
  expiresAt: number | null;
};

export function createTurnConfiguration(
  uid: string,
  sharedSecret: string | undefined,
  urlsValue: string | undefined,
  nowMillis = Date.now(),
  ttlSeconds = 60 * 60,
): TurnConfiguration {
  const urls = (urlsValue ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.startsWith("turn:") || url.startsWith("turns:"));
  if (!uid || !sharedSecret || !urls.length) {
    return {
      configured: false,
      // No public STUN/TURN fallback: IMI uses only operator-owned Coturn.
      iceServers: [],
      expiresAt: null,
    };
  }
  const expiresAt = Math.floor(nowMillis / 1000) + Math.min(Math.max(ttlSeconds, 300), 6 * 60 * 60);
  const username = `${expiresAt}:${uid}`;
  const credential = createHmac("sha1", sharedSecret).update(username).digest("base64");
  return {
    configured: true,
    iceServers: [{ urls, username, credential }],
    expiresAt,
  };
}
