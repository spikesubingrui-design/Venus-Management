/**
 * 权限管理服务
 * 实现班级权限控制：老师只能看到自己负责的班级学生
 */

import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from './aliyunOssService'

// 用户角色
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'KITCHEN' | 'PARENT' | 'GUARD'

// 管理员角色列表（可以管理所有班级）
export const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN']

// 所有可用班级（与学生模板Excel一致）
export const ALL_CLASSES = [
  '悦芽一班',                          // 托班
  '花开小一', '花开小二', '花开小三',  // 小班
  '书田中一', '书田中二',              // 中班
  '星语大一', '星语大二'               // 大班
]

// 用户信息接口
export interface UserInfo {
  id: string
  phone: string
  name: string
  role: string
  campus?: string
  assignedClasses?: string[]  // 分配的班级列表
}

// 学生信息接口（用于权限过滤）
export interface StudentBase {
  id: string
  name: string
  class: string
}

/**
 * 获取当前登录用户（自动从教职工名单刷新权限信息）
 * 每次调用都会检查 kt_staff 中的最新班级分配，确保管理员修改权限后立即生效
 */
export const getCurrentUser = (): UserInfo | null => {
  try {
    const user = Taro.getStorageSync('kt_current_user')
    if (!user) return null
    
    // 从最新的教职工名单刷新权限（管理员分配班级后，无需重新登录即可生效）
    const staffList = Taro.getStorageSync('kt_staff') || []
    const staffInfo = staffList.find((s: any) => s.phone === user.phone)
    
    if (staffInfo) {
      const needsUpdate = 
        JSON.stringify(user.assignedClasses || []) !== JSON.stringify(staffInfo.assignedClasses || []) ||
        user.role !== staffInfo.role ||
        user.name !== staffInfo.name
      
      if (needsUpdate) {
        const updatedUser = {
          ...user,
          name: staffInfo.name || user.name,
          role: staffInfo.role || user.role,
          assignedClasses: staffInfo.assignedClasses || user.assignedClasses || [],
        }
        Taro.setStorageSync('kt_current_user', updatedUser)
        console.log('[Permission] 用户权限已自动更新:', updatedUser.assignedClasses)
        return updatedUser
      }
    }
    
    return user
  } catch {
    return null
  }
}

/**
 * 检查是否是管理员角色
 */
export const isAdmin = (user?: UserInfo | null): boolean => {
  const currentUser = user || getCurrentUser()
  if (!currentUser) return false
  
  const role = currentUser.role?.toUpperCase() as UserRole
  return ADMIN_ROLES.includes(role) || 
         role === '园长' || 
         role === '副园长' ||
         currentUser.role === '园长' ||
         currentUser.role === '副园长'
}

/**
 * 检查是否是超级管理员
 */
export const isSuperAdmin = (user?: UserInfo | null): boolean => {
  const currentUser = user || getCurrentUser()
  if (!currentUser) return false
  return currentUser.role?.toUpperCase() === 'SUPER_ADMIN'
}

/**
 * 获取用户可访问的班级列表
 * 管理员可以访问所有班级，普通教师只能访问分配的班级
 */
export const getAccessibleClasses = (user?: UserInfo | null): string[] => {
  const currentUser = user || getCurrentUser()
  if (!currentUser) return []
  
  // 管理员可以访问所有班级
  if (isAdmin(currentUser)) {
    return ALL_CLASSES
  }
  
  // 普通用户只能访问分配的班级
  return currentUser.assignedClasses || []
}

/**
 * 检查用户是否有权限访问某个班级
 */
export const canAccessClass = (className: string, user?: UserInfo | null): boolean => {
  const accessibleClasses = getAccessibleClasses(user)
  return accessibleClasses.includes(className)
}

/**
 * 根据权限过滤学生列表
 */
export const filterStudentsByPermission = <T extends StudentBase>(
  students: T[], 
  user?: UserInfo | null
): T[] => {
  const currentUser = user || getCurrentUser()
  if (!currentUser) return []
  
  // 管理员可以看到所有学生
  if (isAdmin(currentUser)) {
    return students
  }
  
  // 厨房人员可以看到所有学生（需要为所有人准备食物）
  if (currentUser.role?.toUpperCase() === 'KITCHEN') {
    return students
  }
  
  // 普通教师只能看到自己班级的学生
  const accessibleClasses = getAccessibleClasses(currentUser)
  if (accessibleClasses.length === 0) {
    console.warn('[Permission] 该用户没有分配任何班级')
    return []
  }
  
  return students.filter(student => {
    const studentClass = (student as any).class || (student as any).className || ''
    return accessibleClasses.includes(studentClass)
  })
}

/**
 * 为用户分配班级（仅管理员可操作）
 */
export const assignClassesToUser = async (
  targetUserId: string, 
  classes: string[]
): Promise<{ success: boolean; message: string }> => {
  const currentUser = getCurrentUser()
  
  // 检查操作权限
  if (!isAdmin(currentUser)) {
    return { success: false, message: '无权限执行此操作' }
  }
  
  try {
    // 更新用户列表
    const users: UserInfo[] = Taro.getStorageSync('kt_all_users') || []
    const userIndex = users.findIndex(u => u.id === targetUserId)
    
    if (userIndex === -1) {
      return { success: false, message: '用户不存在' }
    }
    
    users[userIndex].assignedClasses = classes
    Taro.setStorageSync('kt_all_users', users)
    
    // 同时更新教职工列表
    const staff = Taro.getStorageSync(STORAGE_KEYS.STAFF) || []
    const staffIndex = staff.findIndex((s: any) => s.phone === users[userIndex].phone)
    if (staffIndex !== -1) {
      staff[staffIndex].assignedClasses = classes
      Taro.setStorageSync(STORAGE_KEYS.STAFF, staff)
    }
    
    return { success: true, message: '班级分配成功' }
  } catch (err) {
    console.error('[Permission] 分配班级失败:', err)
    return { success: false, message: '分配失败' }
  }
}

/**
 * 获取某个班级的所有教师
 */
export const getTeachersForClass = (className: string): UserInfo[] => {
  try {
    const staff = Taro.getStorageSync(STORAGE_KEYS.STAFF) || []
    return staff.filter((s: any) => {
      // 兼容旧数据结构（单个 class 字段）
      if (s.class === className) return true
      // 新数据结构（assignedClasses 数组）
      if (s.assignedClasses?.includes(className)) return true
      return false
    })
  } catch {
    return []
  }
}

/**
 * 获取权限提示信息
 */
export const getPermissionHint = (user?: UserInfo | null): string => {
  const currentUser = user || getCurrentUser()
  if (!currentUser) return '请先登录'
  
  if (isAdmin(currentUser)) {
    return '管理员：可查看所有班级'
  }
  
  // 厨房人员可以查看所有学生
  if (currentUser.role?.toUpperCase() === 'KITCHEN') {
    return '厨房：可查看全园用餐数据'
  }
  
  const classes = getAccessibleClasses(currentUser)
  if (classes.length === 0) {
    return '暂未分配班级，请联系管理员'
  }
  
  return `负责班级：${classes.join('、')}`
}

/**
 * 检查用户是否有完整权限（可以编辑数据）
 */
export const hasEditPermission = (className?: string, user?: UserInfo | null): boolean => {
  const currentUser = user || getCurrentUser()
  if (!currentUser) return false
  
  // 管理员有所有编辑权限
  if (isAdmin(currentUser)) return true
  
  // 如果指定了班级，检查是否是负责的班级
  if (className) {
    return canAccessClass(className, currentUser)
  }
  
  // 有分配班级的教师有编辑权限
  return (currentUser.assignedClasses?.length || 0) > 0
}

export default {
  getCurrentUser,
  isAdmin,
  isSuperAdmin,
  getAccessibleClasses,
  canAccessClass,
  filterStudentsByPermission,
  assignClassesToUser,
  getTeachersForClass,
  getPermissionHint,
  hasEditPermission,
  ALL_CLASSES,
  ADMIN_ROLES
}
