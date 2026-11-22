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

export async function GET(): Promise<Response> {
  const results: Array<{ module: string; ok: boolean; error?: string }> = [];
  for (const probe of probes) {
    try {
      await probe.load();
      results.push({ module: probe.name, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown module-load error";
      results.push({
        module: probe.name,
        ok: false,
        error: message.replace(/[\\r\\n\\t]+/g, " ").slice(0, 240),
      });
    }
  }
  return Response.json(
    { diagnostic: "module-load-only", results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
