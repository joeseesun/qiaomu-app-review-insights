import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { ApiResponse, PromptTemplate } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const storage = getStorage();

// GET /api/prompts - 获取所有 Prompt 模板
export async function GET(): Promise<NextResponse<ApiResponse<{ prompts: PromptTemplate[] }>>> {
  try {
    const prompts = await storage.getPromptTemplates();
    
    return NextResponse.json({
      success: true,
      data: { prompts },
    });
  } catch (error) {
    console.error('Failed to get prompts:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取 Prompt 模板失败',
      },
      { status: 500 }
    );
  }
}

// POST /api/prompts - 创建新的 Prompt 模板
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<PromptTemplate>>> {
  try {
    const body = await request.json();
    
    // 验证必需字段
    if (!body.name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: '模板名称不能为空',
        },
        { status: 400 }
      );
    }
    
    if (!body.content?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prompt 内容不能为空',
        },
        { status: 400 }
      );
    }

    const newPrompt: PromptTemplate = {
      id: uuidv4(),
      name: body.name.trim(),
      description: body.description?.trim() || '',
      content: body.content.trim(),
      version: body.version?.trim() || '1.0.0',
      isActive: false, // 新创建的模板默认不激活
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.savePromptTemplate(newPrompt);
    
    console.log(`Created new prompt template: ${newPrompt.name} (${newPrompt.id})`);

    return NextResponse.json({
      success: true,
      data: newPrompt,
      message: 'Prompt 模板创建成功',
    });
  } catch (error) {
    console.error('Failed to create prompt:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '创建 Prompt 模板失败',
      },
      { status: 500 }
    );
  }
}
