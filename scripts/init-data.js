#!/usr/bin/env node

/**
 * 初始化默认应用数据脚本
 */

const fs = require('fs');
const path = require('path');

// 默认应用数据
const defaultApps = [
  { id: '6448311069', name: 'ChatGPT', country: 'us' },
  { id: '6477489729', name: 'Gemini', country: 'us' },
  { id: '6459478672', name: '豆包', country: 'cn' },
  { id: '6737597349', name: 'Deepseek', country: 'us' },
  { id: '6474233312', name: 'Kimi', country: 'cn' },
  { id: '6466733523', name: '通义', country: 'cn' },
  { id: '6446882473', name: '文小言', country: 'cn' },
  { id: '6480446430', name: '元宝', country: 'cn' },
  { id: '6503676563', name: '即梦', country: 'cn' },
];

// 数据目录
const dataDir = path.join(__dirname, '../src/data');
const appsFile = path.join(dataDir, 'apps.json');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ 创建数据目录:', dataDir);
}

// 检查应用数据文件是否存在
if (fs.existsSync(appsFile)) {
  const existingApps = JSON.parse(fs.readFileSync(appsFile, 'utf8'));
  if (existingApps.length > 0) {
    console.log('ℹ️  应用数据已存在，跳过初始化');
    console.log(`📊 当前应用数量: ${existingApps.length}`);
    process.exit(0);
  }
}

// 写入默认应用数据
fs.writeFileSync(appsFile, JSON.stringify(defaultApps, null, 2));
console.log('✅ 初始化默认应用数据完成');
console.log(`📊 添加了 ${defaultApps.length} 个应用:`);

defaultApps.forEach(app => {
  console.log(`  - ${app.name} (${app.id}) [${app.country.toUpperCase()}]`);
});

console.log('\n🎉 数据初始化完成！');
console.log('💡 您现在可以启动开发服务器并开始使用系统了。');
