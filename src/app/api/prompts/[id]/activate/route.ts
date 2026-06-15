import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { ApiResponse } from '@/types';

const storage = getStorage();

// POST /api/prompts/[id]/activate - 激活指定的 Prompt 模板
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Record<string, never>>>> {
  try {
    const { id } = params;
    const prompts = await storage.getPromptTemplates();
    const targetPrompt = prompts.find(p => p.id === id);
    
    if (!targetPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prompt 模板不存在',
        },
        { status: 404 }
      );
    }

    if (targetPrompt.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: '该 Prompt 模板已经是激活状态',
        },
        { status: 400 }
      );
    }

    // 取消所有模板的激活状态
    const updatedPrompts = prompts.map(prompt => ({
      ...prompt,
      isActive: false,
    }));

    // 激活目标模板
    const activatedPrompt = {
      ...targetPrompt,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };

    // 保存所有更新的模板
    for (const prompt of updatedPrompts) {
      if (prompt.id === id) {
        await storage.savePromptTemplate(activatedPrompt);
      } else {
        await storage.savePromptTemplate(prompt);
      }
    }
    
    console.log(`Activated prompt template: ${activatedPrompt.name} (${id})`);

    return NextResponse.json({
      success: true,
      data: {} as Record<string, never>,
      message: `已激活 Prompt 模板: ${activatedPrompt.name}`,
    });
  } catch (error) {
    console.error('Failed to activate prompt:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '激活 Prompt 模板失败',
      },
      { status: 500 }
    );
  }
}
