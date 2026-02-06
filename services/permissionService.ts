
// 权限服务 - 管理不同角色的功能权限

import { UserRole } from '../types';

// 功能权限定义
export type Permission = 
  // 学生管理权限
  | 'student.view'           // 查看学生信息
  | 'student.create'         // 创建学生
  | 'student.edit'           // 编辑学生信息
  | 'student.delete'         // 删除学生
  | 'student.attendance'     // 考勤管理
  | 'student.health'         // 健康打卡
  | 'student.pickup'         // 接送管理
  | 'student.growth'         // 成长记录
  | 'student.disease'        // 传染病登记
  | 'student.disinfect'      // 消毒记录
  
  // 厨房权限
  | 'kitchen.view'           // 查看食谱
  | 'kitchen.create'         // 创建食谱
  | 'kitchen.edit'           // 编辑食谱
  | 'kitchen.confirm'        // 确认食谱
  | 'kitchen.procurement'    // 采购管理
  
  // 教职工权限
  | 'staff.view'             // 查看教职工
  | 'staff.create'           // 创建教职工
  | 'staff.edit'             // 编辑教职工
  | 'staff.delete'           // 删除教职工
  | 'staff.schedule'         // 排班管理
  | 'staff.duty'             // 值班管理
  | 'staff.meal'             // 陪餐管理
  | 'staff.performance'      // 绩效管理
  
  // 安全工作权限
  | 'safety.visitor'         // 来访登记
  | 'safety.fire'            // 消防检查
  | 'safety.patrol'          // 安防巡视
  | 'safety.settings'        // 巡视点设置
  
  // 家园共育权限
  | 'communication.view'     // 查看通知
  | 'communication.create'   // 发布通知
  | 'communication.chat'     // 私信聊天
  
  // 课程权限
  | 'curriculum.view'        // 查看课程
  | 'curriculum.edit'        // 编辑课程
  | 'curriculum.album'       // AI相册
  | 'curriculum.observation' // 观察记录
  
  // 资料管理权限
  | 'document.view'          // 查看资料
  | 'document.upload'        // 上传资料
  | 'document.delete'        // 删除资料
  | 'document.permission'    // 权限设置
  
  // 系统管理权限
  | 'system.view'            // 查看系统设置
  | 'system.edit'            // 修改系统设置
  | 'system.user'            // 用户管理
  | 'system.campus'          // 园区管理
  
  // 数据大盘权限
  | 'dashboard.view'         // 查看数据大盘
  | 'dashboard.export'       // 导出数据
  
  // AI助手权限
  | 'ai.use'                 // 使用AI助手
  
  // 收费管理权限
  | 'finance.view'           // 查看收费管理
  | 'finance.calculate'      // 计算退费
  | 'finance.approve'        // 审批退费
  | 'finance.config'         // 配置退费规则
  
  // AI观察记录权限
  | 'observation.view'       // 查看观察记录
  | 'observation.create'     // 创建观察记录
  | 'observation.aiRefine'   // AI润色观察记录
  | 'observation.share'      // 分享给家长
  
  // 成长档案权限
  | 'growthArchive.view'     // 查看成长档案
  | 'growthArchive.generate' // 生成成长档案PDF
  
  // 维修报修权限
  | 'maintenance.view'       // 查看维修报修
  | 'maintenance.create'     // 提交报修
  | 'maintenance.analyze'    // 维修数据分析
  | 'maintenance.manage'     // 管理维修工单
  
  // 数据驾驶舱权限
  | 'dataCockpit.view'       // 查看数据驾驶舱
  
  // 异常监控权限
  | 'anomaly.view'           // 查看异常监控
  | 'anomaly.resolve';       // 解决异常

// 角色权限映射
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // 超级管理员（园长）- 拥有所有权限
  'SUPER_ADMIN': [
    // 学生管理 - 全部权限
    'student.view', 'student.create', 'student.edit', 'student.delete', 
    'student.attendance', 'student.health', 'student.pickup', 'student.growth',
    'student.disease', 'student.disinfect',
    // 厨房管理 - 全部权限
    'kitchen.view', 'kitchen.create', 'kitchen.edit', 'kitchen.confirm', 'kitchen.procurement',
    // 教职工管理 - 全部权限
    'staff.view', 'staff.create', 'staff.edit', 'staff.delete', 
    'staff.schedule', 'staff.duty', 'staff.meal', 'staff.performance',
    // 安全工作 - 全部权限
    'safety.visitor', 'safety.fire', 'safety.patrol', 'safety.settings',
    // 家园共育 - 全部权限
    'communication.view', 'communication.create', 'communication.chat',
    // 课程管理 - 全部权限
    'curriculum.view', 'curriculum.edit', 'curriculum.album', 'curriculum.observation',
    // 资料管理 - 全部权限
    'document.view', 'document.upload', 'document.delete', 'document.permission',
    // 系统管理 - 全部权限
    'system.view', 'system.edit', 'system.user', 'system.campus',
    // 数据大盘 - 全部权限
    'dashboard.view', 'dashboard.export',
    // AI助手
    'ai.use',
    // 收费管理 - 全部权限（园长可审批、配置规则）
    'finance.view', 'finance.calculate', 'finance.approve', 'finance.config',
    // AI观察记录 - 全部权限
    'observation.view', 'observation.create', 'observation.aiRefine', 'observation.share',
    // 成长档案 - 全部权限
    'growthArchive.view', 'growthArchive.generate',
    // 维修报修 - 全部权限
    'maintenance.view', 'maintenance.create', 'maintenance.analyze', 'maintenance.manage',
    // 数据驾驶舱 - 园长专属
    'dataCockpit.view',
    // 异常监控 - 全部权限
    'anomaly.view', 'anomaly.resolve',
  ],
  
  // 园区管理员 - 不能删除学生/文档，不能配置财务规则
  'ADMIN': [
    // 学生管理 - 不能删除
    'student.view', 'student.create', 'student.edit', 
    'student.attendance', 'student.health', 'student.pickup', 'student.growth',
    'student.disease', 'student.disinfect',
    // 厨房管理 - 全部权限
    'kitchen.view', 'kitchen.create', 'kitchen.edit', 'kitchen.confirm', 'kitchen.procurement',
    // 教职工管理 - 不能删除
    'staff.view', 'staff.create', 'staff.edit', 
    'staff.schedule', 'staff.duty', 'staff.meal', 'staff.performance',
    // 安全工作 - 全部权限
    'safety.visitor', 'safety.fire', 'safety.patrol', 'safety.settings',
    // 家园共育 - 全部权限
    'communication.view', 'communication.create', 'communication.chat',
    // 课程管理 - 全部权限
    'curriculum.view', 'curriculum.edit', 'curriculum.album', 'curriculum.observation',
    // 资料管理 - 不能删除、不能设置权限
    'document.view', 'document.upload',
    // 数据大盘
    'dashboard.view', 'dashboard.export',
    // AI助手
    'ai.use',
    // 收费管理 - 可查看、计算、审批，但不能配置规则
    'finance.view', 'finance.calculate', 'finance.approve',
    // AI观察记录 - 全部权限
    'observation.view', 'observation.create', 'observation.aiRefine', 'observation.share',
    // 成长档案 - 全部权限
    'growthArchive.view', 'growthArchive.generate',
    // 维修报修 - 可管理但不能分析
    'maintenance.view', 'maintenance.create', 'maintenance.manage',
    // 异常监控 - 可查看但不能解决
    'anomaly.view',
  ],
  
  // 教师 - 专注教学工作，不能管理厨房/教职工
  'TEACHER': [
    // 学生管理 - 日常管理权限
    'student.view', 'student.attendance', 'student.health', 
    'student.pickup', 'student.growth', 'student.disease', 'student.disinfect',
    // 厨房 - 只能查看食谱（了解幼儿饮食）
    'kitchen.view',
    // 家园共育 - 可发布班级通知、与家长沟通
    'communication.view', 'communication.create', 'communication.chat',
    // 课程管理 - 全部权限
    'curriculum.view', 'curriculum.edit', 'curriculum.album', 'curriculum.observation',
    // 资料管理 - 可查看和上传
    'document.view', 'document.upload',
    // AI助手
    'ai.use',
    // AI观察记录 - 教师核心功能
    'observation.view', 'observation.create', 'observation.aiRefine', 'observation.share',
    // 成长档案 - 可查看和生成
    'growthArchive.view', 'growthArchive.generate',
    // 维修报修 - 只能提交报修
    'maintenance.view', 'maintenance.create',
  ],
  
  // 厨房人员 - 专注厨房管理
  'KITCHEN': [
    // 厨房管理 - 全部权限
    'kitchen.view', 'kitchen.create', 'kitchen.edit', 'kitchen.confirm', 'kitchen.procurement',
    // 学生 - 只能查看（了解过敏信息等）
    'student.view',
    // 维修报修 - 可以提交厨房设备报修
    'maintenance.view', 'maintenance.create',
  ],
  
  // 家长 - 最小权限，只能查看自己孩子的信息
  'PARENT': [
    // 学生 - 只能查看自己孩子的信息
    'student.view',
    // 家园共育 - 可查看通知、与老师沟通
    'communication.view', 'communication.chat',
    // 课程 - 可查看课程安排
    'curriculum.view',
    // 成长档案 - 可查看孩子的成长档案
    'growthArchive.view',
    // AI观察记录 - 可查看分享的观察记录
    'observation.view',
  ],
};

// 检查用户是否有某个权限
export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) || false;
};

// 检查用户是否有多个权限中的任意一个
export const hasAnyPermission = (role: UserRole, permissions: Permission[]): boolean => {
  return permissions.some(p => hasPermission(role, p));
};

// 检查用户是否有所有指定权限
export const hasAllPermissions = (role: UserRole, permissions: Permission[]): boolean => {
  return permissions.every(p => hasPermission(role, p));
};

// 获取用户的所有权限
export const getUserPermissions = (role: UserRole): Permission[] => {
  return ROLE_PERMISSIONS[role] || [];
};

// 获取角色的中文名称
export const getRoleName = (role: UserRole): string => {
  const names: Record<UserRole, string> = {
    'SUPER_ADMIN': '超级管理员',
    'ADMIN': '园区管理员',
    'TEACHER': '教师',
    'KITCHEN': '厨房人员',
    'PARENT': '家长',
  };
  return names[role] || role;
};

// 获取权限的中文描述
export const getPermissionDescription = (permission: Permission): string => {
  const descriptions: Record<Permission, string> = {
    'student.view': '查看学生信息',
    'student.create': '创建学生档案',
    'student.edit': '编辑学生信息',
    'student.delete': '删除学生档案',
    'student.attendance': '考勤管理',
    'student.health': '健康打卡',
    'student.pickup': '接送管理',
    'student.growth': '成长记录',
    'student.disease': '传染病登记',
    'student.disinfect': '消毒记录',
    'kitchen.view': '查看食谱',
    'kitchen.create': '创建食谱',
    'kitchen.edit': '编辑食谱',
    'kitchen.confirm': '确认食谱',
    'kitchen.procurement': '采购管理',
    'staff.view': '查看教职工',
    'staff.create': '添加教职工',
    'staff.edit': '编辑教职工',
    'staff.delete': '删除教职工',
    'staff.schedule': '排班管理',
    'staff.duty': '值班管理',
    'staff.meal': '陪餐管理',
    'staff.performance': '绩效管理',
    'safety.visitor': '来访登记',
    'safety.fire': '消防检查',
    'safety.patrol': '安防巡视',
    'safety.settings': '巡视点设置',
    'communication.view': '查看通知',
    'communication.create': '发布通知',
    'communication.chat': '私信聊天',
    'curriculum.view': '查看课程',
    'curriculum.edit': '编辑课程',
    'curriculum.album': 'AI相册',
    'curriculum.observation': '观察记录',
    'document.view': '查看资料',
    'document.upload': '上传资料',
    'document.delete': '删除资料',
    'document.permission': '权限设置',
    'system.view': '查看系统设置',
    'system.edit': '修改系统设置',
    'system.user': '用户管理',
    'system.campus': '园区管理',
    'dashboard.view': '查看数据大盘',
    'dashboard.export': '导出数据',
    'ai.use': '使用AI助手',
    // 新增功能权限描述
    'finance.view': '查看收费管理',
    'finance.calculate': '计算退费金额',
    'finance.approve': '审批退费',
    'finance.config': '配置退费规则',
    'observation.view': '查看观察记录',
    'observation.create': '创建观察记录',
    'observation.aiRefine': 'AI润色观察记录',
    'observation.share': '分享观察记录给家长',
    'growthArchive.view': '查看成长档案',
    'growthArchive.generate': '生成成长档案PDF',
    'maintenance.view': '查看维修报修',
    'maintenance.create': '提交报修申请',
    'maintenance.analyze': '维修数据分析',
    'maintenance.manage': '管理维修工单',
    'dataCockpit.view': '查看数据驾驶舱',
    'anomaly.view': '查看异常监控',
    'anomaly.resolve': '处理异常问题',
  };
  return descriptions[permission] || permission;
};

export default {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  getRoleName,
  getPermissionDescription,
};






