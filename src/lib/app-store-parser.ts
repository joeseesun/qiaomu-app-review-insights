/**
 * App Store URL 解析工具
 */

export interface ParsedAppInfo {
  id: string;
  name: string;
  country: string;
}

/**
 * 从 App Store URL 解析应用信息
 * 支持的 URL 格式：
 * - https://apps.apple.com/cn/app/红果短剧-海量热门短剧随心看/id6451407032
 * - https://apps.apple.com/us/app/chatgpt/id6448311069
 * - https://itunes.apple.com/cn/app/id6451407032
 */
export function parseAppStoreUrl(url: string): ParsedAppInfo | null {
  try {
    const urlObj = new URL(url);
    
    // 检查是否是 App Store URL
    if (!urlObj.hostname.includes('apple.com')) {
      return null;
    }

    // 提取应用 ID
    const idMatch = url.match(/id(\d+)/);
    if (!idMatch) {
      return null;
    }
    const appId = idMatch[1];

    // 提取国家代码
    let country = 'us'; // 默认美国
    const pathParts = urlObj.pathname.split('/');
    
    // 查找国家代码 (通常在第一个路径段)
    if (pathParts.length > 1 && pathParts[1].length === 2) {
      country = pathParts[1].toLowerCase();
    }

    // 提取应用名称
    let appName = '';
    
    // 从 URL 路径中提取应用名称
    const appNameMatch = urlObj.pathname.match(/\/app\/([^\/]+)\/id\d+/);
    if (appNameMatch) {
      // URL 解码并清理应用名称
      appName = decodeURIComponent(appNameMatch[1])
        .replace(/-/g, ' ')
        .replace(/\+/g, ' ')
        .trim();
      
      // 如果名称包含中文编码，尝试进一步解码
      try {
        appName = decodeURIComponent(appName);
      } catch (e) {
        // 解码失败，使用原始名称
      }
      
      // 首字母大写
      appName = appName.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    // 如果没有从 URL 提取到名称，使用默认名称
    if (!appName) {
      appName = `应用 ${appId}`;
    }

    return {
      id: appId,
      name: appName,
      country: country,
    };
  } catch {
    return null;
  }
}

/**
 * 验证应用 ID 格式
 */
export function validateAppId(id: string): boolean {
  return /^\d+$/.test(id.trim());
}

/**
 * 验证 App Store URL 格式
 */
export function validateAppStoreUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('apple.com') && /id\d+/.test(url);
  } catch {
    return false;
  }
}

/**
 * 国家代码映射
 */
export const COUNTRY_MAPPING: Record<string, string> = {
  'us': '美国',
  'cn': '中国',
  'jp': '日本',
  'kr': '韩国',
  'gb': '英国',
  'uk': '英国',
  'de': '德国',
  'fr': '法国',
  'it': '意大利',
  'es': '西班牙',
  'br': '巴西',
  'in': '印度',
  'au': '澳大利亚',
  'ca': '加拿大',
  'mx': '墨西哥',
  'ru': '俄罗斯',
  'nl': '荷兰',
  'se': '瑞典',
  'no': '挪威',
  'dk': '丹麦',
  'fi': '芬兰',
  'pl': '波兰',
  'tr': '土耳其',
  'th': '泰国',
  'sg': '新加坡',
  'my': '马来西亚',
  'id': '印度尼西亚',
  'ph': '菲律宾',
  'vn': '越南',
  'tw': '台湾',
  'hk': '香港',
  'mo': '澳门',
};

/**
 * 获取国家名称
 */
export function getCountryName(countryCode: string): string {
  return COUNTRY_MAPPING[countryCode.toLowerCase()] || countryCode.toUpperCase();
}

/**
 * 示例 URL 列表
 */
export const EXAMPLE_URLS = [
  'https://apps.apple.com/cn/app/红果短剧-海量热门短剧随心看/id6451407032',
  'https://apps.apple.com/us/app/chatgpt/id6448311069',
  'https://apps.apple.com/us/app/gemini-ai-assistant-by-google/id6477489729',
  'https://apps.apple.com/cn/app/豆包-ai聊天助手/id6459478672',
  'https://apps.apple.com/us/app/deepseek/id6737597349',
];
