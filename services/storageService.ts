/**
 * 统一数据存储服务
 * 所有可编辑数据的电子留存和操作日志
 */

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

/**
 * 获取存储数据
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
 * 保存数据（自动同步到阿里云OSS）
 */
export function saveData<T>(key: string, data: T[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    
    // 自动触发阿里云OSS同步（异步，不阻塞）
    import('./aliyunOssService').then(({ syncToAliyun }) => {
      syncToAliyun(key);
    }).catch(() => {
      // 同步服务不可用时静默失败
    });
    
    return true;
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
    return false;
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





