import { createHash } from "node:crypto";

/** Stable, symmetric ID for a one-to-one conversation. */
export function directConversationId(firstUid: string, secondUid: string): string {
  if (!firstUid || !secondUid || firstUid === secondUid) {
    throw new Error("Direct conversation requires two distinct user IDs.");
  }
  const canonicalPair = [firstUid, secondUid]
    .sort()
    .map((uid) => `${uid.length}:${uid}`)
    .join("");
  return `direct_${createHash("sha256").update(canonicalPair).digest("hex")}`;
}
