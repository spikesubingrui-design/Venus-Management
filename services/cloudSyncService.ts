/**
 * 云端数据同步服务
 * 将本地数据同步到 Supabase 云端
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { STORAGE_KEYS, getData, saveData } from './storageService';

// 表名映射：localStorage key -> Supabase table
const TABLE_MAPPING: Record<string, string> = {
  [STORAGE_KEYS.STUDENTS]: 'students',
  [STORAGE_KEYS.STAFF]: 'staff',
  [STORAGE_KEYS.HEALTH_RECORDS]: 'health_records',
  [STORAGE_KEYS.ATTENDANCE_RECORDS]: 'attendance_records',
  [STORAGE_KEYS.MEAL_PLANS]: 'meal_plans',
  [STORAGE_KEYS.ANNOUNCEMENTS]: 'announcements',
  [STORAGE_KEYS.OPERATION_LOGS]: 'operation_logs',
  [STORAGE_KEYS.VISITORS]: 'visitors',
  [STORAGE_KEYS.DISINFECTION]: 'disinfection_records',
  [STORAGE_KEYS.DOCUMENTS]: 'documents',
};

// 字段映射：将 camelCase 转换为 snake_case
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// 字段映射：将 snake_case 转换为 camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

/**
 * 同步状态
 */
export interface SyncStatus {
  lastSyncTime: string | null;
  pendingChanges: number;
  isOnline: boolean;
  isSyncing: boolean;
}

// 同步状态存储
let syncStatus: SyncStatus = {
  lastSyncTime: localStorage.getItem('kt_last_sync_time'),
  pendingChanges: 0,
  isOnline: navigator.onLine,
  isSyncing: false,
};

// 监听网络状态
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncStatus.isOnline = true;
    // 网络恢复时自动同步
    autoSync();
  });
  window.addEventListener('offline', () => {
    syncStatus.isOnline = false;
  });
}

/**
 * 获取同步状态
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * 上传单条数据到云端
 */
export async function uploadToCloud<T extends { id: string }>(
  storageKey: string,
  data: T
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: '云端服务未配置' };
  }

  const tableName = TABLE_MAPPING[storageKey];
  if (!tableName) {
    return { success: false, error: '未知的数据类型' };
  }

  try {
    const cloudData = toSnakeCase(data);
    
    const { error } = await supabase
      .from(tableName)
      .upsert(cloudData, { onConflict: 'id' });

    if (error) {
      console.error(`上传到 ${tableName} 失败:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('上传失败:', err);
    return { success: false, error: err.message || '上传失败' };
  }
}

/**
 * 从云端下载数据
 */
export async function downloadFromCloud<T>(
  storageKey: string,
  filters?: Record<string, any>
): Promise<{ success: boolean; data?: T[]; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: '云端服务未配置' };
  }

  const tableName = TABLE_MAPPING[storageKey];
  if (!tableName) {
    return { success: false, error: '未知的数据类型' };
  }

  try {
    let query = supabase.from(tableName).select('*');

    // 应用过滤条件
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        query = query.eq(snakeKey, value);
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`从 ${tableName} 下载失败:`, error);
      return { success: false, error: error.message };
    }

    const localData = toCamelCase(data || []);
    return { success: true, data: localData };
  } catch (err: any) {
    console.error('下载失败:', err);
    return { success: false, error: err.message || '下载失败' };
  }
}

/**
 * 同步单个存储键的数据
 */
export async function syncStorageKey(
  storageKey: string,
  direction: 'upload' | 'download' | 'both' = 'both'
): Promise<{ success: boolean; uploaded?: number; downloaded?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: '云端服务未配置' };
  }

  const tableName = TABLE_MAPPING[storageKey];
  if (!tableName) {
    return { success: false, error: '不支持同步此类型的数据' };
  }

  try {
    let uploaded = 0;
    let downloaded = 0;

    // 上传本地数据
    if (direction === 'upload' || direction === 'both') {
      const localData = getData<any>(storageKey);
      
      for (const item of localData) {
        const result = await uploadToCloud(storageKey, item);
        if (result.success) uploaded++;
      }
    }

    // 下载云端数据
    if (direction === 'download' || direction === 'both') {
      const result = await downloadFromCloud<any>(storageKey);
      if (result.success && result.data) {
        // 合并数据（云端优先）
        const localData = getData<any>(storageKey);
        const mergedData = mergeData(localData, result.data);
        saveData(storageKey, mergedData);
        downloaded = result.data.length;
      }
    }

    return { success: true, uploaded, downloaded };
  } catch (err: any) {
    return { success: false, error: err.message || '同步失败' };
  }
}

/**
 * 合并本地和云端数据
 * 策略：以更新时间较新的为准
 */
function mergeData<T extends { id: string; updatedAt?: string }>(
  local: T[],
  cloud: T[]
): T[] {
  const merged = new Map<string, T>();

  // 先添加本地数据
  local.forEach(item => merged.set(item.id, item));

  // 用云端数据覆盖（如果更新时间更新或本地不存在）
  cloud.forEach(cloudItem => {
    const localItem = merged.get(cloudItem.id);
    if (!localItem) {
      merged.set(cloudItem.id, cloudItem);
    } else {
      const localTime = new Date(localItem.updatedAt || 0).getTime();
      const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
      if (cloudTime >= localTime) {
        merged.set(cloudItem.id, cloudItem);
      }
    }
  });

  return Array.from(merged.values());
}

/**
 * 全量同步所有数据
 */
export async function syncAllData(
  direction: 'upload' | 'download' | 'both' = 'both',
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{
  success: boolean;
  results: Record<string, { uploaded?: number; downloaded?: number; error?: string }>;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, results: {} };
  }

  syncStatus.isSyncing = true;
  const results: Record<string, any> = {};
  const keys = Object.keys(TABLE_MAPPING);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    onProgress?.(i + 1, keys.length, key);

    const result = await syncStorageKey(key, direction);
    results[key] = result;

    // 添加小延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  syncStatus.isSyncing = false;
  syncStatus.lastSyncTime = new Date().toISOString();
  localStorage.setItem('kt_last_sync_time', syncStatus.lastSyncTime);

  const allSuccess = Object.values(results).every(r => r.success);
  return { success: allSuccess, results };
}

/**
 * 自动同步（用于网络恢复时）
 */
async function autoSync(): Promise<void> {
  if (!isSupabaseConfigured || syncStatus.isSyncing) return;

  console.log('[CloudSync] 开始自动同步...');
  const result = await syncAllData('both');
  console.log('[CloudSync] 自动同步完成:', result);
}

/**
 * 实时订阅数据变更（可选功能）
 */
export function subscribeToChanges(
  storageKey: string,
  callback: (payload: any) => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const tableName = TABLE_MAPPING[storageKey];
  if (!tableName) {
    return () => {};
  }

  const subscription = supabase
    .channel(`${tableName}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        const localPayload = toCamelCase(payload.new || payload.old);
        callback(localPayload);
      }
    )
    .subscribe();

  // 返回取消订阅函数
  return () => {
    subscription.unsubscribe();
  };
}

/**
 * 检查云端服务是否可用
 */
export async function checkCloudHealth(): Promise<{
  isHealthy: boolean;
  latency?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured) {
    return { isHealthy: false, error: '云端服务未配置' };
  }

  const startTime = Date.now();

  try {
    const { error } = await supabase.from('campuses').select('count').limit(1);

    if (error) {
      return { isHealthy: false, error: error.message };
    }

    const latency = Date.now() - startTime;
    return { isHealthy: true, latency };
  } catch (err: any) {
    return { isHealthy: false, error: err.message || '连接失败' };
  }
}

/**
 * 导出用于外部使用
 */
export { isSupabaseConfigured };




