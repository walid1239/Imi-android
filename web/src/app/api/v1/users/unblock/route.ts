import { handleImiPost } from "@/lib/server/imi-api";
export const runtime = "nodejs";
export async function POST(request: Request) { return handleImiPost(request, "unblockUser"); }
