import { handleDeleteAccount } from "@/lib/server/imi-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleDeleteAccount(request);
}
