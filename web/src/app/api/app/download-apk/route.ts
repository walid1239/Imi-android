import { NextResponse } from 'next/server';
import { getAndroidPreviewAsset } from '@/lib/android-release';

export const dynamic = 'force-dynamic';

export async function GET() {
  const release = await getAndroidPreviewAsset();
  if (!release) {
    return NextResponse.json(
      { error: 'ملف تثبيت IMI غير منشور حالياً.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.redirect(release.asset.url, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  });
}
