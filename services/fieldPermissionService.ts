/**
 * 字段级权限控制服务
 * 
 * 规则：
 * 1. 审计日志/历史存档 - 任何人都不能删除，永久保存
 * 2. 园长权限字段 - 只有园长（SUPER_ADMIN）可以编辑
 * 3. 普通字段 - 有编辑权限的用户都可以编辑
 */

import { UserRole } from '../types';

// 园长权限字段 - 只有园长（SUPER_ADMIN）可以编辑
export const SENSITIVE_FIELDS = {
  // 教职工 - 园长权限字段
  staff: {
    hireDate: { label: '入职时间', reason: '入职记录属于人事档案核心信息' },
    idCard: { label: '身份证号', reason: '身份证号属于个人隐私核心信息' },
    salary: { label: '薪资', reason: '薪资属于财务机密信息' },
    contractEndDate: { label: '合同到期日', reason: '合同信息属于法律文件' },
    status: { label: '在职状态', reason: '在职状态变更需要人事审批' },
    socialSecurity: { label: '社保账号', reason: '社保信息属于财务机密' },
    bankAccount: { label: '银行账号', reason: '银行账号属于财务机密' },
    performanceScore: { label: '绩效分数', reason: '绩效评定需要管理层审批' },
  },
  
  // 幼儿 - 园长权限字段
  student: {
    enrollDate: { label: '入园日期', reason: '入园记录属于学籍核心信息' },
    studentNumber: { label: '学号', reason: '学号是学籍唯一标识' },
    bloodType: { label: '血型', reason: '血型属于医疗档案信息' },
    allergies: { label: '过敏史', reason: '过敏史属于医疗档案信息' },
    medicalHistory: { label: '病史', reason: '病史属于医疗档案信息' },
    idCard: { label: '身份证号', reason: '身份证号属于个人隐私核心信息' },
    birthCertificate: { label: '出生证明号', reason: '出生证明属于法律文件' },
    guardianIdCard: { label: '监护人身份证', reason: '身份证号属于个人隐私核心信息' },
    withdrawDate: { label: '退园日期', reason: '退园记录属于学籍核心信息' },
  },
  
  // 日历活动 - 园长权限字段
  calendarEvent: {
    // 节假日相关的系统数据不可编辑
  },
  
  // 系统配置 - 园长权限字段
  system: {
    superAdminPhone: { label: '超管手机号', reason: '系统安全配置' },
    apiKeys: { label: 'API密钥', reason: '系统安全配置' },
  },
};

// 完全只读字段（任何人都不能编辑，包括SUPER_ADMIN）
export const READONLY_FIELDS = {
  staff: {
    id: { label: 'ID', reason: '系统生成的唯一标识' },
    createdAt: { label: '创建时间', reason: '系统自动记录' },
  },
  student: {
    id: { label: 'ID', reason: '系统生成的唯一标识' },
    createdAt: { label: '创建时间', reason: '系统自动记录' },
  },
  auditLog: {
    '*': { label: '所有字段', reason: '审计日志不可修改或删除' },
  },
};

// 检查用户是否有权限编辑某个字段
export function canEditField(
  userRole: UserRole,
  entityType: keyof typeof SENSITIVE_FIELDS,
  fieldName: string
): { allowed: boolean; reason?: string } {
  // 检查是否为只读字段
  const readonlyEntity = READONLY_FIELDS[entityType as keyof typeof READONLY_FIELDS];
  if (readonlyEntity) {
    if (readonlyEntity['*' as keyof typeof readonlyEntity] || readonlyEntity[fieldName as keyof typeof readonlyEntity]) {
      const field = readonlyEntity['*' as keyof typeof readonlyEntity] || readonlyEntity[fieldName as keyof typeof readonlyEntity];
      return { 
        allowed: false, 
        reason: `${(field as any).label}不可编辑：${(field as any).reason}` 
      };
    }
  }
  
  // 检查是否为园长权限字段
  const sensitiveEntity = SENSITIVE_FIELDS[entityType] as Record<string, { label: string; reason: string }> | undefined;
  if (sensitiveEntity && Object.keys(sensitiveEntity).length > 0) {
    const sensitiveField = sensitiveEntity[fieldName];
    if (sensitiveField) {
      if (userRole !== 'SUPER_ADMIN') {
        return { 
          allowed: false, 
          reason: `${sensitiveField.label}只有园长可以编辑：${sensitiveField.reason}` 
        };
      }
    }
  }
  
  return { allowed: true };
}

// 检查用户是否有园长权限（可编辑园长权限字段）
export function canEditSensitiveFields(userRole: UserRole): boolean {
  return userRole === 'SUPER_ADMIN';
}

// 获取某个实体类型的所有园长权限字段列表
export function getSensitiveFieldsList(entityType: keyof typeof SENSITIVE_FIELDS): string[] {
  const entity = SENSITIVE_FIELDS[entityType];
  return entity ? Object.keys(entity) : [];
}

// 获取园长权限字段的中文名
export function getSensitiveFieldLabel(entityType: keyof typeof SENSITIVE_FIELDS, fieldName: string): string {
  const entity = SENSITIVE_FIELDS[entityType] as Record<string, { label: string; reason: string }> | undefined;
  if (entity && Object.keys(entity).length > 0) {
    const field = entity[fieldName];
    if (field) return field.label;
  }
  return fieldName;
}

// 过滤掉用户无权编辑的字段（用于表单提交前）
export function filterEditableFields<T extends Record<string, any>>(
  data: T,
  originalData: T,
  userRole: UserRole,
  entityType: keyof typeof SENSITIVE_FIELDS
): T {
  const result = { ...data };
  
  const sensitiveFields = getSensitiveFieldsList(entityType);
  
  if (userRole !== 'SUPER_ADMIN') {
    // 非园长用户：恢复园长权限字段为原始值
    sensitiveFields.forEach(field => {
      if (field in originalData) {
        (result as any)[field] = originalData[field];
      }
    });
  }
  
  return result;
}

// 检查是否尝试修改了园长权限字段
export function checkSensitiveFieldChanges<T extends Record<string, any>>(
  oldData: T,
  newData: T,
  entityType: keyof typeof SENSITIVE_FIELDS
): { field: string; label: string; oldValue: any; newValue: any }[] {
  const changes: { field: string; label: string; oldValue: any; newValue: any }[] = [];
  const sensitiveFields = getSensitiveFieldsList(entityType);
  
  sensitiveFields.forEach(field => {
    const oldValue = oldData[field];
    const newValue = newData[field];
    
    if (oldValue !== newValue) {
      changes.push({
        field,
        label: getSensitiveFieldLabel(entityType, field),
        oldValue,
        newValue,
      });
    }
  });
  
  return changes;
}

// 审计日志保护 - 禁止删除
export function canDeleteAuditLog(): { allowed: boolean; reason: string } {
  return {
    allowed: false,
    reason: '审计日志/历史存档为永久记录，任何人都不能删除。这是系统安全和合规要求。',
  };
}

// 导出权限提示信息
export const PERMISSION_MESSAGES = {
  SENSITIVE_FIELD_SUPER_ADMIN_ONLY: '此字段为园长权限，仅园长可编辑',
  AUDIT_LOG_PROTECTED: '历史存档受永久保护，不可删除',
  READONLY_FIELD: '此字段为系统只读字段，不可编辑',
};

// 获取当前用户对园长权限字段的说明
export function getPermissionSummary(userRole: UserRole): string {
  if (userRole === 'SUPER_ADMIN') {
    return '您拥有园长权限，可以编辑所有字段';
  }
  return '部分字段（如入职时间、在职状态等）为园长权限，仅园长可编辑';
}

