import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const firebaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );

  return NextResponse.json({
    status: 'ok',
    service: 'imi-web',
    timestamp: new Date().toISOString(),
    firebase: { configured: firebaseConfigured, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null },
    note: 'This endpoint reports application configuration, not a verified Firebase production connectivity check.',
  });
}
