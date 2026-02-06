/**
 * 云端数据同步服务
 * 将小程序本地数据与阿里云 OSS 同步
 */

import Taro from '@tarojs/taro'
import {
  isAliyunConfigured,
  downloadStudents,
  downloadStaff,
  downloadHealthRecords,
  downloadAttendanceRecords,
  downloadMealPlans,
  downloadUsers,
  downloadAuthorizedPhones,
  checkAliyunHealth,
  initializeFromAliyun,
  getSyncStatus as getAliyunSyncStatus,
  uploadToAliyun,
  uploadAllToAliyun,
  syncWithAliyun,
} from './aliyunOssService'

/**
 * 同步状态接口
 */
export interface SyncStatus {
  lastSyncTime: string | null
  isOnline: boolean
  isSyncing: boolean
}

// 同步状态
let syncStatus: SyncStatus = {
  lastSyncTime: Taro.getStorageSync('kt_last_sync_time') || null,
  isOnline: true,
  isSyncing: false
}

/**
 * 获取同步状态
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus }
}

/**
 * 检查云端服务是否可用
 */
export async function checkCloudHealth(): Promise<{
  isHealthy: boolean
  latency?: number
  error?: string
}> {
  return await checkAliyunHealth()
}

/**
 * 从云端下载学生数据
 */
export async function downloadStudentsFromCloud(campus?: string): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadStudents()
  if (result.success && result.data && campus) {
    // 按园区过滤
    const filtered = result.data.filter((s: any) => s.campus === campus)
    return { success: true, data: filtered }
  }
  return result
}

/**
 * 从云端下载教职工数据
 */
export async function downloadStaffFromCloud(campus?: string): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadStaff()
  if (result.success && result.data && campus) {
    const filtered = result.data.filter((s: any) => s.campus === campus)
    return { success: true, data: filtered }
  }
  return result
}

/**
 * 从云端下载缴费记录（暂未实现上传，返回本地数据）
 */
export async function downloadPayments(campus?: string): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  // 缴费记录目前只在本地，暂不同步
  const localData = Taro.getStorageSync('kt_payments') || []
  return { success: true, data: localData }
}

/**
 * 从云端下载考勤记录
 */
export async function downloadAttendance(date: string, campus?: string): Promise<{
  success: boolean
  data?: Record<string, any>
  error?: string
}> {
  const result = await downloadAttendanceRecords()
  if (result.success && result.data) {
    // 按日期过滤
    const filtered = result.data.filter((r: any) => r.date === date)
    // 转换为按学生ID索引的对象
    const attendanceMap: Record<string, any> = {}
    filtered.forEach((record: any) => {
      if (campus && record.campus !== campus) return
      attendanceMap[record.studentId] = record
    })
    Taro.setStorageSync(`kt_attendance_${date}`, attendanceMap)
    return { success: true, data: attendanceMap }
  }
  return { success: false, error: result.error }
}

/**
 * 从云端下载健康记录
 */
export async function downloadHealthRecordsFromCloud(date: string, campus?: string): Promise<{
  success: boolean
  data?: Record<string, any>
  error?: string
}> {
  const result = await downloadHealthRecords()
  if (result.success && result.data) {
    // 按日期过滤
    const filtered = result.data.filter((r: any) => r.date === date)
    const healthMap: Record<string, any> = {}
    filtered.forEach((record: any) => {
      if (campus && record.campus !== campus) return
      healthMap[record.studentId] = record
    })
    Taro.setStorageSync(`kt_health_${date}`, healthMap)
    return { success: true, data: healthMap }
  }
  return { success: false, error: result.error }
}

/**
 * 从云端下载食谱数据
 */
export async function downloadMealPlansFromCloud(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  return await downloadMealPlans()
}

/**
 * 全量同步所有数据
 */
export async function syncAllData(
  campus?: string,
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{
  success: boolean
  results: Record<string, { success: boolean; count?: number; error?: string }>
}> {
  if (!isAliyunConfigured) {
    return { 
      success: false, 
      results: { error: { success: false, error: '阿里云 OSS 未配置' } } 
    }
  }

  syncStatus.isSyncing = true
  
  const result = await initializeFromAliyun(onProgress)
  
  // 转换结果格式
  const results: Record<string, { success: boolean; count?: number; error?: string }> = {}
  Object.entries(result.results).forEach(([key, value]) => {
    results[key] = {
      success: !value.error,
      count: value.count,
      error: value.error
    }
  })

  syncStatus.isSyncing = false
  syncStatus.lastSyncTime = new Date().toISOString()
  Taro.setStorageSync('kt_last_sync_time', syncStatus.lastSyncTime)

  return { success: result.success, results }
}

/**
 * 获取云端配置状态
 */
export function getCloudConfigStatus(): {
  isConfigured: boolean
  message: string
} {
  if (!isAliyunConfigured) {
    return {
      isConfigured: false,
      message: '阿里云 OSS 未配置'
    }
  }
  const status = getAliyunSyncStatus()
  return {
    isConfigured: true,
    message: `已连接 ${status.provider} (${status.region})`
  }
}

// ============ 上传功能 ============

/**
 * 更新学生数据（更新本地 + 同步到OSS）
 * 基础名单来自Excel，但编辑产生的变更（评价、备注等）需要跨设备同步
 * 带安全校验：数据量异常时拒绝上传
 */
export async function uploadStudent(student: any): Promise<{
  success: boolean
  error?: string
}> {
  // 更新本地存储（按ID去重）
  const students = Taro.getStorageSync('kt_students') || []
  const index = students.findIndex((s: any) => s.id === student.id)
  if (index >= 0) {
    students[index] = student
  } else {
    students.push(student)
  }
  Taro.setStorageSync('kt_students', students)
  
  // 安全校验后上传到OSS
  if (students.length > 300) {
    console.warn(`[CloudSync] 学生数据量异常(${students.length})，只保存本地`)
    return { success: true }
  }
  
  return await uploadToAliyun('kt_students', students)
}

/**
 * 上传考勤记录
 */
export async function uploadAttendance(date: string, studentId: string, record: any): Promise<{
  success: boolean
  error?: string
}> {
  // 更新本地
  const key = `kt_attendance_${date}`
  const attendance = Taro.getStorageSync(key) || {}
  attendance[studentId] = { ...record, date, studentId }
  Taro.setStorageSync(key, attendance)
  
  // 合并到总考勤记录
  const allAttendance = Taro.getStorageSync('kt_attendance_records') || []
  const existingIndex = allAttendance.findIndex((a: any) => a.date === date && a.studentId === studentId)
  if (existingIndex >= 0) {
    allAttendance[existingIndex] = attendance[studentId]
  } else {
    allAttendance.push(attendance[studentId])
  }
  Taro.setStorageSync('kt_attendance_records', allAttendance)
  
  // 上传到云端
  return await uploadToAliyun('kt_attendance_records', allAttendance)
}

/**
 * 上传健康记录
 */
export async function uploadHealthRecord(date: string, studentId: string, record: any): Promise<{
  success: boolean
  error?: string
}> {
  // 更新本地
  const key = `kt_health_${date}`
  const health = Taro.getStorageSync(key) || {}
  health[studentId] = { ...record, date, studentId }
  Taro.setStorageSync(key, health)
  
  // 合并到总健康记录
  const allHealth = Taro.getStorageSync('kt_health_records') || []
  const existingIndex = allHealth.findIndex((h: any) => h.date === date && h.studentId === studentId)
  if (existingIndex >= 0) {
    allHealth[existingIndex] = health[studentId]
  } else {
    allHealth.push(health[studentId])
  }
  Taro.setStorageSync('kt_health_records', allHealth)
  
  // 上传到云端
  return await uploadToAliyun('kt_health_records', allHealth)
}

/**
 * 上传接送记录
 */
export async function uploadPickupRecord(record: any): Promise<{
  success: boolean
  error?: string
}> {
  const records = Taro.getStorageSync('kt_pickup_records') || []
  const index = records.findIndex((r: any) => r.id === record.id)
  if (index >= 0) {
    records[index] = record
  } else {
    records.push(record)
  }
  Taro.setStorageSync('kt_pickup_records', records)
  
  return await uploadToAliyun('kt_pickup_records', records)
}

/**
 * 上传疾病记录
 */
export async function uploadDiseaseRecord(record: any): Promise<{
  success: boolean
  error?: string
}> {
  const records = Taro.getStorageSync('kt_disease_records') || []
  const index = records.findIndex((r: any) => r.id === record.id)
  if (index >= 0) {
    records[index] = record
  } else {
    records.push(record)
  }
  Taro.setStorageSync('kt_disease_records', records)
  
  return await uploadToAliyun('kt_disease_records', records)
}

/**
 * 上传消毒记录
 */
export async function uploadDisinfectRecord(record: any): Promise<{
  success: boolean
  error?: string
}> {
  const records = Taro.getStorageSync('kt_disinfection_records') || []
  const index = records.findIndex((r: any) => r.id === record.id)
  if (index >= 0) {
    records[index] = record
  } else {
    records.push(record)
  }
  Taro.setStorageSync('kt_disinfection_records', records)
  
  return await uploadToAliyun('kt_disinfection_records', records)
}

/**
 * 上传评价记录
 */
export async function uploadEvaluation(evaluation: any): Promise<{
  success: boolean
  error?: string
}> {
  const records = Taro.getStorageSync('kt_student_evaluations') || []
  const index = records.findIndex((r: any) => r.id === evaluation.id)
  if (index >= 0) {
    records[index] = evaluation
  } else {
    records.push(evaluation)
  }
  Taro.setStorageSync('kt_student_evaluations', records)
  
  return await uploadToAliyun('kt_student_evaluations', records)
}

/**
 * 上传观察记录
 */
export async function uploadObservation(observation: any): Promise<{
  success: boolean
  error?: string
}> {
  const records = Taro.getStorageSync('kt_observations') || []
  const index = records.findIndex((r: any) => r.id === observation.id)
  if (index >= 0) {
    records[index] = observation
  } else {
    records.unshift(observation) // 新记录放在最前面
  }
  Taro.setStorageSync('kt_observations', records)
  
  return await uploadToAliyun('kt_observations', records)
}

/**
 * 删除观察记录并同步
 */
export async function deleteObservationAndSync(id: string): Promise<{
  success: boolean
  error?: string
}> {
  const records = Taro.getStorageSync('kt_observations') || []
  const updated = records.filter((r: any) => r.id !== id)
  Taro.setStorageSync('kt_observations', updated)
  
  return await uploadToAliyun('kt_observations', updated, true) // 强制上传
}

/**
 * 双向同步所有数据
 */
export async function fullSync(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{
  success: boolean
  downloaded: number
  uploaded: number
  error?: string
}> {
  return await syncWithAliyun(onProgress)
}

/**
 * 仅上传所有本地数据
 */
export async function uploadAllData(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{
  success: boolean
  results: Record<string, { count: number; error?: string }>
}> {
  return await uploadAllToAliyun(onProgress)
}

export { isAliyunConfigured as isSupabaseConfigured }
