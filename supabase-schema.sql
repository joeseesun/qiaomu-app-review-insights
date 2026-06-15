-- AppStore评论分析系统 - Supabase数据库表结构

-- 1. 应用表
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  last_fetched TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 评论表
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  rating INTEGER,
  author TEXT,
  version TEXT,
  updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 分析结果表
CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  sentiment TEXT,
  issues TEXT[], -- 存储问题数组
  suggestions TEXT[], -- 存储建议数组
  version_refs TEXT[] DEFAULT '{}', -- 版本相关信息
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 提示模板表
CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_reviews_app_id ON reviews(app_id);
CREATE INDEX IF NOT EXISTS idx_reviews_updated ON reviews(updated DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_review_id ON analysis_results(review_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_analyzed_at ON analysis_results(analyzed_at DESC);

-- 5. 评论翻译表（存储双语对照的中文翻译）
CREATE TABLE IF NOT EXISTS review_translations (
  review_id TEXT PRIMARY KEY REFERENCES reviews(id) ON DELETE CASCADE,
  title_zh TEXT,
  content_zh TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_translations_updated ON review_translations(updated_at DESC);

-- 6. AI 聚合洞察缓存表（可选）
CREATE TABLE IF NOT EXISTS ai_insights (
  app_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'themes_positive', 'themes_negative', 'trends'
  payload JSONB NOT NULL,
  coverage INTEGER,
  model TEXT,
  source TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY(app_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_generated ON ai_insights(generated_at DESC);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为apps表添加更新时间触发器
DROP TRIGGER IF EXISTS update_apps_updated_at ON apps;
CREATE TRIGGER update_apps_updated_at
    BEFORE UPDATE ON apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为prompt_templates表添加更新时间触发器
DROP TRIGGER IF EXISTS update_prompt_templates_updated_at ON prompt_templates;
CREATE TRIGGER update_prompt_templates_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入默认提示模板
INSERT INTO prompt_templates (id, name, description, system_prompt, user_prompt_template, version, is_active)
VALUES (
  'default',
  '默认分析模板',
  '通用的应用评论分析模板',
  '你是一个专业的应用评论分析师。请分析用户评论，提取关键信息。',
  '请分析以下应用评论：

标题：{title}
内容：{content}
评分：{rating}星
版本：{version}

请提供：
1. 情感分析（positive/negative/neutral）
2. 发现的问题列表
3. 改进建议列表',
  '1.0.0',
  true
) ON CONFLICT (id) DO NOTHING;
