import { AppStoreReview, FetchConfig } from '@/types';

interface AppStoreEntry {
  id: { label: string };
  updated: { label: string };
  'im:rating': { label: string };
  'im:version': { label: string };
  title: { label: string };
  content: { 
    label: string;
    attributes: { type: string };
  };
  author: {
    name: { label: string };
    uri: { label: string };
  };
  'im:voteCount': { label: string };
  'im:voteSum': { label: string };
  link: {
    attributes: { href: string };
  };
  'im:contentType': {
    attributes: {
      term: string;
      label: string;
    };
  };
}

interface AppStoreResponse {
  feed: {
    entry: AppStoreEntry[];
    link?: Array<{
      attributes: {
        rel: string;
        href: string;
      };
    }>;
  };
}

interface AppStoreWebReview {
  '$kind'?: string;
  id?: string;
  title?: string;
  date?: string;
  contents?: string;
  rating?: number;
  reviewerName?: string;
}

export class AppStoreFetcher {
  private static readonly BASE_URL = 'https://itunes.apple.com';
  private static readonly APP_STORE_WEB_URL = 'https://apps.apple.com';
  private static readonly HTML_FALLBACK_COUNTRIES = [
    'cn',
    'us',
    'hk',
    'tw',
    'sg',
    'jp',
    'gb',
    'ca',
    'au',
    'de',
    'my',
    'th',
    'kr',
    'in',
    'br',
    'ie',
    'it',
    'nl',
    'ch',
  ];
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  /**
   * 抓取指定应用的评论（支持分页和增量更新）
   */
  static async fetchReviews(config: FetchConfig): Promise<AppStoreReview[]> {
    const { appId, country, incremental, lastFetched } = config;
    const maxPages = Math.min(Math.max(config.maxPages ?? 20, 1), 20);
    const maxReviews = Math.min(Math.max(config.maxReviews ?? maxPages * 50, 1), 1000);

    console.log(`Starting to fetch reviews for app ${appId} from ${country}...`);
    console.log(`Incremental: ${incremental}, Last fetched: ${lastFetched}`);

    try {
      const allReviews: AppStoreReview[] = [];
      let page = 1;
      let hasMorePages = true;
      let shouldStop = false;

      while (hasMorePages && !shouldStop) {
        console.log(`Fetching page ${page}...`);

        const pageReviews = await this.fetchPageReviews(appId, country, page);

        if (pageReviews.length === 0) {
          console.log(`No reviews found on page ${page}, stopping`);
          break;
        }

        // 如果是增量抓取，检查是否遇到了已有的评论
        if (incremental && lastFetched) {
          const lastFetchedDate = new Date(lastFetched);
          const newReviews = pageReviews.filter(review => new Date(review.updated) > lastFetchedDate);

          if (newReviews.length < pageReviews.length) {
            // 这一页包含了已有的评论，只取新的部分
            allReviews.push(...newReviews);
            console.log(`Found ${newReviews.length} new reviews on page ${page}, stopping incremental fetch`);
            shouldStop = true;
          } else {
            // 这一页全是新评论
            allReviews.push(...newReviews);
            console.log(`All ${newReviews.length} reviews on page ${page} are new`);
          }
        } else {
          // 非增量抓取，添加所有评论
          allReviews.push(...pageReviews);
          console.log(`Added ${pageReviews.length} reviews from page ${page}`);
        }

        if (allReviews.length >= maxReviews) {
          console.log(`Reached maximum review limit (${maxReviews}), stopping`);
          break;
        }

        if (page >= maxPages) {
          console.log(`Reached maximum page limit (${maxPages}), stopping`);
          break;
        }

        // 检查是否还有更多页面
        hasMorePages = await this.hasMorePages(appId, country, page);
        page++;

        // 添加延迟避免请求过快
        if (hasMorePages && !shouldStop) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`Fetch completed. Total reviews: ${allReviews.length}`);

      if (!incremental && allReviews.length < maxReviews) {
        const htmlReviews = await this.fetchHtmlReviews(appId, country, maxReviews - allReviews.length);
        if (htmlReviews.length > 0) {
          console.log(`Using App Store HTML supplemental reviews. Total supplemental reviews: ${htmlReviews.length}`);
          allReviews.push(...htmlReviews);
        }
      }

      // 去重处理（基于评论ID）
      const uniqueReviews = this.deduplicateReviews(allReviews);
      console.log(`After deduplication: ${uniqueReviews.length} unique reviews`);

      return uniqueReviews.slice(0, maxReviews);
    } catch (error) {
      console.error(`Failed to fetch reviews for app ${appId}:`, error);
      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * 抓取指定页面的评论
   */
  private static async fetchPageReviews(appId: string, country: string, page: number): Promise<AppStoreReview[]> {
    const urls = this.buildReviewUrls(appId, country, page);

    try {
      for (const url of urls) {
        console.log(`Making request to: ${url}`);
        const response = await this.fetchWithRetry(url);
        console.log(`Response received, status: ${response.status}`);

        const data: AppStoreResponse = await response.json();
        console.log(`JSON parsed successfully`);

        if (!data.feed) {
          console.warn(`No feed found in response for app ${appId} page ${page}`);
          continue;
        }

        if (!data.feed.entry) {
          console.warn(`No entries found in feed for app ${appId} page ${page}`);
          continue;
        }

        console.log(`Found ${data.feed.entry.length} entries on page ${page}`);
        const reviews = this.parseReviews(data.feed.entry, appId, country);
        console.log(`Parsed ${reviews.length} reviews from page ${page}`);

        if (reviews.length > 0) {
          return reviews;
        }
      }

      console.warn(`No reviews found in any RSS URL for app ${appId} page ${page}`);
      return [];
    } catch (error) {
      console.error(`Failed to fetch page ${page} for app ${appId}:`, error);
      throw error;
    }
  }

  private static buildReviewUrls(appId: string, country: string, page: number): string[] {
    return [
      `${this.BASE_URL}/${country}/rss/customerreviews/id=${appId}/page=${page}/json`,
      `${this.BASE_URL}/${country}/rss/customerreviews/page=${page}/id=${appId}/sortBy=mostRecent/json`,
      `${this.BASE_URL}/${country}/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`,
    ];
  }

  /**
   * Apple RSS 对部分 App 会按出口 IP/UA 返回空 feed；App Store 页面首屏仍包含评论数据。
   */
  private static async fetchHtmlReviews(appId: string, country: string, maxReviews: number): Promise<AppStoreReview[]> {
    const countries = this.buildHtmlFallbackCountries(country);
    const allReviews: AppStoreReview[] = [];
    const seen = new Set<string>();

    for (const fallbackCountry of countries) {
      const url = `${this.APP_STORE_WEB_URL}/${fallbackCountry}/app/id${appId}`;

      try {
        console.log(`Trying App Store HTML fallback: ${url}`);
        const html = await this.fetchTextWithRetry(url, {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }, 1, 12000);
        const reviews = this.parseHtmlReviews(html, appId, fallbackCountry);
        let added = 0;

        for (const review of reviews) {
          if (seen.has(review.id)) continue;
          seen.add(review.id);
          allReviews.push(review);
          added++;
        }

        console.log(`Parsed ${reviews.length} HTML reviews from ${fallbackCountry}; added ${added}; total ${allReviews.length}`);

        if (allReviews.length >= maxReviews) {
          break;
        }
      } catch (error) {
        console.warn(`App Store HTML fallback failed for app ${appId} in ${fallbackCountry}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 150));
    }

    return allReviews.slice(0, maxReviews);
  }

  private static buildHtmlFallbackCountries(country: string): string[] {
    const normalizedCountry = country.toLowerCase();
    return [
      normalizedCountry,
      ...this.HTML_FALLBACK_COUNTRIES.filter((fallbackCountry) => fallbackCountry !== normalizedCountry),
    ];
  }

  private static parseHtmlReviews(html: string, appId: string, country: string): AppStoreReview[] {
    const match = html.match(/<script type="application\/json" id="serialized-server-data">([\s\S]*?)<\/script>/);
    if (!match?.[1]) return [];

    let payload: unknown;
    try {
      payload = JSON.parse(match[1]);
    } catch (error) {
      console.warn('Failed to parse App Store serialized server data:', error);
      return [];
    }

    const reviews: AppStoreReview[] = [];
    const seen = new Set<string>();
    const stack: unknown[] = [payload];

    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) continue;

      if (Array.isArray(item)) {
        for (const child of item) stack.push(child);
        continue;
      }

      if (typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;

      if (record.$kind === 'Review') {
        const review = this.parseWebReview(record as AppStoreWebReview, appId, country);
        if (review && !seen.has(review.id)) {
          seen.add(review.id);
          reviews.push(review);
        }
      }

      for (const value of Object.values(record)) {
        if (value && (typeof value === 'object')) {
          stack.push(value);
        }
      }
    }

    return reviews;
  }

  private static parseWebReview(review: AppStoreWebReview, appId: string, country: string): AppStoreReview | null {
    if (!review.id || !review.title || !review.contents || !review.rating) return null;

    return {
      id: review.id,
      updated: review.date || new Date().toISOString(),
      rating: String(review.rating),
      version: 'Unknown',
      title: review.title,
      content: review.contents,
      contentType: 'text',
      authorName: review.reviewerName || 'App Store 用户',
      authorUri: '',
      voteCount: '0',
      voteSum: '0',
      link: `${this.APP_STORE_WEB_URL}/${country}/app/id${appId}?see-all=reviews`,
      contentTypeLabel: 'Review',
      appId,
      country,
      source: 'app-store-html',
      sourceCountry: country,
    };
  }

  /**
   * 检查是否还有更多页面
   */
  private static async hasMorePages(appId: string, country: string, currentPage: number): Promise<boolean> {
    try {
      // 尝试获取下一页，如果返回空或错误，说明没有更多页面
      const nextPage = currentPage + 1;
      return (await this.fetchPageReviews(appId, country, nextPage)).length > 0;
    } catch {
      console.log(`No more pages after page ${currentPage}`);
      return false;
    }
  }

  /**
   * 去重评论（基于评论ID）
   */
  private static deduplicateReviews(reviews: AppStoreReview[]): AppStoreReview[] {
    const seen = new Set<string>();
    const uniqueReviews: AppStoreReview[] = [];

    for (const review of reviews) {
      if (!seen.has(review.id)) {
        seen.add(review.id);
        uniqueReviews.push(review);
      }
    }

    return uniqueReviews;
  }

  /**
   * 带重试机制的网络请求
   */
  private static async fetchWithRetry(url: string, retries = this.MAX_RETRIES): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        // 创建一个简单的超时控制器
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AppReviewBot/1.0)',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        console.warn(`Fetch attempt ${i + 1} failed:`, error);
        
        if (i === retries - 1) {
          throw error;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
      }
    }
    
    throw new Error('All fetch attempts failed');
  }

  private static async fetchTextWithRetry(
    url: string,
    headers: HeadersInit,
    retries = this.MAX_RETRIES,
    timeoutMs = 15000
  ): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.text();
      } catch (error) {
        console.warn(`Text fetch attempt ${i + 1} failed:`, error);

        if (i === retries - 1) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
      }
    }

    throw new Error('All text fetch attempts failed');
  }

  /**
   * 解析 AppStore RSS 响应数据
   */
  private static parseReviews(entries: AppStoreEntry[], appId: string, country: string): AppStoreReview[] {
    return entries
      .filter(entry => this.isValidReview(entry))
      .map(entry => this.parseReviewEntry(entry, appId, country))
      .filter(review => review !== null) as AppStoreReview[];
  }

  /**
   * 检查是否为有效的评论条目
   */
  private static isValidReview(entry: AppStoreEntry): boolean {
    // 过滤掉应用元数据，只保留用户评论
    return !!(
      entry.id?.label &&
      entry.updated?.label &&
      entry.title?.label &&
      entry.content?.label &&
      entry.author?.name?.label &&
      entry['im:rating']?.label
    );
  }

  /**
   * 解析单个评论条目
   */
  private static parseReviewEntry(entry: AppStoreEntry, appId: string, country: string): AppStoreReview | null {
    try {
      return {
        id: entry.id.label,
        updated: entry.updated.label,
        rating: entry['im:rating']?.label || '0',
        version: entry['im:version']?.label || 'Unknown',
        title: entry.title.label,
        content: entry.content.label,
        contentType: entry.content.attributes?.type || 'text',
        authorName: entry.author.name.label,
        authorUri: entry.author.uri?.label || '',
        voteCount: entry['im:voteCount']?.label || '0',
        voteSum: entry['im:voteSum']?.label || '0',
        link: entry.link?.attributes?.href || '',
        contentTypeLabel: entry['im:contentType']?.attributes?.label || '',
        appId,
        country,
        source: 'apple-rss',
        sourceCountry: country,
      };
    } catch (error) {
      console.warn('Failed to parse review entry:', error);
      return null;
    }
  }

  /**
   * 批量抓取多个应用的评论
   */
  static async fetchMultipleApps(configs: FetchConfig[]): Promise<AppStoreReview[]> {
    const allReviews: AppStoreReview[] = [];
    
    for (const config of configs) {
      try {
        const reviews = await this.fetchReviews(config);
        allReviews.push(...reviews);
        
        // 添加延迟避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to fetch reviews for app ${config.appId}:`, error);
        // 继续处理其他应用，不中断整个流程
      }
    }
    
    return allReviews;
  }

  /**
   * 验证应用ID和国家代码
   */
  static validateConfig(config: FetchConfig): boolean {
    const { appId, country } = config;
    
    if (!appId || !/^\d+$/.test(appId)) {
      console.error('Invalid app ID:', appId);
      return false;
    }
    
    if (!country || !/^[a-z]{2}$/.test(country)) {
      console.error('Invalid country code:', country);
      return false;
    }
    
    return true;
  }
}
