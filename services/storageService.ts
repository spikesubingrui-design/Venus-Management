/**
 * 统一数据存储服务
 * 所有可编辑数据的电子留存和操作日志
 * 支持 Supabase 云端同步
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

// 操作日志类型
export interface OperationLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIRM' | 'UPLOAD';
  module: string;        // 模块名称
  targetType: string;    // 操作对象类型
  targetId: string;      // 操作对象ID
  targetName: string;    // 操作对象名称
  summary: string;       // 操作摘要
  beforeData?: any;      // 修改前数据
  afterData?: any;       // 修改后数据
}

// 存储键名常量
export const STORAGE_KEYS = {
  // 用户管理
  ALL_USERS: 'kt_all_users',
  USER_PASSWORDS: 'kt_user_passwords',
  AUTHORIZED_PHONES: 'kt_authorized_phones',
  
  // 幼儿档案
  STUDENTS: 'kt_students',
  HEALTH_RECORDS: 'kt_health_records',
  ATTENDANCE_RECORDS: 'kt_attendance_records',
  PICKUP_RECORDS: 'kt_pickup_records',
  GROWTH_RECORDS: 'kt_growth_records',
  
  // 食谱管理
  MEAL_PLANS: 'kt_meal_plans',
  PROCUREMENT_RECORDS: 'kt_procurement_records',
  
  // 教职工
  STAFF: 'kt_staff',
  SCHEDULES: 'kt_schedules',
  
  // 家园共育
  ANNOUNCEMENTS: 'kt_announcements',
  CLASS_NOTIFICATIONS: 'kt_class_notifications',
  MESSAGES: 'kt_messages',
  
  // 课程计划
  CURRICULUM: 'kt_curriculum',
  
  // 安全管理
  VISITORS: 'kt_visitors',
  FIRE_CHECKS: 'kt_fire_checks',
  PATROLS: 'kt_patrols',
  PATROL_POINTS: 'kt_patrol_points',
  
  // 资料管理
  DOCUMENTS: 'kt_documents',
  FOLDERS: 'kt_folders',
  
  // 传染病与消毒
  INFECTIOUS_DISEASE: 'kt_infectious_disease',
  DISINFECTION: 'kt_disinfection',
  
  // 行政值班
  ADMIN_DUTY: 'kt_admin_duty',
  MEAL_ACCOMPANY: 'kt_meal_accompany',
  
  // 操作日志
  OPERATION_LOGS: 'kt_operation_logs',
  
  // 待确认队列
  PENDING_UPLOADS: 'kt_pending_uploads',
};

// 待上传项目
export interface PendingUpload {
  id: string;
  module: string;
  type: string;
  data: any;
  createdAt: string;
  createdBy: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
}

// 字段转换：snake_case -> camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
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
 * 获取存储数据（优先本地，支持云端回退）
 */
export function getData<T>(key: string, defaultValue: T[] = []): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return defaultValue;
  }
}

/**
 * 从云端获取数据（用于初始化）
 */
export async function getDataFromCloud<T>(key: string): Promise<T[] | null> {
  if (!isSupabaseConfigured) return null;
  
  const tableName = SUPABASE_TABLE_MAPPING[key];
  if (!tableName) return null;
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log(`[Supabase] 从 ${tableName} 加载失败:`, error.message);
      return null;
    }
    
    // 转换为 camelCase
    const localData = toCamelCase(data || []);
    console.log(`☁️ [Supabase] 从 ${tableName} 加载了 ${localData.length} 条数据`);
    return localData;
  } catch (err) {
    return null;
  }
}

/**
 * 初始化数据（云端优先，本地备份）
 */
export async function initializeData<T>(key: string, defaultValue: T[] = []): Promise<T[]> {
  // 1. 尝试从云端加载
  const cloudData = await getDataFromCloud<T>(key);
  
  if (cloudData && cloudData.length > 0) {
    // 云端有数据，同步到本地
    localStorage.setItem(key, JSON.stringify(cloudData));
    return cloudData;
  }
  
  // 2. 云端无数据，使用本地数据
  const localData = getData<T>(key, defaultValue);
  
  // 3. 如果本地有数据，上传到云端
  if (localData.length > 0) {
    syncToSupabase(key, localData as any[]).catch(() => {});
  }
  
  return localData;
}

// Supabase 表名映射（完整版）
const SUPABASE_TABLE_MAPPING: Record<string, string> = {
  // 幼儿档案
  [STORAGE_KEYS.STUDENTS]: 'students',
  [STORAGE_KEYS.HEALTH_RECORDS]: 'health_records',
  [STORAGE_KEYS.ATTENDANCE_RECORDS]: 'attendance_records',
  [STORAGE_KEYS.PICKUP_RECORDS]: 'pickup_records',
  [STORAGE_KEYS.GROWTH_RECORDS]: 'growth_records',
  
  // 教职工
  [STORAGE_KEYS.STAFF]: 'staff',
  [STORAGE_KEYS.SCHEDULES]: 'staff_schedules',
  
  // 食谱管理
  [STORAGE_KEYS.MEAL_PLANS]: 'meal_plans',
  [STORAGE_KEYS.PROCUREMENT_RECORDS]: 'procurement_records',
  
  // 家园共育
  [STORAGE_KEYS.ANNOUNCEMENTS]: 'announcements',
  [STORAGE_KEYS.MESSAGES]: 'chat_messages',
  
  // 课程计划
  [STORAGE_KEYS.CURRICULUM]: 'curriculum',
  
  // 安全管理
  [STORAGE_KEYS.VISITORS]: 'visitors',
  [STORAGE_KEYS.FIRE_CHECKS]: 'fire_checks',
  [STORAGE_KEYS.PATROLS]: 'patrols',
  [STORAGE_KEYS.DISINFECTION]: 'disinfection_records',
  
  // 资料管理
  [STORAGE_KEYS.DOCUMENTS]: 'documents',
  
  // 操作日志
  [STORAGE_KEYS.OPERATION_LOGS]: 'operation_logs',
};

// 字段转换：camelCase -> snake_case
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// 受保护的核心数据键 - 自动同步时需要安全检查
const PROTECTED_SYNC_KEYS: Record<string, number> = {
  'kt_students': 10,    // 学生数据至少10条
  'kt_staff': 20,       // 教职工至少20条
};

// 不需要同步到 OSS 的本地专用键
const LOCAL_ONLY_KEYS = new Set([
  'kt_user', 'kt_user_passwords', 'kt_data_imported_v7', 
  'kt_last_sync_time', 'kt_parent_picker_info', 'kt_pref_v2',
]);

/**
 * 通用保存并同步函数（适用于任何数据类型）
 * 所有 View 应该用这个函数代替直接调用 localStorage.setItem
 * 会自动触发 OSS 同步（防抖），确保数据实时同步到云端
 */
export function saveAndSync(key: string, data: any): void {
  try {
    // 对数组数据自动去重（按 name 组合键去重）
    let finalData = data;
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const seen = new Map();
      finalData = data.filter((item: any) => {
        const dedupKey = item.name 
          ? (item.phone ? `${item.name}_${item.phone}` 
            : item.class ? `${item.name}_${item.class}` 
            : item.assignedClass ? `${item.name}_${item.assignedClass}` 
            : item.name)
          : item.id;
        if (!dedupKey || seen.has(dedupKey)) return false;
        seen.set(dedupKey, true);
        return true;
      });
      if (finalData.length !== data.length) {
        console.log(`[Storage] 🔄 ${key} 自动去重: ${data.length} → ${finalData.length}`);
      }
    }
    
    localStorage.setItem(key, JSON.stringify(finalData));
    
    // 本地专用键不同步
    if (LOCAL_ONLY_KEYS.has(key) || !key.startsWith('kt_')) return;
    
    // 数组数据的安全检查
    if (Array.isArray(finalData)) {
      const minCount = PROTECTED_SYNC_KEYS[key];
      if (minCount && finalData.length < minCount) {
        console.warn(`[Storage] ⚠️ ${key} 数据不足(${finalData.length}条 < ${minCount})，跳过同步`);
        return;
      }
    }
    
    // 自动触发阿里云OSS同步（防抖，异步）
    import('./aliyunOssService').then(({ syncToAliyun }) => {
      syncToAliyun(key);
    }).catch(() => {});
    
    console.log(`[Storage] 💾 ${key} 已保存并触发同步 (${Array.isArray(finalData) ? finalData.length + '条' : 'object'})`);
  } catch (e) {
    console.error(`[Storage] 保存失败 ${key}:`, e);
  }
}

/**
 * 保存数据（自动同步到云端）
 * 1. 保存到本地 localStorage
 * 2. 同步到阿里云 OSS（核心数据有安全检查）
 * 3. 同步到 Supabase（如果配置了）
 */
export function saveData<T>(key: string, data: T[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    
    // 自动触发阿里云OSS同步（异步，不阻塞）
    // 对核心数据做安全检查，防止少量数据覆盖云端完整数据
    const minCount = PROTECTED_SYNC_KEYS[key];
    if (minCount && data.length < minCount) {
      console.warn(`[Storage] ⚠️ ${key} 数据不足(${data.length}条 < ${minCount})，跳过自动同步以保护云端数据`);
    } else {
      import('./aliyunOssService').then(({ syncToAliyun }) => {
        syncToAliyun(key);
      }).catch(() => {
        // 同步服务不可用时静默失败
      });
    }
    
    // 自动同步到 Supabase（异步，不阻塞）
    syncToSupabase(key, data).catch((err) => {
      console.log(`[Supabase] ${key} 同步失败:`, err);
    });
    
    return true;
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
    return false;
  }
}

/**
 * 同步数据到 Supabase
 */
async function syncToSupabase<T extends { id?: string }>(key: string, data: T[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  
  const tableName = SUPABASE_TABLE_MAPPING[key];
  if (!tableName) {
    // 该数据类型不需要同步到 Supabase
    return;
  }
  
  try {
    // 转换为 snake_case
    const cloudData = data.map(item => toSnakeCase(item));
    
    // 使用 upsert 批量更新
    const { error } = await supabase
      .from(tableName)
      .upsert(cloudData, { onConflict: 'id' });
    
    if (error) {
      console.log(`[Supabase] ${key} -> ${tableName} 同步失败:`, error.message);
    } else {
      console.log(`☁️ [Supabase] ${key} -> ${tableName} 同步成功 (${data.length} 条)`);
    }
  } catch (err) {
    // 静默失败，不影响本地操作
  }
}

/**
 * 记录操作日志
 */
export function logOperation(
  userId: string,
  userName: string,
  userRole: string,
  action: OperationLog['action'],
  module: string,
  targetType: string,
  targetId: string,
  targetName: string,
  summary: string,
  beforeData?: any,
  afterData?: any
): void {
  const logs = getData<OperationLog>(STORAGE_KEYS.OPERATION_LOGS);
  const newLog: OperationLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    userRole,
    action,
    module,
    targetType,
    targetId,
    targetName,
    summary,
    beforeData,
    afterData,
  };
  logs.unshift(newLog); // 最新的在前面
  // 只保留最近1000条日志
  if (logs.length > 1000) logs.length = 1000;
  saveData(STORAGE_KEYS.OPERATION_LOGS, logs);
}

/**
 * 获取操作日志
 */
export function getOperationLogs(filters?: {
  module?: string;
  userId?: string;
  action?: OperationLog['action'];
  startDate?: string;
  endDate?: string;
}): OperationLog[] {
  let logs = getData<OperationLog>(STORAGE_KEYS.OPERATION_LOGS);
  
  if (filters) {
    if (filters.module) {
      logs = logs.filter(l => l.module === filters.module);
    }
    if (filters.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters.action) {
      logs = logs.filter(l => l.action === filters.action);
    }
    if (filters.startDate) {
      logs = logs.filter(l => l.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      logs = logs.filter(l => l.timestamp <= filters.endDate!);
    }
  }
  
  return logs;
}

/**
 * 添加待确认上传项
 */
export function addPendingUpload(
  module: string,
  type: string,
  data: any,
  createdBy: string
): string {
  const pending = getData<PendingUpload>(STORAGE_KEYS.PENDING_UPLOADS);
  const id = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  pending.push({
    id,
    module,
    type,
    data,
    createdAt: new Date().toISOString(),
    createdBy,
    status: 'PENDING',
  });
  saveData(STORAGE_KEYS.PENDING_UPLOADS, pending);
  return id;
}

/**
 * 确认上传
 */
export function confirmUpload(
  pendingId: string,
  storageKey: string,
  userId: string,
  userName: string,
  userRole: string
): boolean {
  const pending = getData<PendingUpload>(STORAGE_KEYS.PENDING_UPLOADS);
  const item = pending.find(p => p.id === pendingId);
  
  if (!item || item.status !== 'PENDING') return false;
  
  // 获取目标存储
  const targetData = getData<any>(storageKey);
  
  // 检查是更新还是新增
  const existingIndex = targetData.findIndex((d: any) => d.id === item.data.id);
  const beforeData = existingIndex >= 0 ? targetData[existingIndex] : null;
  
  if (existingIndex >= 0) {
    targetData[existingIndex] = item.data;
  } else {
    targetData.push(item.data);
  }
  
  // 保存数据
  saveData(storageKey, targetData);
  
  // 更新待上传状态
  item.status = 'CONFIRMED';
  saveData(STORAGE_KEYS.PENDING_UPLOADS, pending);
  
  // 记录操作日志
  logOperation(
    userId,
    userName,
    userRole,
    beforeData ? 'UPDATE' : 'CREATE',
    item.module,
    item.type,
    item.data.id,
    item.data.name || item.data.title || item.data.id,
    `${beforeData ? '更新' : '新增'}${item.type}`,
    beforeData,
    item.data
  );
  
  return true;
}

/**
 * 取消上传
 */
export function cancelUpload(pendingId: string): boolean {
  const pending = getData<PendingUpload>(STORAGE_KEYS.PENDING_UPLOADS);
  const item = pending.find(p => p.id === pendingId);
  
  if (!item || item.status !== 'PENDING') return false;
  
  item.status = 'CANCELLED';
  saveData(STORAGE_KEYS.PENDING_UPLOADS, pending);
  return true;
}

/**
 * 获取待确认上传列表
 */
export function getPendingUploads(module?: string): PendingUpload[] {
  let pending = getData<PendingUpload>(STORAGE_KEYS.PENDING_UPLOADS);
  pending = pending.filter(p => p.status === 'PENDING');
  if (module) {
    pending = pending.filter(p => p.module === module);
  }
  return pending;
}

/**
 * 直接保存并记录日志（用于简单操作）
 */
export function saveWithLog<T extends { id: string; name?: string; title?: string }>(
  storageKey: string,
  data: T,
  module: string,
  type: string,
  userId: string,
  userName: string,
  userRole: string,
  isDelete: boolean = false
): boolean {
  const allData = getData<T>(storageKey);
  const existingIndex = allData.findIndex(d => d.id === data.id);
  const beforeData = existingIndex >= 0 ? allData[existingIndex] : null;
  
  if (isDelete) {
    if (existingIndex >= 0) {
      allData.splice(existingIndex, 1);
    }
  } else if (existingIndex >= 0) {
    allData[existingIndex] = data;
  } else {
    allData.push(data);
  }
  
  const success = saveData(storageKey, allData);
  
  if (success) {
    logOperation(
      userId,
      userName,
      userRole,
      isDelete ? 'DELETE' : (beforeData ? 'UPDATE' : 'CREATE'),
      module,
      type,
      data.id,
      data.name || data.title || data.id,
      `${isDelete ? '删除' : (beforeData ? '更新' : '新增')}${type}`,
      beforeData,
      isDelete ? null : data
    );
  }
  
  return success;
}

/**
 * 批量保存并记录日志
 */
export function batchSaveWithLog<T extends { id: string }>(
  storageKey: string,
  dataList: T[],
  module: string,
  type: string,
  userId: string,
  userName: string,
  userRole: string,
  summary: string
): boolean {
  const success = saveData(storageKey, dataList);
  
  if (success) {
    logOperation(
      userId,
      userName,
      userRole,
      'UPDATE',
      module,
      type,
      'batch',
      `批量${type}`,
      summary,
      null,
      { count: dataList.length }
    );
  }
  
  return success;
}

/**
 * 导出数据为JSON文件
 */
export function exportData(keys: string[]): string {
  const exportObj: Record<string, any> = {};
  keys.forEach(key => {
    exportObj[key] = getData<any>(key);
  });
  return JSON.stringify(exportObj, null, 2);
}

/**
 * 导出所有数据
 */
export function exportAllData(): string {
  return exportData(Object.values(STORAGE_KEYS));
}

/**
 * 获取存储统计
 */
export function getStorageStats(): { key: string; count: number; size: string }[] {
  return Object.entries(STORAGE_KEYS).map(([name, key]) => {
    const data = localStorage.getItem(key) || '[]';
    const parsed = JSON.parse(data);
    return {
      key: name,
      count: Array.isArray(parsed) ? parsed.length : 1,
      size: (data.length / 1024).toFixed(2) + ' KB',
    };
  });
}





