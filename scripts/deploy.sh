#!/bin/bash

# AppStore 评论分析系统部署脚本

echo "🚀 开始部署 AppStore 评论分析系统..."

# 检查环境变量
if [ -z "$QIAOMU_LLM_API_KEY" ] && [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "❌ 错误: 请设置 QIAOMU_LLM_API_KEY 或 DEEPSEEK_API_KEY 环境变量"
    exit 1
fi

echo "✅ 环境变量检查通过"

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建项目
echo "🔨 构建项目..."
npm run build

# 检查构建结果
if [ $? -eq 0 ]; then
    echo "✅ 构建成功"
else
    echo "❌ 构建失败"
    exit 1
fi

# 运行测试（如果有）
if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
    echo "🧪 运行测试..."
    npm test
fi

echo "🎉 部署准备完成！"
echo ""
echo "📋 部署清单:"
echo "  ✅ 依赖安装完成"
echo "  ✅ 项目构建成功"
echo "  ✅ 环境变量配置正确"
echo ""
echo "🔗 接下来的步骤:"
echo "  1. 将代码推送到 GitHub"
echo "  2. 在 VPS /opt/qiaomu-apps/appreview 中配置 .env.production"
echo "  3. 运行 docker compose up -d --build"
echo "  4. 配置 Nginx、HTTPS 和 appreview.qiaomu.ai"
echo ""
echo "📚 详细说明请查看 README.md"
