import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { AppStoreLookupResult, normalizeCountry } from '@/lib/appstore/discovery';
import { AppStoreReview } from '@/types';

interface ReviewHistoryFile {
  version: 1;
  app: Pick<AppStoreLookupResult, 'id' | 'name' | 'country' | 'artistName' | 'artworkUrl' | 'trackViewUrl' | 'primaryGenreName'>;
  firstSeenAt: string;
  lastSeenAt: string;
  totalReviews: number;
  reviews: AppStoreReview[];
}

function historyRoot() {
  return process.env.APP_REVIEW_HISTORY_DIR
    || path.join(
      process.env.APP_REVIEW_CACHE_DIR || path.join(process.cwd(), 'src', 'data', 'app-cache'),
      '.review-history'
    );
}

function safeHistoryKey(country: string, appId: string) {
  return `${normalizeCountry(country)}-${appId.replace(/\D/g, '')}`;
}

function historyFilePath(country: string, appId: string) {
  return path.join(historyRoot(), `${safeHistoryKey(country, appId)}.json`);
}

function sortReviewsByDateDesc(reviews: AppStoreReview[]) {
  return [...reviews].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
}

async function readHistory(country: string, appId: string): Promise<ReviewHistoryFile | null> {
  try {
    const content = await fs.readFile(historyFilePath(country, appId), 'utf8');
    return JSON.parse(content) as ReviewHistoryFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function atomicWriteJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, filePath);
}

export async function upsertReviewHistory(app: AppStoreLookupResult, reviews: AppStoreReview[]) {
  if (reviews.length === 0) return;

  const country = normalizeCountry(app.country);
  const existing = await readHistory(country, app.id);
  const byId = new Map<string, AppStoreReview>();

  for (const review of existing?.reviews || []) {
    byId.set(review.id, review);
  }

  for (const review of reviews) {
    byId.set(review.id, {
      ...review,
      appId: review.appId || app.id,
      country: normalizeCountry(review.country || country),
      sourceCountry: review.sourceCountry ? normalizeCountry(review.sourceCountry) : country,
    });
  }

  const now = new Date().toISOString();
  const mergedReviews = sortReviewsByDateDesc(Array.from(byId.values()));
  const history: ReviewHistoryFile = {
    version: 1,
    app: {
      id: app.id,
      name: app.name,
      country,
      artistName: app.artistName,
      artworkUrl: app.artworkUrl,
      trackViewUrl: app.trackViewUrl,
      primaryGenreName: app.primaryGenreName,
    },
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
    totalReviews: mergedReviews.length,
    reviews: mergedReviews,
  };

  await atomicWriteJson(historyFilePath(country, app.id), history);
}
