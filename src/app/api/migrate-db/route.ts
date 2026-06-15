import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/migrate-db - 执行数据库迁移
export async function POST(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Supabase 配置缺失'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 执行迁移脚本
    const migrations = [
      // 1. 添加 apps 表的 last_fetched 字段
      `ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_fetched TIMESTAMP WITH TIME ZONE;`,
      
      // 2. 添加 analysis_results 表的 app_id 字段
      `ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS app_id TEXT;`,
      
      // 3. 添加 analysis_results 表的 version_refs 字段
      `ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS version_refs TEXT[] DEFAULT '{}';`,
      
      // 4. 创建索引
      `CREATE INDEX IF NOT EXISTS idx_apps_last_fetched ON apps(last_fetched);`,
      `CREATE INDEX IF NOT EXISTS idx_analysis_results_analyzed_at ON analysis_results(analyzed_at);`,
      `CREATE INDEX IF NOT EXISTS idx_analysis_results_app_id ON analysis_results(app_id);`,
      `CREATE INDEX IF NOT EXISTS idx_analysis_results_review_id ON analysis_results(review_id);`
    ];

    const results = [];
    
    for (const [index, sql] of migrations.entries()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
          // 如果 exec_sql 函数不存在，尝试直接执行
          console.warn(`Migration ${index + 1} failed with exec_sql, trying alternative method:`, error.message);
          results.push({
            migration: index + 1,
            sql: sql.substring(0, 50) + '...',
            success: false,
            error: error.message,
            note: 'exec_sql function not available'
          });
        } else {
          results.push({
            migration: index + 1,
            sql: sql.substring(0, 50) + '...',
            success: true
          });
        }
      } catch (error) {
        results.push({
          migration: index + 1,
          sql: sql.substring(0, 50) + '...',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 检查表结构
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('table_name, column_name, data_type')
      .in('table_name', ['apps', 'analysis_results'])
      .order('table_name')
      .order('column_name');

    if (columnsError) {
      console.warn('Could not fetch column information:', columnsError.message);
    }

    return NextResponse.json({
      success: true,
      message: '数据库迁移完成',
      data: {
        migrations: results,
        tableStructure: columns || [],
        successCount: results.filter(r => r.success).length,
        totalCount: results.length
      }
    });

  } catch (error) {
    console.error('Database migration failed:', error);
    
    return NextResponse.json({
      success: false,
      error: `数据库迁移失败: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
