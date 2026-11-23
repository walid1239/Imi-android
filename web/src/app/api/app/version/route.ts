import { NextResponse } from 'next/server';
import { getAndroidPreviewAsset } from '@/lib/android-release';

export const dynamic = 'force-dynamic';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET() {
  const release = await getAndroidPreviewAsset();
  if (!release) {
    return NextResponse.json({
      exists: false,
      versionName: null,
      fileSize: 0,
      fileSizeFormatted: null,
      sha256: null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({
    exists: true,
    versionName: release.tagName,
    fileSize: release.asset.size,
    fileSizeFormatted: formatBytes(release.asset.size),
    sha256: release.asset.digest?.replace(/^sha256:/, '') ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
