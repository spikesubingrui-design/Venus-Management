/**
 * 审计服务 - 完整的操作追踪和字段级修改记录
 * 所有可填写的数据都可二次编辑，每次操作记录操作人、事件和时间
 */

import { getData, saveData, STORAGE_KEYS } from './storageService';

// 字段修改记录
export interface FieldChange {
  field: string;         // 字段名
  fieldLabel: string;    // 字段中文名
  oldValue: any;         // 修改前的值
  newValue: any;         // 修改后的值
}

// 详细的审计日志
export interface AuditLog {
  id: string;
  timestamp: string;
  
  // 操作人信息
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  operatorPhone?: string;
  
  // 操作类型
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'IMPORT';
  
  // 操作目标
  module: string;         // 模块：幼儿档案、教职工管理、日历等
  entityType: string;     // 实体类型：学生、教师、活动等
  entityId: string;       // 实体ID
  entityName: string;     // 实体名称
  
  // 修改详情
  summary: string;        // 操作摘要
  changes?: FieldChange[]; // 字段级修改详情
  
  // 完整数据快照（用于回溯）
  beforeSnapshot?: any;
  afterSnapshot?: any;
  
  // 客户端信息
  ipAddress?: string;
  userAgent?: string;
}

// 字段名称映射（中英文对照）
const FIELD_LABELS: Record<string, Record<string, string>> = {
  // 教职工字段
  staff: {
    name: '姓名',
    phone: '手机号码',
    gender: '性别',
    role: '岗位',
    assignedClass: '负责班级',
    campus: '所属园区',
    hireDate: '入职时间',
    education: '学历',
    certificates: '资质证书',
    status: '在职状态',
    performanceScore: '绩效分数',
    avatar: '头像',
    birthDate: '出生日期',
    idCard: '身份证号',
    address: '家庭住址',
    emergencyContact: '紧急联系人',
    emergencyPhone: '紧急联系电话',
    department: '部门',
    salary: '薪资',
    contractEndDate: '合同到期日',
    notes: '备注',
  },
  // 学生字段
  student: {
    name: '姓名',
    gender: '性别',
    birthDate: '出生日期',
    age: '年龄',
    class: '班级',
    campus: '所属园区',
    enrollDate: '入园日期',
    status: '状态',
    avatar: '头像',
    parent_name: '家长姓名',
    parent_phone: '家长电话',
    parent_relation: '与幼儿关系',
    address: '家庭住址',
    allergies: '过敏史',
    medicalHistory: '病史',
    emergencyContact: '紧急联系人',
    emergencyPhone: '紧急联系电话',
    notes: '备注',
    healthStatus: '健康状况',
    bloodType: '血型',
    height: '身高',
    weight: '体重',
  },
  // 日历活动字段
  calendarEvent: {
    title: '活动名称',
    date: '开始日期',
    endDate: '结束日期',
    type: '活动类型',
    description: '活动描述',
    location: '活动地点',
    time: '活动时间',
    participants: '参与班级',
    reminder: '提醒设置',
  },
  // 通用字段
  common: {
    createdAt: '创建时间',
    updatedAt: '更新时间',
    createdBy: '创建人',
    updatedBy: '更新人',
  },
};

// 获取字段中文名
export function getFieldLabel(entityType: string, field: string): string {
  const typeLabels = FIELD_LABELS[entityType] || {};
  return typeLabels[field] || FIELD_LABELS.common[field] || field;
}

// 比较两个对象，找出所有修改的字段
export function compareObjects(
  oldObj: any,
  newObj: any,
  entityType: string
): FieldChange[] {
  const changes: FieldChange[] = [];
  
  if (!oldObj || !newObj) return changes;
  
  // 获取所有字段
  const allKeys = new Set([
    ...Object.keys(oldObj),
    ...Object.keys(newObj),
  ]);
  
  allKeys.forEach(key => {
    // 跳过内部字段
    if (key.startsWith('_') || key === 'id') return;
    
    const oldValue = oldObj[key];
    const newValue = newObj[key];
    
    // 深度比较
    if (!deepEqual(oldValue, newValue)) {
      changes.push({
        field: key,
        fieldLabel: getFieldLabel(entityType, key),
        oldValue: formatValue(oldValue),
        newValue: formatValue(newValue),
      });
    }
  });
  
  return changes;
}

// 深度比较两个值
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  
  return false;
}

// 格式化值用于显示
function formatValue(value: any): string {
  if (value === null || value === undefined) return '(空)';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(空)';
    return value.join('、');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// 获取当前用户信息
export function getCurrentUser(): { id: string; name: string; role: string; phone?: string } | null {
  try {
    const userStr = localStorage.getItem('kt_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return {
        id: user.id || 'unknown',
        name: user.name || '未知用户',
        role: user.role || 'UNKNOWN',
        phone: user.phone,
      };
    }
  } catch (e) {
    console.error('获取当前用户失败:', e);
  }
  return null;
}

// 记录审计日志
export function logAudit(
  action: AuditLog['action'],
  module: string,
  entityType: string,
  entityId: string,
  entityName: string,
  summary: string,
  changes?: FieldChange[],
  beforeSnapshot?: any,
  afterSnapshot?: any
): AuditLog | null {
  const user = getCurrentUser();
  if (!user) {
    console.warn('无法记录审计日志：未找到当前用户');
    return null;
  }
  
  const log: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    operatorId: user.id,
    operatorName: user.name,
    operatorRole: user.role,
    operatorPhone: user.phone,
    action,
    module,
    entityType,
    entityId,
    entityName,
    summary,
    changes,
    beforeSnapshot,
    afterSnapshot,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
  
  // 保存日志
  const logs = getData<AuditLog>('kt_audit_logs');
  logs.unshift(log);
  
  // 保留最近5000条审计日志
  if (logs.length > 5000) logs.length = 5000;
  
  saveData('kt_audit_logs', logs);
  
  return log;
}

// 创建记录时的审计
export function auditCreate<T extends { id: string; name?: string; title?: string }>(
  module: string,
  entityType: string,
  data: T
): AuditLog | null {
  const entityName = data.name || data.title || data.id;
  return logAudit(
    'CREATE',
    module,
    entityType,
    data.id,
    entityName,
    `新增${getEntityTypeLabel(entityType)}：${entityName}`,
    undefined,
    undefined,
    data
  );
}

// 更新记录时的审计（包含字段级变更）
export function auditUpdate<T extends { id: string; name?: string; title?: string }>(
  module: string,
  entityType: string,
  oldData: T,
  newData: T
): AuditLog | null {
  const entityName = newData.name || newData.title || newData.id;
  const changes = compareObjects(oldData, newData, entityType);
  
  if (changes.length === 0) {
    return null; // 没有实际修改
  }
  
  // 生成修改摘要
  const changedFields = changes.map(c => c.fieldLabel).join('、');
  const summary = `修改${getEntityTypeLabel(entityType)}：${entityName}（修改了${changedFields}）`;
  
  return logAudit(
    'UPDATE',
    module,
    entityType,
    newData.id,
    entityName,
    summary,
    changes,
    oldData,
    newData
  );
}

// 删除记录时的审计
export function auditDelete<T extends { id: string; name?: string; title?: string }>(
  module: string,
  entityType: string,
  data: T
): AuditLog | null {
  const entityName = data.name || data.title || data.id;
  return logAudit(
    'DELETE',
    module,
    entityType,
    data.id,
    entityName,
    `删除${getEntityTypeLabel(entityType)}：${entityName}`,
    undefined,
    data,
    undefined
  );
}

// 获取实体类型的中文名
function getEntityTypeLabel(entityType: string): string {
  const labels: Record<string, string> = {
    staff: '教职工',
    student: '幼儿',
    calendarEvent: '日历活动',
    announcement: '公告',
    document: '文档',
    mealPlan: '食谱',
    visitor: '访客',
    healthRecord: '健康记录',
    attendanceRecord: '考勤记录',
  };
  return labels[entityType] || entityType;
}

// 获取指定实体的修改历史
export function getEntityHistory(entityId: string): AuditLog[] {
  const logs = getData<AuditLog>('kt_audit_logs');
  return logs.filter(log => log.entityId === entityId);
}

// 获取指定模块的操作日志
export function getModuleLogs(module: string, limit?: number): AuditLog[] {
  const logs = getData<AuditLog>('kt_audit_logs');
  const filtered = logs.filter(log => log.module === module);
  return limit ? filtered.slice(0, limit) : filtered;
}

// 获取指定用户的操作日志
export function getUserLogs(userId: string, limit?: number): AuditLog[] {
  const logs = getData<AuditLog>('kt_audit_logs');
  const filtered = logs.filter(log => log.operatorId === userId);
  return limit ? filtered.slice(0, limit) : filtered;
}

// 获取所有审计日志（支持筛选）
export function getAuditLogs(filters?: {
  module?: string;
  entityType?: string;
  entityId?: string;
  operatorId?: string;
  action?: AuditLog['action'];
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}): AuditLog[] {
  let logs = getData<AuditLog>('kt_audit_logs');
  
  if (filters) {
    if (filters.module) {
      logs = logs.filter(l => l.module === filters.module);
    }
    if (filters.entityType) {
      logs = logs.filter(l => l.entityType === filters.entityType);
    }
    if (filters.entityId) {
      logs = logs.filter(l => l.entityId === filters.entityId);
    }
    if (filters.operatorId) {
      logs = logs.filter(l => l.operatorId === filters.operatorId);
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
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      logs = logs.filter(l => 
        l.entityName.toLowerCase().includes(term) ||
        l.summary.toLowerCase().includes(term) ||
        l.operatorName.toLowerCase().includes(term)
      );
    }
  }
  
  return logs;
}

// 格式化时间显示
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // 1分钟内
  if (diff < 60000) return '刚刚';
  // 1小时内
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  // 24小时内
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  // 7天内
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  
  // 其他显示完整日期时间
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 获取操作类型的中文名和颜色
export function getActionInfo(action: AuditLog['action']): { label: string; color: string; bgColor: string } {
  const info: Record<string, { label: string; color: string; bgColor: string }> = {
    CREATE: { label: '新增', color: '#22c55e', bgColor: 'bg-green-100' },
    UPDATE: { label: '修改', color: '#3b82f6', bgColor: 'bg-blue-100' },
    DELETE: { label: '删除', color: '#ef4444', bgColor: 'bg-red-100' },
    VIEW: { label: '查看', color: '#64748b', bgColor: 'bg-slate-100' },
    EXPORT: { label: '导出', color: '#8b5cf6', bgColor: 'bg-purple-100' },
    IMPORT: { label: '导入', color: '#f59e0b', bgColor: 'bg-amber-100' },
  };
  return info[action] || { label: action, color: '#64748b', bgColor: 'bg-slate-100' };
}

// 导出审计日志
export function exportAuditLogs(filters?: Parameters<typeof getAuditLogs>[0]): string {
  const logs = getAuditLogs(filters);
  return JSON.stringify({
    exportTime: new Date().toISOString(),
    totalCount: logs.length,
    logs,
  }, null, 2);
}

/**
 * ⚠️ 审计日志保护机制
 * 
 * 审计日志/历史存档是永久记录，任何人都不能删除！
 * 这是系统安全和合规的核心要求。
 */

// 删除审计日志 - 永远返回失败
export function deleteAuditLog(logId: string): { success: false; reason: string } {
  console.warn(`[安全警告] 尝试删除审计日志 ${logId}，操作被拒绝`);
  
  // 记录这次尝试删除的行为本身
  const user = getCurrentUser();
  if (user) {
    logAudit(
      'VIEW', // 记录为查看，实际是删除尝试
      '系统安全',
      'auditLog',
      logId,
      '审计日志',
      `⚠️ 安全警告：用户 ${user.name}(${user.role}) 尝试删除审计日志，操作被拒绝`,
      undefined,
      undefined,
      undefined
    );
  }
  
  return {
    success: false,
    reason: '审计日志/历史存档为永久记录，任何人（包括最高管理员）都不能删除。这是系统安全和合规的核心要求。',
  };
}

// 批量删除审计日志 - 永远返回失败
export function deleteAuditLogs(logIds: string[]): { success: false; reason: string } {
  console.warn(`[安全警告] 尝试批量删除 ${logIds.length} 条审计日志，操作被拒绝`);
  return deleteAuditLog('batch');
}

// 清空审计日志 - 永远返回失败
export function clearAuditLogs(): { success: false; reason: string } {
  console.warn('[安全警告] 尝试清空所有审计日志，操作被拒绝');
  return deleteAuditLog('all');
}

// 检查是否可以删除审计日志（永远返回 false）
export function canDeleteAuditLog(): boolean {
  return false;
}

// 获取审计日志保护说明
export function getAuditLogProtectionInfo(): {
  isProtected: true;
  reason: string;
  policy: string[];
} {
  return {
    isProtected: true,
    reason: '审计日志/历史存档受永久保护',
    policy: [
      '所有操作记录永久保存，不可删除',
      '任何用户（包括最高管理员）都无权删除',
      '这是系统安全和合规审计的核心要求',
      '审计日志用于追溯所有数据变更历史',
      '任何删除尝试都会被记录在案',
    ],
  };
}

