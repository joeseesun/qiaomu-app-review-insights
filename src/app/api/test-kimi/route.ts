import { NextRequest, NextResponse } from 'next/server';

// GET /api/test-kimi - 测试 Moonshot API 配置
export async function GET(): Promise<NextResponse> {
  try {
    const apiKey = process.env.MOONSHOT_API_KEY;
    const baseURL = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'MOONSHOT_API_KEY 环境变量未配置',
        message: '请在 .env.local 文件中配置正确的 Moonshot API Key',
        instructions: [
          '1. 访问 https://platform.moonshot.cn/',
          '2. 注册/登录账户',
          '3. 在控制台中创建 API Key',
          '4. 将 API Key 添加到 .env.local 文件中的 MOONSHOT_API_KEY 变量'
        ]
      }, { status: 400 });
    }

    if (apiKey === 'your_moonshot_api_key_here') {
      return NextResponse.json({
        success: false,
        error: 'API Key 仍为占位符',
        message: '请将 .env.local 中的 MOONSHOT_API_KEY 替换为真实的 API Key',
        currentValue: apiKey
      }, { status: 400 });
    }

    // 测试 API 连接
    const response = await fetch(`${baseURL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: 'API Key 验证失败',
        message: 'Moonshot API 返回错误',
        details: {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        }
      }, { status: 400 });
    }

    const models = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Moonshot API 配置正确！',
      data: {
        apiKeyConfigured: true,
        baseURL,
        availableModels: models.data?.length || 0,
        testTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to test Kimi API:', error);
    
    return NextResponse.json({
      success: false,
      error: 'API 测试失败',
      message: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
