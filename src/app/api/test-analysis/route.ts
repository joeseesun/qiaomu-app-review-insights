import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { KimiClient } from '@/lib/analysis/kimi-client';

// GET /api/test-analysis - 测试分析功能
export async function GET(): Promise<NextResponse> {
  try {
    const storage = getStorage();
    
    // 1. 测试 API Key 配置
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey || apiKey === 'your_moonshot_api_key_here') {
      return NextResponse.json({
        success: false,
        error: 'API Key 未正确配置',
        step: 'API Key 检查'
      });
    }

    // 2. 测试 Prompt Templates 获取
    let promptTemplates;
    try {
      promptTemplates = await storage.getPromptTemplates();
      if (!promptTemplates || promptTemplates.length === 0) {
        return NextResponse.json({
          success: false,
          error: '没有找到 Prompt Templates',
          step: 'Prompt Templates 检查'
        });
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `获取 Prompt Templates 失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        step: 'Prompt Templates 检查'
      });
    }

    const defaultTemplate = promptTemplates.find(t => t.id === 'default');
    if (!defaultTemplate) {
      return NextResponse.json({
        success: false,
        error: '没有找到默认 Prompt Template',
        step: '默认模板检查',
        availableTemplates: promptTemplates.map(t => ({ id: t.id, name: t.name }))
      });
    }

    // 3. 检查模板字段
    if (!defaultTemplate.content && !defaultTemplate.systemPrompt && !defaultTemplate.userPromptTemplate) {
      return NextResponse.json({
        success: false,
        error: 'Prompt Template 内容为空',
        step: '模板内容检查',
        template: {
          id: defaultTemplate.id,
          content: defaultTemplate.content,
          systemPrompt: defaultTemplate.systemPrompt,
          userPromptTemplate: defaultTemplate.userPromptTemplate
        }
      });
    }

    // 4. 测试 Kimi Client 初始化
    let kimiClient;
    try {
      kimiClient = new KimiClient();
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `Kimi Client 初始化失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        step: 'Kimi Client 初始化'
      });
    }

    // 5. 测试模拟分析请求
    const testRequest = {
      title: '测试评论',
      content: '这是一个测试评论内容',
      rating: '5',
      version: '1.0.0',
      authorName: '测试用户',
      updated: '2025-01-17'
    };

    try {
      // 测试 formatPrompt 方法
      const promptContent = defaultTemplate.content || 
        `${defaultTemplate.systemPrompt || ''}\n\n${defaultTemplate.userPromptTemplate || ''}`;
      
      // 模拟 formatPrompt 逻辑
      const formattedPrompt = promptContent
        .replace('{title}', testRequest.title || '')
        .replace('{content}', testRequest.content || '')
        .replace('{rating}', testRequest.rating || '')
        .replace('{version}', testRequest.version || '')
        .replace('{authorName}', testRequest.authorName || '')
        .replace('{updated}', testRequest.updated || '');

      return NextResponse.json({
        success: true,
        message: '分析功能测试通过',
        data: {
          apiKeyConfigured: true,
          promptTemplatesCount: promptTemplates.length,
          defaultTemplate: {
            id: defaultTemplate.id,
            name: defaultTemplate.name,
            hasContent: !!defaultTemplate.content,
            hasSystemPrompt: !!defaultTemplate.systemPrompt,
            hasUserPromptTemplate: !!defaultTemplate.userPromptTemplate
          },
          kimiClientInitialized: true,
          testRequest,
          formattedPromptLength: formattedPrompt.length,
          formattedPromptPreview: formattedPrompt.substring(0, 200) + '...'
        }
      });

    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `格式化 Prompt 失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        step: 'Prompt 格式化测试',
        stack: error instanceof Error ? error.stack : undefined
      });
    }

  } catch (error) {
    console.error('Test analysis failed:', error);
    
    return NextResponse.json({
      success: false,
      error: `测试失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      step: '总体测试',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
