import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug-db - 调试数据库数据
export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Supabase 配置缺失'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 检查各表的数据量
    const [appsResult, reviewsResult, analysisResult] = await Promise.all([
      supabase.from('apps').select('id, name, country', { count: 'exact' }),
      supabase.from('reviews').select('id, app_id', { count: 'exact' }),
      supabase.from('analysis_results').select('id, app_id', { count: 'exact' })
    ]);

    // 检查 ChatGPT 的具体数据
    const chatgptReviews = await supabase
      .from('reviews')
      .select('id, title, content, rating, version, author, app_id, created_at')
      .eq('app_id', '6448311069')
      .limit(5);

    // 检查表结构
    const tableStructure = await supabase
      .from('information_schema.columns')
      .select('table_name, column_name, data_type')
      .in('table_name', ['apps', 'reviews', 'analysis_results'])
      .order('table_name')
      .order('ordinal_position');

    return NextResponse.json({
      success: true,
      data: {
        counts: {
          apps: {
            count: appsResult.count,
            error: appsResult.error?.message,
            sample: appsResult.data?.slice(0, 3)
          },
          reviews: {
            count: reviewsResult.count,
            error: reviewsResult.error?.message,
            sample: reviewsResult.data?.slice(0, 3)
          },
          analysisResults: {
            count: analysisResult.count,
            error: analysisResult.error?.message,
            sample: analysisResult.data?.slice(0, 3)
          }
        },
        chatgptReviews: {
          count: chatgptReviews.data?.length || 0,
          error: chatgptReviews.error?.message,
          sample: chatgptReviews.data?.slice(0, 2)
        },
        tableStructure: {
          data: tableStructure.data,
          error: tableStructure.error?.message
        }
      }
    });

  } catch (error) {
    console.error('Database debug failed:', error);
    
    return NextResponse.json({
      success: false,
      error: `调试失败: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
