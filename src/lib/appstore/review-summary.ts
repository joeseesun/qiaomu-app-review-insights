import { AppStoreReview } from '@/types';

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  versionDistribution: Array<{ version: string; count: number; averageRating: number }>;
  latestReviewDate?: string;
  oldestReviewDate?: string;
  negativeShare: number;
  positiveShare: number;
}

export function summarizeReviews(reviews: AppStoreReview[]): ReviewStats {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: {},
      versionDistribution: [],
      negativeShare: 0,
      positiveShare: 0,
    };
  }

  const ratingDistribution: Record<string, number> = {};
  const versionBuckets = new Map<string, { count: number; ratingSum: number }>();
  let ratingSum = 0;
  let negativeCount = 0;
  let positiveCount = 0;

  for (const review of reviews) {
    const rating = Number.parseInt(review.rating, 10) || 0;
    ratingSum += rating;
    ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;

    if (rating <= 2) negativeCount += 1;
    if (rating >= 4) positiveCount += 1;

    const version = review.version || 'Unknown';
    const bucket = versionBuckets.get(version) || { count: 0, ratingSum: 0 };
    bucket.count += 1;
    bucket.ratingSum += rating;
    versionBuckets.set(version, bucket);
  }

  const sortedByDate = [...reviews].sort(
    (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
  );

  const versionDistribution = Array.from(versionBuckets.entries())
    .map(([version, bucket]) => ({
      version,
      count: bucket.count,
      averageRating: bucket.count ? Number((bucket.ratingSum / bucket.count).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalReviews: reviews.length,
    averageRating: Number((ratingSum / reviews.length).toFixed(2)),
    ratingDistribution,
    versionDistribution,
    latestReviewDate: sortedByDate[0]?.updated,
    oldestReviewDate: sortedByDate[sortedByDate.length - 1]?.updated,
    negativeShare: Number((negativeCount / reviews.length).toFixed(3)),
    positiveShare: Number((positiveCount / reviews.length).toFixed(3)),
  };
}

export function sortReviewsForAnalysis(reviews: AppStoreReview[]): AppStoreReview[] {
  return [...reviews].sort((a, b) => {
    const ratingA = Number.parseInt(a.rating, 10) || 0;
    const ratingB = Number.parseInt(b.rating, 10) || 0;
    const dateA = new Date(a.updated).getTime();
    const dateB = new Date(b.updated).getTime();

    if (ratingA <= 2 && ratingB > 2) return -1;
    if (ratingB <= 2 && ratingA > 2) return 1;
    return dateB - dateA;
  });
}
