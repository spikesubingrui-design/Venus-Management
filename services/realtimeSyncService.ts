/**
 * 实时数据同步服务
 * 自动将本地数据同步到云端，无需手动操作
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { STORAGE_KEYS } from './storageService';

// 表名映射
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

// 字段映射：camelCase -> snake_case
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

// 字段映射：snake_case -> camelCase
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

// 防抖计时器
const debounceTimers: Record<string, NodeJS.Timeout> = {};
const DEBOUNCE_DELAY = 300; // 300毫秒防抖，几乎实时

// 同步状态
let syncEnabled = true;
let lastSyncTime: Record<string, number> = {};

/**
 * 启用/禁用同步
 */
export function setSyncEnabled(enabled: boolean): void {
  syncEnabled = enabled;
  console.log(`[RealtimeSync] 同步${enabled ? '已启用' : '已禁用'}`);
}

/**
 * 上传单条数据到云端
 */
async function uploadItem(tableName: string, item: any): Promise<boolean> {
  if (!isSupabaseConfigured || !syncEnabled) return false;

  try {
    const cloudData = toSnakeCase(item);
    const { error } = await supabase
      .from(tableName)
      .upsert(cloudData, { onConflict: 'id' });

    if (error) {
      console.error(`[RealtimeSync] 上传到 ${tableName} 失败:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[RealtimeSync] 上传异常:`, err);
    return false;
  }
}

/**
 * 删除云端数据
 */
async function deleteFromCloud(tableName: string, id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !syncEnabled) return false;

  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[RealtimeSync] 从 ${tableName} 删除失败:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[RealtimeSync] 删除异常:`, err);
    return false;
  }
}

/**
 * 同步整个存储键的数据到云端（带防抖）
 */
export function syncToCloud(storageKey: string): void {
  if (!isSupabaseConfigured || !syncEnabled) return;

  const tableName = TABLE_MAPPING[storageKey];
  if (!tableName) return;

  // 清除之前的计时器
  if (debounceTimers[storageKey]) {
    clearTimeout(debounceTimers[storageKey]);
  }

  // 设置新的防抖计时器
  debounceTimers[storageKey] = setTimeout(async () => {
    try {
      const localData = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      if (!Array.isArray(localData) || localData.length === 0) return;

      console.log(`[RealtimeSync] 正在同步 ${tableName}...`);

      // 批量上传
      const cloudData = toSnakeCase(localData);
      const { error } = await supabase
        .from(tableName)
        .upsert(cloudData, { onConflict: 'id' });

      if (error) {
        console.error(`[RealtimeSync] 同步 ${tableName} 失败:`, error.message);
      } else {
        lastSyncTime[storageKey] = Date.now();
        console.log(`[RealtimeSync] ✅ ${tableName} 同步完成 (${localData.length}条)`);
      }
    } catch (err) {
      console.error(`[RealtimeSync] 同步异常:`, err);
    }
  }, DEBOUNCE_DELAY);
}

/**
 * 从云端拉取数据
 */
export async function pullFromCloud(storageKey: string): Promise<any[]> {
  if (!isSupabaseConfigured) return [];

  const tableName = TABLE_MAPPING[storageKey];
  if (!tableName) return [];

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.error(`[RealtimeSync] 从 ${tableName} 拉取失败:`, error.message);
      return [];
    }

    return toCamelCase(data || []);
  } catch (err) {
    console.error(`[RealtimeSync] 拉取异常:`, err);
    return [];
  }
}

/**
 * 初始化时双向同步所有数据
 */
export async function initializeFromCloud(): Promise<void> {
  if (!isSupabaseConfigured) {
    console.log('[RealtimeSync] Supabase未配置，跳过云端初始化');
    return;
  }

  console.log('[RealtimeSync] 正在进行启动时双向同步...');

  for (const [storageKey, tableName] of Object.entries(TABLE_MAPPING)) {
    try {
      // 获取本地数据
      const localData = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      // 获取云端数据
      const cloudData = await pullFromCloud(storageKey);
      
      // 如果本地有数据但云端没有，上传本地数据
      if (localData.length > 0 && cloudData.length === 0) {
        console.log(`[RealtimeSync] 📤 ${tableName}: 上传本地${localData.length}条数据到云端...`);
        const cloudDataToUpload = toSnakeCase(localData);
        const { error } = await supabase
          .from(tableName)
          .upsert(cloudDataToUpload, { onConflict: 'id' });
        
        if (error) {
          console.error(`[RealtimeSync] 上传 ${tableName} 失败:`, error.message);
        } else {
          console.log(`[RealtimeSync] ✅ ${tableName}: 已上传${localData.length}条数据`);
        }
      } 
      // 如果云端有数据，进行合并
      else if (cloudData.length > 0) {
        const merged = mergeData(localData, cloudData);
        localStorage.setItem(storageKey, JSON.stringify(merged));
        console.log(`[RealtimeSync] ✅ ${tableName}: 云端${cloudData.length}条，本地${localData.length}条，合并后${merged.length}条`);
        
        // 如果本地有云端没有的数据，也上传
        if (merged.length > cloudData.length) {
          const cloudDataToUpload = toSnakeCase(merged);
          await supabase.from(tableName).upsert(cloudDataToUpload, { onConflict: 'id' });
          console.log(`[RealtimeSync] 📤 ${tableName}: 补充上传${merged.length - cloudData.length}条数据`);
        }
      }
    } catch (err) {
      console.error(`[RealtimeSync] 初始化 ${tableName} 失败:`, err);
    }
  }

  console.log('[RealtimeSync] 启动同步完成');
}

/**
 * 合并本地和云端数据
 */
function mergeData<T extends { id: string; updatedAt?: string }>(local: T[], cloud: T[]): T[] {
  const merged = new Map<string, T>();

  // 先添加本地数据
  local.forEach(item => merged.set(item.id, item));

  // 用云端数据覆盖（云端优先）
  cloud.forEach(cloudItem => {
    const localItem = merged.get(cloudItem.id);
    if (!localItem) {
      merged.set(cloudItem.id, cloudItem);
    } else {
      // 比较更新时间，较新的优先
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
 * 监听 localStorage 变化（用于跨标签页同步）
 */
export function startStorageListener(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('storage', (event) => {
    if (event.key && TABLE_MAPPING[event.key]) {
      console.log(`[RealtimeSync] 检测到 ${event.key} 变化，触发同步`);
      syncToCloud(event.key);
    }
  });

  console.log('[RealtimeSync] 存储监听器已启动');
}

/**
 * 订阅云端实时变更
 */
export function subscribeToCloudChanges(): () => void {
  if (!isSupabaseConfigured) return () => {};

  const subscriptions: any[] = [];

  for (const [storageKey, tableName] of Object.entries(TABLE_MAPPING)) {
    const subscription = supabase
      .channel(`${tableName}_changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          console.log(`[RealtimeSync] 收到云端变更: ${tableName}`, payload.eventType);
          
          // 从云端拉取最新数据
          pullFromCloud(storageKey).then(cloudData => {
            if (cloudData.length > 0) {
              const localData = JSON.parse(localStorage.getItem(storageKey) || '[]');
              const merged = mergeData(localData, cloudData);
              localStorage.setItem(storageKey, JSON.stringify(merged));
              
              // 触发自定义事件通知UI更新
              window.dispatchEvent(new CustomEvent('cloudDataUpdated', { 
                detail: { key: storageKey, data: merged } 
              }));
            }
          });
        }
      )
      .subscribe();

    subscriptions.push(subscription);
  }

  console.log('[RealtimeSync] 云端实时订阅已启动');

  // 返回取消订阅函数
  return () => {
    subscriptions.forEach(sub => sub.unsubscribe());
    console.log('[RealtimeSync] 云端实时订阅已取消');
  };
}

/**
 * 获取同步状态
 */
export function getSyncStatus(): { enabled: boolean; lastSync: Record<string, number> } {
  return {
    enabled: syncEnabled,
    lastSync: { ...lastSyncTime },
  };
}

/**
 * 导出配置状态
 */
export { isSupabaseConfigured };

