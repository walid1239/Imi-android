export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Probe = { name: string; load: () => Promise<unknown> };

const probes: Probe[] = [
  { name: "firebase-admin/app", load: () => import("firebase-admin/app") },
  { name: "firebase-admin/auth", load: () => import("firebase-admin/auth") },
  { name: "firebase-admin/firestore", load: () => import("firebase-admin/firestore") },
  { name: "node:crypto", load: () => import("node:crypto") },
  { name: "imi-api", load: () => import("@/lib/server/imi-api") },
];

function safeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { errorName: "UnknownError", error: "Unknown module-load error" };
  }
  const stack = typeof error.stack === "string"
    ? error.stack.split("\n").slice(0, 10).join("\n").slice(0, 1400)
    : undefined;
  const cause = error.cause instanceof Error
    ? { causeName: error.cause.name, cause: error.cause.message.slice(0, 240) }
    : undefined;
  return {
    errorName: error.name.slice(0, 80),
    error: error.message.replace(/[\r\n\t]+/g, " ").slice(0, 240),
    ...(cause ? { cause } : {}),
    ...(stack ? { stack } : {}),
  };
}

export async function GET(): Promise<Response> {
  const results: Array<{ module: string; ok: boolean; errorName?: string; error?: string; cause?: { causeName: string; cause: string }; stack?: string }> = [];
  for (const probe of probes) {
    try {
      await probe.load();
      results.push({ module: probe.name, ok: true });
    } catch (error) {
      results.push({ module: probe.name, ok: false, ...safeError(error) });
    }
  }
  return Response.json(
    { diagnostic: "module-load-only", results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
