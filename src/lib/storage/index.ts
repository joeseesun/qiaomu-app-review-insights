import { DataStorage } from '@/types';
import { LocalStorage } from './local';
import { VercelKVStorage } from './vercel-kv';
import { SupabaseStorage } from './supabase';

// 存储工厂函数
export function createStorage(): DataStorage {
  const storageType = (process.env.STORAGE_TYPE || 'local').trim();
  // Help diagnose "data disappeared" issues caused by backend switching
  // This logs once per process which storage backend is selected.
  // No secrets are logged.
  console.info(`[storage] Initializing storage backend: ${storageType}`);

  switch (storageType) {
    case 'vercel-kv':
      try {
        return new VercelKVStorage();
      } catch (error) {
        console.warn('Failed to initialize Vercel KV, falling back to local storage:', error);
        return new LocalStorage();
      }
    
    case 'supabase':
      try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          console.warn('[storage] Supabase selected but env is missing, falling back to local storage');
          return new LocalStorage();
        }
        return new SupabaseStorage();
      } catch (error) {
        console.warn('Failed to initialize Supabase, falling back to local storage:', error);
        return new LocalStorage();
      }
    
    case 'local':
    default:
      return new LocalStorage();
  }
}

// 单例存储实例
let storageInstance: DataStorage | null = null;

export function getStorage(): DataStorage {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

// 重置存储实例（主要用于测试）
export function resetStorage(): void {
  storageInstance = null;
}

// 导出存储类型
export { LocalStorage, VercelKVStorage, SupabaseStorage };
export type { DataStorage };
