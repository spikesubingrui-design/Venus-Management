/**
 * 统一数据服务
 * 自动同步本地存储与 Supabase 云端
 * 所有数据操作都通过此服务，确保数据一致性
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

// 存储键定义
export const STORAGE_KEYS = {
  STUDENTS: 'kt_students',
  TEACHERS: 'kt_teachers',
  AUTHORIZED_PHONES: 'kt_authorized_phones',
  ALL_USERS: 'kt_all_users',
  PAYMENTS: 'kt_payments',
  KITCHEN_HISTORY: 'kt_kitchen_history_v2',
  FEE_STANDARDS: 'kt_finance_fee_standards',
  REFUND_RECORDS: 'kt_refund_records',
};

// 表映射
const TABLE_MAP: Record<string, string> = {
  [STORAGE_KEYS.STUDENTS]: 'students',
  [STORAGE_KEYS.TEACHERS]: 'staff',
  [STORAGE_KEYS.AUTHORIZED_PHONES]: 'authorized_phones',
  [STORAGE_KEYS.ALL_USERS]: 'users',
  [STORAGE_KEYS.PAYMENTS]: 'fee_payments',
  [STORAGE_KEYS.KITCHEN_HISTORY]: 'meal_plans',
};

// camelCase 转 snake_case
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// snake_case 转 camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// 同步状态
let lastSyncTime: string | null = localStorage.getItem('kt_last_sync_time');
let isSyncing = false;

/**
 * 获取同步状态
 */
export function getSyncStatus() {
  return {
    lastSyncTime,
    isSyncing,
    isCloudConfigured: isSupabaseConfigured
  };
}

/**
 * 从云端加载数据（优先）+ 本地缓存
 */
export async function loadData<T>(storageKey: string, options?: {
  campus?: string;
  forceCloud?: boolean;
}): Promise<T[]> {
  const tableName = TABLE_MAP[storageKey];
  
  // 如果云端已配置且需要从云端加载
  if (isSupabaseConfigured && tableName) {
    try {
      let query = supabase.from(tableName).select('*');
      
      if (options?.campus) {
        query = query.eq('campus', options.campus);
      }
      
      const { data, error } = await query;
      
      if (!error && data) {
        const camelData = toCamelCase(data) as T[];
        // 更新本地缓存
        localStorage.setItem(storageKey, JSON.stringify(camelData));
        return camelData;
      }
    } catch (err) {
      console.warn('云端加载失败，使用本地缓存:', err);
    }
  }
  
  // 从本地加载
  const localData = localStorage.getItem(storageKey);
  return localData ? JSON.parse(localData) : [];
}

/**
 * 保存单条数据（同时保存到本地和云端）
 */
export async function saveItem<T extends { id: string }>(
  storageKey: string,
  item: T,
  options?: { skipCloud?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 更新本地存储
    const existing: T[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const index = existing.findIndex(i => i.id === item.id);
    
    if (index >= 0) {
      existing[index] = item;
    } else {
      existing.push(item);
    }
    
    localStorage.setItem(storageKey, JSON.stringify(existing));
    
    // 2. 同步到云端
    if (!options?.skipCloud && isSupabaseConfigured) {
      const tableName = TABLE_MAP[storageKey];
      if (tableName) {
        const snakeData = toSnakeCase({
          ...item,
          updated_at: new Date().toISOString()
        });
        
        const { error } = await supabase
          .from(tableName)
          .upsert(snakeData, { onConflict: 'id' });
        
        if (error) {
          console.error('云端同步失败:', error);
          // 标记为待同步
          markPendingSync(storageKey, item.id);
          return { success: true, error: '已保存到本地，云端同步失败' };
        }
      }
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 删除数据（同时从本地和云端删除）
 */
export async function deleteItem<T extends { id: string }>(
  storageKey: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 从本地删除
    const existing: T[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const filtered = existing.filter(i => i.id !== itemId);
    localStorage.setItem(storageKey, JSON.stringify(filtered));
    
    // 2. 从云端删除
    if (isSupabaseConfigured) {
      const tableName = TABLE_MAP[storageKey];
      if (tableName) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', itemId);
        
        if (error) {
          console.error('云端删除失败:', error);
        }
      }
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 批量保存数据
 */
export async function saveAll<T extends { id: string }>(
  storageKey: string,
  items: T[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 保存到本地
    localStorage.setItem(storageKey, JSON.stringify(items));
    
    // 2. 同步到云端
    if (isSupabaseConfigured && items.length > 0) {
      const tableName = TABLE_MAP[storageKey];
      if (tableName) {
        const snakeData = items.map(item => toSnakeCase({
          ...item,
          updated_at: new Date().toISOString()
        }));
        
        const { error } = await supabase
          .from(tableName)
          .upsert(snakeData, { onConflict: 'id' });
        
        if (error) {
          console.error('批量云端同步失败:', error);
          return { success: true, error: '已保存到本地，云端同步失败' };
        }
      }
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 待同步队列
const pendingSyncQueue: Map<string, Set<string>> = new Map();

function markPendingSync(storageKey: string, itemId: string) {
  if (!pendingSyncQueue.has(storageKey)) {
    pendingSyncQueue.set(storageKey, new Set());
  }
  pendingSyncQueue.get(storageKey)!.add(itemId);
  localStorage.setItem('kt_pending_sync', JSON.stringify(
    Array.from(pendingSyncQueue.entries()).map(([k, v]) => [k, Array.from(v)])
  ));
}

/**
 * 重试同步待处理的数据
 */
export async function retryPendingSync(): Promise<void> {
  if (!isSupabaseConfigured || isSyncing) return;
  
  isSyncing = true;
  
  for (const [storageKey, ids] of pendingSyncQueue.entries()) {
    const tableName = TABLE_MAP[storageKey];
    if (!tableName) continue;
    
    const allData: any[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    for (const id of ids) {
      const item = allData.find(i => i.id === id);
      if (item) {
        const snakeData = toSnakeCase(item);
        const { error } = await supabase
          .from(tableName)
          .upsert(snakeData, { onConflict: 'id' });
        
        if (!error) {
          ids.delete(id);
        }
      }
    }
    
    if (ids.size === 0) {
      pendingSyncQueue.delete(storageKey);
    }
  }
  
  isSyncing = false;
  lastSyncTime = new Date().toISOString();
  localStorage.setItem('kt_last_sync_time', lastSyncTime);
}

/**
 * 一键将所有本地数据上传到云端
 */
export async function uploadAllToCloud(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{ success: boolean; results: Record<string, { count: number; error?: string }> }> {
  if (!isSupabaseConfigured) {
    return { success: false, results: { error: { count: 0, error: '云端服务未配置' } } };
  }
  
  const results: Record<string, { count: number; error?: string }> = {};
  const keys = Object.entries(TABLE_MAP);
  
  for (let i = 0; i < keys.length; i++) {
    const [storageKey, tableName] = keys[i];
    onProgress?.(i + 1, keys.length, storageKey);
    
    try {
      const localData: any[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      if (localData.length > 0) {
        const snakeData = localData.map(item => toSnakeCase({
          ...item,
          updated_at: new Date().toISOString()
        }));
        
        const { error } = await supabase
          .from(tableName)
          .upsert(snakeData, { onConflict: 'id' });
        
        results[storageKey] = {
          count: localData.length,
          error: error?.message
        };
      } else {
        results[storageKey] = { count: 0 };
      }
    } catch (err: any) {
      results[storageKey] = { count: 0, error: err.message };
    }
  }
  
  lastSyncTime = new Date().toISOString();
  localStorage.setItem('kt_last_sync_time', lastSyncTime);
  
  const allSuccess = Object.values(results).every(r => !r.error);
  return { success: allSuccess, results };
}

/**
 * 从云端下载所有数据到本地
 */
export async function downloadAllFromCloud(
  campus?: string,
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{ success: boolean; results: Record<string, { count: number; error?: string }> }> {
  if (!isSupabaseConfigured) {
    return { success: false, results: { error: { count: 0, error: '云端服务未配置' } } };
  }
  
  const results: Record<string, { count: number; error?: string }> = {};
  const keys = Object.entries(TABLE_MAP);
  
  for (let i = 0; i < keys.length; i++) {
    const [storageKey, tableName] = keys[i];
    onProgress?.(i + 1, keys.length, storageKey);
    
    try {
      let query = supabase.from(tableName).select('*');
      
      if (campus && ['students', 'staff', 'fee_payments'].includes(tableName)) {
        query = query.eq('campus', campus);
      }
      
      const { data, error } = await query;
      
      if (error) {
        results[storageKey] = { count: 0, error: error.message };
      } else {
        const camelData = toCamelCase(data || []);
        localStorage.setItem(storageKey, JSON.stringify(camelData));
        results[storageKey] = { count: camelData.length };
      }
    } catch (err: any) {
      results[storageKey] = { count: 0, error: err.message };
    }
  }
  
  lastSyncTime = new Date().toISOString();
  localStorage.setItem('kt_last_sync_time', lastSyncTime);
  
  const allSuccess = Object.values(results).every(r => !r.error);
  return { success: allSuccess, results };
}

/**
 * 考勤数据专用 - 保存
 */
export async function saveAttendanceData(
  date: string,
  studentId: string,
  record: any
): Promise<{ success: boolean; error?: string }> {
  const storageKey = `kt_attendance_${date}`;
  
  // 1. 本地保存
  const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
  existing[studentId] = record;
  localStorage.setItem(storageKey, JSON.stringify(existing));
  
  // 2. 云端同步
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          id: `${date}_${studentId}`,
          date,
          student_id: studentId,
          ...toSnakeCase(record),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (error) {
        console.error('考勤云端同步失败:', error);
      }
    } catch (err) {
      console.error('考勤同步异常:', err);
    }
  }
  
  return { success: true };
}

/**
 * 考勤数据专用 - 加载
 */
export async function loadAttendanceData(
  date: string,
  campus?: string
): Promise<Record<string, any>> {
  const storageKey = `kt_attendance_${date}`;
  
  // 尝试从云端加载
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('attendance_records')
        .select('*')
        .eq('date', date);
      
      if (campus) {
        query = query.eq('campus', campus);
      }
      
      const { data, error } = await query;
      
      if (!error && data) {
        const result: Record<string, any> = {};
        data.forEach((record: any) => {
          const camelRecord = toCamelCase(record);
          result[camelRecord.studentId] = camelRecord;
        });
        localStorage.setItem(storageKey, JSON.stringify(result));
        return result;
      }
    } catch (err) {
      console.warn('考勤云端加载失败:', err);
    }
  }
  
  // 从本地加载
  return JSON.parse(localStorage.getItem(storageKey) || '{}');
}

// 监听网络恢复自动同步
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('网络恢复，开始同步待处理数据...');
    retryPendingSync();
  });
}

export { isSupabaseConfigured };
