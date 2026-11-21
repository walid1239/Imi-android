import { handleImiPost } from "@/lib/server/imi-api";

export const runtime = "nodejs";
export const POST = (request: Request) => handleImiPost(request, "completeCourseLesson");
