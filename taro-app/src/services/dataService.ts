/**
 * 统一数据服务 - 小程序版
 * 自动同步本地存储与 Supabase 云端
 */

import Taro from '@tarojs/taro'
import { supabase, isSupabaseConfigured } from './supabaseClient'

// 存储键定义
export const STORAGE_KEYS = {
  STUDENTS: 'kt_students',
  STAFF: 'kt_staff',
  AUTHORIZED_PHONES: 'kt_authorized_phones',
  ALL_USERS: 'kt_all_users',
  PAYMENTS: 'kt_payments',
  KITCHEN_HISTORY: 'kt_kitchen_history_v2',
}

// 表映射
const TABLE_MAP: Record<string, string> = {
  [STORAGE_KEYS.STUDENTS]: 'students',
  [STORAGE_KEYS.STAFF]: 'staff',
  [STORAGE_KEYS.AUTHORIZED_PHONES]: 'authorized_phones',
  [STORAGE_KEYS.ALL_USERS]: 'users',
  [STORAGE_KEYS.PAYMENTS]: 'fee_payments',
  [STORAGE_KEYS.KITCHEN_HISTORY]: 'meal_plans',
}

// camelCase 转 snake_case
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase)
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
      acc[snakeKey] = toSnakeCase(obj[key])
      return acc
    }, {} as any)
  }
  return obj
}

// snake_case 转 camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      acc[camelKey] = toCamelCase(obj[key])
      return acc
    }, {} as any)
  }
  return obj
}

// 同步状态
let lastSyncTime: string | null = Taro.getStorageSync('kt_last_sync_time') || null
let isSyncing = false

/**
 * 获取同步状态
 */
export function getSyncStatus() {
  return {
    lastSyncTime,
    isSyncing,
    isCloudConfigured: isSupabaseConfigured
  }
}

/**
 * 从云端加载数据（优先）+ 本地缓存
 */
export async function loadData<T>(storageKey: string, options?: {
  campus?: string
  forceCloud?: boolean
}): Promise<T[]> {
  const tableName = TABLE_MAP[storageKey]
  
  // 如果云端已配置且需要从云端加载
  if (isSupabaseConfigured && tableName) {
    try {
      const queryOptions: any = {}
      if (options?.campus) {
        queryOptions.eq = { campus: options.campus }
      }
      
      const { data, error } = await supabase.select(tableName, queryOptions)
      
      if (!error && data) {
        const camelData = toCamelCase(data) as T[]
        // 更新本地缓存
        Taro.setStorageSync(storageKey, camelData)
        return camelData
      }
    } catch (err) {
      console.warn('云端加载失败，使用本地缓存:', err)
    }
  }
  
  // 从本地加载
  return Taro.getStorageSync(storageKey) || []
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
    const existing: T[] = Taro.getStorageSync(storageKey) || []
    const index = existing.findIndex(i => i.id === item.id)
    
    if (index >= 0) {
      existing[index] = item
    } else {
      existing.push(item)
    }
    
    Taro.setStorageSync(storageKey, existing)
    
    // 2. 同步到云端
    if (!options?.skipCloud && isSupabaseConfigured) {
      const tableName = TABLE_MAP[storageKey]
      if (tableName) {
        const snakeData = toSnakeCase({
          ...item,
          updated_at: new Date().toISOString()
        })
        
        const { error } = await supabase.upsert(tableName, snakeData, 'id')
        
        if (error) {
          console.error('云端同步失败:', error)
          return { success: true, error: '已保存到本地，云端同步失败' }
        }
      }
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
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
    const existing: T[] = Taro.getStorageSync(storageKey) || []
    const filtered = existing.filter(i => i.id !== itemId)
    Taro.setStorageSync(storageKey, filtered)
    
    // 2. 从云端删除
    if (isSupabaseConfigured) {
      const tableName = TABLE_MAP[storageKey]
      if (tableName) {
        const { error } = await supabase.delete(tableName, { id: itemId })
        
        if (error) {
          console.error('云端删除失败:', error)
        }
      }
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
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
    Taro.setStorageSync(storageKey, items)
    
    // 2. 同步到云端
    if (isSupabaseConfigured && items.length > 0) {
      const tableName = TABLE_MAP[storageKey]
      if (tableName) {
        const snakeData = items.map(item => toSnakeCase({
          ...item,
          updated_at: new Date().toISOString()
        }))
        
        const { error } = await supabase.upsert(tableName, snakeData, 'id')
        
        if (error) {
          console.error('批量云端同步失败:', error)
          return { success: true, error: '已保存到本地，云端同步失败' }
        }
      }
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * 一键将所有本地数据上传到云端
 */
export async function uploadAllToCloud(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{ success: boolean; results: Record<string, { count: number; error?: string }> }> {
  if (!isSupabaseConfigured) {
    return { success: false, results: { error: { count: 0, error: '云端服务未配置' } } }
  }
  
  const results: Record<string, { count: number; error?: string }> = {}
  const keys = Object.entries(TABLE_MAP)
  
  for (let i = 0; i < keys.length; i++) {
    const [storageKey, tableName] = keys[i]
    onProgress?.(i + 1, keys.length, storageKey)
    
    try {
      const localData: any[] = Taro.getStorageSync(storageKey) || []
      
      if (localData.length > 0) {
        const snakeData = localData.map(item => toSnakeCase({
          ...item,
          updated_at: new Date().toISOString()
        }))
        
        const { error } = await supabase.upsert(tableName, snakeData, 'id')
        
        results[storageKey] = {
          count: localData.length,
          error: error?.message
        }
      } else {
        results[storageKey] = { count: 0 }
      }
    } catch (err: any) {
      results[storageKey] = { count: 0, error: err.message }
    }
  }
  
  lastSyncTime = new Date().toISOString()
  Taro.setStorageSync('kt_last_sync_time', lastSyncTime)
  
  const allSuccess = Object.values(results).every(r => !r.error)
  return { success: allSuccess, results }
}

/**
 * 从云端下载所有数据到本地
 */
export async function downloadAllFromCloud(
  campus?: string,
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{ success: boolean; results: Record<string, { count: number; error?: string }> }> {
  if (!isSupabaseConfigured) {
    return { success: false, results: { error: { count: 0, error: '云端服务未配置' } } }
  }
  
  const results: Record<string, { count: number; error?: string }> = {}
  const keys = Object.entries(TABLE_MAP)
  
  for (let i = 0; i < keys.length; i++) {
    const [storageKey, tableName] = keys[i]
    onProgress?.(i + 1, keys.length, storageKey)
    
    try {
      const queryOptions: any = {}
      if (campus && ['students', 'staff', 'fee_payments'].includes(tableName)) {
        queryOptions.eq = { campus }
      }
      
      const { data, error } = await supabase.select(tableName, queryOptions)
      
      if (error) {
        results[storageKey] = { count: 0, error: error.message }
      } else {
        const camelData = toCamelCase(data || [])
        Taro.setStorageSync(storageKey, camelData)
        results[storageKey] = { count: camelData.length }
      }
    } catch (err: any) {
      results[storageKey] = { count: 0, error: err.message }
    }
  }
  
  lastSyncTime = new Date().toISOString()
  Taro.setStorageSync('kt_last_sync_time', lastSyncTime)
  
  const allSuccess = Object.values(results).every(r => !r.error)
  return { success: allSuccess, results }
}

/**
 * 考勤数据专用 - 保存
 */
export async function saveAttendanceData(
  date: string,
  studentId: string,
  record: any
): Promise<{ success: boolean; error?: string }> {
  const storageKey = `kt_attendance_${date}`
  
  // 1. 本地保存
  const existing = Taro.getStorageSync(storageKey) || {}
  existing[studentId] = record
  Taro.setStorageSync(storageKey, existing)
  
  // 2. 云端同步
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.upsert('attendance_records', {
        id: `${date}_${studentId}`,
        date,
        student_id: studentId,
        ...toSnakeCase(record),
        updated_at: new Date().toISOString()
      }, 'id')
      
      if (error) {
        console.error('考勤云端同步失败:', error)
      }
    } catch (err) {
      console.error('考勤同步异常:', err)
    }
  }
  
  return { success: true }
}

/**
 * 考勤数据专用 - 加载
 */
export async function loadAttendanceData(
  date: string,
  campus?: string
): Promise<Record<string, any>> {
  const storageKey = `kt_attendance_${date}`
  
  // 尝试从云端加载
  if (isSupabaseConfigured) {
    try {
      const queryOptions: any = {
        eq: { date }
      }
      if (campus) {
        queryOptions.eq.campus = campus
      }
      
      const { data, error } = await supabase.select('attendance_records', queryOptions)
      
      if (!error && data) {
        const result: Record<string, any> = {}
        data.forEach((record: any) => {
          const camelRecord = toCamelCase(record)
          result[camelRecord.studentId] = camelRecord
        })
        Taro.setStorageSync(storageKey, result)
        return result
      }
    } catch (err) {
      console.warn('考勤云端加载失败:', err)
    }
  }
  
  // 从本地加载
  return Taro.getStorageSync(storageKey) || {}
}

export { isSupabaseConfigured }
