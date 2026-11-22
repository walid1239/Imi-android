export type TerminalCallStatus = "accepted" | "rejected" | "ended" | "missed";

export function terminalCallResponse(status: unknown): { status: TerminalCallStatus } | null {
  if (status === "accepted" || status === "rejected" || status === "ended" || status === "missed") {
    return { status };
  }
  return null;
}
