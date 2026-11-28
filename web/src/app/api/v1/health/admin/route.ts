import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminApp } from "@/lib/server/imi-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (process.env.IMI_ADMIN_HEALTH !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || !match[1] || match[1].length > 8192) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const app = adminApp(request);
    const decoded = await getAuth(app).verifyIdToken(match[1], true);
    if (decoded.admin !== true) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const snapshot = await getFirestore(app).doc("adminHealth/probe").get();
    if (!snapshot.exists || snapshot.get("status") !== "ok") {
      return NextResponse.json({ error: "Admin health probe is not seeded." }, { status: 503 });
    }
    return NextResponse.json({
      status: "ok",
      service: "imi-admin-api",
      firestoreRead: true,
    });
  } catch {
    return NextResponse.json({ error: "Admin health check unavailable." }, { status: 503 });
  }
}
