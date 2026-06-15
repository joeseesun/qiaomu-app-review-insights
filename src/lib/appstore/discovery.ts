import { parseAppStoreUrl, validateAppId } from '@/lib/app-store-parser';

export interface AppStoreLookupResult {
  id: string;
  name: string;
  country: string;
  artistName: string;
  artworkUrl: string;
  trackViewUrl: string;
  averageUserRating?: number;
  userRatingCount?: number;
  primaryGenreName?: string;
  version?: string;
  currentVersionReleaseDate?: string;
}

export interface AppResolution {
  app: AppStoreLookupResult;
  candidates: AppStoreLookupResult[];
  source: 'url' | 'id' | 'search';
}

interface ITunesAppResult {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  artworkUrl512?: string;
  trackViewUrl?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  primaryGenreName?: string;
  version?: string;
  currentVersionReleaseDate?: string;
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesAppResult[];
}

const ITUNES_BASE_URL = 'https://itunes.apple.com';

export function normalizeCountry(country?: string): string {
  const cleaned = (country || 'cn').trim().toLowerCase();
  if (cleaned === 'uk') return 'gb';
  return /^[a-z]{2}$/.test(cleaned) ? cleaned : 'cn';
}

export function normalizeArtwork(url?: string): string {
  if (!url) return '';
  return url.replace(/\/\d+x\d+bb\.(png|jpg|jpeg)$/i, '/512x512bb.$1');
}

function mapResult(result: ITunesAppResult, country: string): AppStoreLookupResult {
  return {
    id: String(result.trackId),
    name: result.trackName,
    country,
    artistName: result.artistName,
    artworkUrl: normalizeArtwork(result.artworkUrl512 || result.artworkUrl100),
    trackViewUrl: result.trackViewUrl || '',
    averageUserRating: result.averageUserRating,
    userRatingCount: result.userRatingCount,
    primaryGenreName: result.primaryGenreName,
    version: result.version,
    currentVersionReleaseDate: result.currentVersionReleaseDate,
  };
}

async function fetchItunes<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AppReviewQiaomu/1.0',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Apple API returned HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupAppById(appId: string, country = 'cn'): Promise<AppStoreLookupResult | null> {
  const normalizedCountry = normalizeCountry(country);
  const params = new URLSearchParams({
    id: appId.trim(),
    entity: 'software',
    country: normalizedCountry,
  });

  const data = await fetchItunes<ITunesSearchResponse>(`${ITUNES_BASE_URL}/lookup?${params}`);
  const app = data.results?.[0];

  return app ? mapResult(app, normalizedCountry) : null;
}

export async function searchApps(term: string, country = 'cn', limit = 5): Promise<AppStoreLookupResult[]> {
  const normalizedCountry = normalizeCountry(country);
  const params = new URLSearchParams({
    term: term.trim(),
    entity: 'software',
    country: normalizedCountry,
    limit: String(Math.min(Math.max(limit, 1), 10)),
  });

  const data = await fetchItunes<ITunesSearchResponse>(`${ITUNES_BASE_URL}/search?${params}`);
  return (data.results || []).map((item) => mapResult(item, normalizedCountry));
}

export async function resolveAppQuery(query: string, country = 'cn'): Promise<AppResolution> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('请输入 App Store 链接、App ID 或应用名称');
  }

  const parsedUrl = parseAppStoreUrl(trimmed);
  if (parsedUrl) {
    const app = await lookupAppById(parsedUrl.id, parsedUrl.country);
    if (app) {
      return { app, candidates: [app], source: 'url' };
    }

    return {
      app: {
        id: parsedUrl.id,
        name: parsedUrl.name,
        country: parsedUrl.country,
        artistName: '',
        artworkUrl: '',
        trackViewUrl: trimmed,
      },
      candidates: [],
      source: 'url',
    };
  }

  if (validateAppId(trimmed)) {
    const app = await lookupAppById(trimmed, country);
    if (!app) {
      throw new Error(`没有在 ${normalizeCountry(country).toUpperCase()} 区找到 App ID ${trimmed}`);
    }

    return { app, candidates: [app], source: 'id' };
  }

  const candidates = await searchApps(trimmed, country, 6);
  if (candidates.length === 0) {
    throw new Error(`没有找到 “${trimmed}” 对应的 iOS App`);
  }

  return { app: candidates[0], candidates, source: 'search' };
}
