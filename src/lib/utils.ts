import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '无效日期';
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return '刚刚';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}小时前`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays}天前`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}个月前`;
    }

    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears}年前`;
  } catch {
    return '未知时间';
  }
}

export function getRatingStars(rating: string | number): string {
  const num = typeof rating === 'string' ? parseInt(rating) : rating;
  const stars = '★'.repeat(Math.max(0, Math.min(5, num)));
  const emptyStars = '☆'.repeat(5 - stars.length);
  return stars + emptyStars;
}

export function getSentimentColor(sentiment: 'positive' | 'negative' | 'neutral'): string {
  switch (sentiment) {
    case 'positive':
      return 'text-green-600 bg-green-50';
    case 'negative':
      return 'text-red-600 bg-red-50';
    case 'neutral':
      return 'text-gray-600 bg-gray-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getSentimentLabel(sentiment: 'positive' | 'negative' | 'neutral'): string {
  switch (sentiment) {
    case 'positive':
      return '正面';
    case 'negative':
      return '负面';
    case 'neutral':
      return '中性';
    default:
      return '未知';
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

export function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    'us': '🇺🇸',
    'cn': '🇨🇳',
    'jp': '🇯🇵',
    'kr': '🇰🇷',
    'gb': '🇬🇧',
    'de': '🇩🇪',
    'fr': '🇫🇷',
    'it': '🇮🇹',
    'es': '🇪🇸',
    'br': '🇧🇷',
    'in': '🇮🇳',
    'au': '🇦🇺',
    'ca': '🇨🇦',
  };
  return flags[countryCode.toLowerCase()] || '🌍';
}

export function getCountryName(countryCode: string): string {
  const countries: Record<string, string> = {
    'us': '美国',
    'cn': '中国',
    'jp': '日本',
    'kr': '韩国',
    'gb': '英国',
    'de': '德国',
    'fr': '法国',
    'it': '意大利',
    'es': '西班牙',
    'br': '巴西',
    'in': '印度',
    'au': '澳大利亚',
    'ca': '加拿大',
  };
  return countries[countryCode.toLowerCase()] || countryCode.toUpperCase();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

export function downloadFile(content: string, filename: string, contentType = 'text/plain'): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
