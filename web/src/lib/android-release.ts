const RELEASE_API = 'https://api.github.com/repos/walid1239/Imi-android/releases/tags/imi-preview';
const APK_ASSET_NAME = 'app-debug.apk';

export type AndroidReleaseAsset = {
  url: string;
  size: number;
  digest?: string | null;
};

export async function getAndroidPreviewAsset(): Promise<{
  tagName: string;
  asset: AndroidReleaseAsset;
} | null> {
  try {
    const response = await fetch(RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'IMI-preview-download',
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const release = await response.json() as {
      tag_name?: string;
      assets?: Array<{ name?: string; browser_download_url?: string; size?: number; digest?: string | null }>;
    };
    const asset = release.assets?.find((item) => item.name === APK_ASSET_NAME);
    if (!release.tag_name || !asset?.browser_download_url || typeof asset.size !== 'number') return null;

    return {
      tagName: release.tag_name,
      asset: {
        url: asset.browser_download_url,
        size: asset.size,
        digest: asset.digest,
      },
    };
  } catch {
    return null;
  }
}
