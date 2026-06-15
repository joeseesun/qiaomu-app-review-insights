import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const storage = getStorage();
    
    // 检查应用是否存在
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    
    if (!app) {
      return NextResponse.json(
        { success: false, error: '应用不存在' },
        { status: 404 }
      );
    }

    // 直接使用最简单的fetch，添加更多headers
    const url = `https://itunes.apple.com/${app.country}/rss/customerreviews/id=${id}/json`;

    console.log('Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      // 不设置超时，让Vercel处理
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('JSON parsed successfully');
    
    if (!data.feed || !data.feed.entry) {
      return NextResponse.json({
        success: true,
        data: {
          reviewCount: 0,
          message: '没有找到评论数据'
        }
      });
    }
    
    // 简单解析评论
    const reviews = data.feed.entry.map((entry: any) => ({
      id: entry.id?.label || '',
      appId: id,
      title: entry.title?.label || '',
      content: entry.content?.label || '',
      rating: parseInt(entry['im:rating']?.label || '0'),
      author: entry.author?.name?.label || '',
      version: entry['im:version']?.label || '',
      updated: entry.updated?.label || new Date().toISOString(),
    }));
    
    console.log(`Parsed ${reviews.length} reviews`);
    
    // 保存到存储
    if (reviews.length > 0) {
      await storage.saveReviews(reviews);
      console.log('Reviews saved to storage');
    }
    
    return NextResponse.json({
      success: true,
      data: {
        reviewCount: reviews.length,
        message: `成功抓取 ${reviews.length} 条评论`
      }
    });
    
  } catch (error) {
    console.error('Simple fetch error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
