import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { ApiResponse, PromptTemplate } from '@/types';

const storage = getStorage();

// GET /api/prompts/[id] - 获取指定 Prompt 模板
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<PromptTemplate>>> {
  try {
    const { id } = params;
    const prompts = await storage.getPromptTemplates();
    const prompt = prompts.find(p => p.id === id);
    
    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prompt 模板不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: prompt,
    });
  } catch (error) {
    console.error('Failed to get prompt:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取 Prompt 模板失败',
      },
      { status: 500 }
    );
  }
}

// PUT /api/prompts/[id] - 更新 Prompt 模板
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<PromptTemplate>>> {
  try {
    const { id } = params;
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

    const prompts = await storage.getPromptTemplates();
    const existingPrompt = prompts.find(p => p.id === id);
    
    if (!existingPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prompt 模板不存在',
        },
        { status: 404 }
      );
    }

    const updatedPrompt: PromptTemplate = {
      ...existingPrompt,
      name: body.name.trim(),
      description: body.description?.trim() || '',
      content: body.content.trim(),
      version: body.version?.trim() || existingPrompt.version,
      updatedAt: new Date().toISOString(),
    };

    await storage.savePromptTemplate(updatedPrompt);
    
    console.log(`Updated prompt template: ${updatedPrompt.name} (${updatedPrompt.id})`);

    return NextResponse.json({
      success: true,
      data: updatedPrompt,
      message: 'Prompt 模板更新成功',
    });
  } catch (error) {
    console.error('Failed to update prompt:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '更新 Prompt 模板失败',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/prompts/[id] - 删除 Prompt 模板
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Record<string, never>>>> {
  try {
    const { id } = params;
    const prompts = await storage.getPromptTemplates();
    const prompt = prompts.find(p => p.id === id);
    
    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prompt 模板不存在',
        },
        { status: 404 }
      );
    }

    if (prompt.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: '不能删除当前激活的 Prompt 模板',
        },
        { status: 400 }
      );
    }

    await storage.deletePromptTemplate(id);
    
    console.log(`Deleted prompt template: ${prompt.name} (${id})`);

    return NextResponse.json({
      success: true,
      data: {} as Record<string, never>,
      message: 'Prompt 模板删除成功',
    });
  } catch (error) {
    console.error('Failed to delete prompt:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '删除 Prompt 模板失败',
      },
      { status: 500 }
    );
  }
}
