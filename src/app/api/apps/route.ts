import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { App, ApiResponse } from '@/types';

const storage = getStorage();

// GET /api/apps - 获取所有应用
export async function GET(): Promise<NextResponse<ApiResponse<{ apps: App[] }>>> {
  try {
    const apps = await storage.getApps();
    
    return NextResponse.json({
      success: true,
      data: { apps },
    });
  } catch (error) {
    console.error('Failed to get apps:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取应用列表失败',
      },
      { status: 500 }
    );
  }
}

// POST /api/apps - 添加新应用
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<App>>> {
  try {
    const body = await request.json();
    const { id, name, country } = body;

    // 验证输入
    if (!id || !name || !country) {
      return NextResponse.json(
        {
          success: false,
          error: '应用ID、名称和国家代码都是必需的',
        },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: '应用ID必须是数字',
        },
        { status: 400 }
      );
    }

    if (!/^[a-z]{2}$/.test(country)) {
      return NextResponse.json(
        {
          success: false,
          error: '国家代码必须是两位小写字母',
        },
        { status: 400 }
      );
    }

    // 检查是否已存在（仅在添加新应用时检查）
    const existingApps = await storage.getApps();
    const duplicate = existingApps.find(app => app.id === id);

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `应用 "${duplicate.name}" (ID: ${duplicate.id}) 已存在，请使用编辑功能修改现有应用`,
        },
        { status: 409 }
      );
    }

    // 创建新应用
    const newApp: App = {
      id: id.trim(),
      name: name.trim(),
      country: country.toLowerCase().trim(),
    };

    const updatedApps = [...existingApps, newApp];
    await storage.saveApps(updatedApps);

    return NextResponse.json({
      success: true,
      data: newApp,
      message: '应用添加成功',
    });
  } catch (error) {
    console.error('Failed to create app:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '添加应用失败',
      },
      { status: 500 }
    );
  }
}
