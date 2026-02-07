/**
 * 阿里云 OSS 存储服务（小程序版）
 * 支持读取和上传数据到 OSS
 */

import Taro from '@tarojs/taro'
import CryptoJS from 'crypto-js'

// 阿里云 OSS 配置
const OSS_CONFIG = {
  region: 'oss-cn-beijing',
  bucket: 'venus-data',
  accessKeyId: 'LTAI5t8bGTe6ZJAuKSQXi3Di',
  accessKeySecret: 'eu2urgQIcJ6eK0s87UkZLEbgk1qacj',
  // OSS 公开访问地址
  endpoint: 'https://venus-data.oss-cn-beijing.aliyuncs.com',
}

// 数据文件路径前缀
const DATA_PREFIX = 'jinxing-edu'

// 存储键名常量（与网页端保持一致）
export const STORAGE_KEYS = {
  ALL_USERS: 'kt_all_users',
  AUTHORIZED_PHONES: 'kt_authorized_phones',
  STUDENTS: 'kt_students',
  STAFF: 'kt_staff',
  HEALTH_RECORDS: 'kt_health_records',
  ATTENDANCE_RECORDS: 'kt_attendance_records',
  MEAL_PLANS: 'kt_meal_plans',
  ANNOUNCEMENTS: 'kt_announcements',
  PICKUP_RECORDS: 'kt_pickup_records',
  DISEASE_RECORDS: 'kt_disease_records',
  DISINFECTION_RECORDS: 'kt_disinfection_records',
  EVALUATIONS: 'kt_student_evaluations',
}

// 检查 OSS 是否已配置
export const isAliyunConfigured = 
  OSS_CONFIG.bucket !== '' && 
  OSS_CONFIG.endpoint !== '' &&
  OSS_CONFIG.accessKeyId !== '' &&
  OSS_CONFIG.accessKeySecret !== ''

/**
 * 获取文件的完整URL
 */
function getFileUrl(storageKey: string): string {
  return `${OSS_CONFIG.endpoint}/${DATA_PREFIX}/${storageKey}.json`
}

// 分批上传/下载已废弃，所有数据统一使用单文件模式 {storageKey}.json

/**
 * 生成签名URL用于GET请求
 * 注意：签名字符串格式为 HTTP-Verb + "\n" + Content-MD5 + "\n" + Content-Type + "\n" + Expires + "\n" + CanonicalizedOSSHeaders + CanonicalizedResource
 * 小程序会自动添加 Content-Type: application/json，所以签名时必须包含它
 */
function generateSignedUrl(ossPath: string, contentType: string = ''): string {
  const expires = Math.floor(Date.now() / 1000) + 3600 // 1小时后过期
  // 签名字符串：如果请求带Content-Type，签名也必须包含
  const stringToSign = `GET\n\n${contentType}\n${expires}\n/${OSS_CONFIG.bucket}/${ossPath}`
  const signature = CryptoJS.HmacSHA1(stringToSign, OSS_CONFIG.accessKeySecret)
  const encodedSignature = encodeURIComponent(CryptoJS.enc.Base64.stringify(signature))
  
  return `${OSS_CONFIG.endpoint}/${ossPath}?OSSAccessKeyId=${OSS_CONFIG.accessKeyId}&Expires=${expires}&Signature=${encodedSignature}`
}

/**
 * 尝试请求URL（先尝试公开URL，失败则用签名URL）
 * 重要：小程序会自动添加 Content-Type: application/json，签名必须匹配
 */
async function tryRequest(ossPath: string): Promise<{ statusCode: number; data: any } | null> {
  // 先尝试公开URL（更快，不需要签名计算）
  const publicUrl = `${OSS_CONFIG.endpoint}/${ossPath}`
  
  try {
    console.log(`[AliyunOSS] 尝试公开URL: ${publicUrl}`)
    const res = await Taro.request({
      url: publicUrl,
      method: 'GET',
      timeout: 10000,
      // 使用 text 类型避免 Content-Type 问题
      responseType: 'text',
    })
    
    if (res.statusCode === 200) {
      console.log(`[AliyunOSS] ✅ 公开URL成功`)
      // 手动解析 JSON
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      return { statusCode: res.statusCode, data }
    }
  } catch (e: any) {
    console.log(`[AliyunOSS] 公开URL失败: ${e.message}，尝试签名URL`)
  }
  
  // 公开URL失败，尝试带 application/json Content-Type 的签名URL
  const signedUrl = generateSignedUrl(ossPath, 'application/json')
  try {
    console.log(`[AliyunOSS] 尝试签名URL (带Content-Type)`)
    const res = await Taro.request({
      url: signedUrl,
      method: 'GET',
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
      },
    })
    return res
  } catch (e: any) {
    console.log(`[AliyunOSS] 签名URL失败: ${e.message}，尝试不带Content-Type`)
  }
  
  // 最后尝试不带 Content-Type 的签名URL
  const signedUrlNoType = generateSignedUrl(ossPath, '')
  try {
    console.log(`[AliyunOSS] 尝试签名URL (无Content-Type)`)
    const res = await Taro.request({
      url: signedUrlNoType,
      method: 'GET',
      timeout: 15000,
      responseType: 'text',
    })
    if (res.statusCode === 200) {
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      return { statusCode: res.statusCode, data }
    }
    return res
  } catch (e: any) {
    console.log(`[AliyunOSS] 所有签名方式都失败: ${e.message}`)
    return null
  }
}

/**
 * 从阿里云 OSS 下载数据
 */
/**
 * 从阿里云 OSS 下载数据（仅单文件模式，不再支持分批）
 * 分批模式已废弃，所有数据统一使用 {storageKey}.json 单文件
 */
export async function downloadFromAliyun<T>(storageKey: string): Promise<{
  success: boolean
  data?: T[]
  error?: string
}> {
  if (!isAliyunConfigured) {
    return { success: false, error: '阿里云 OSS 未配置' }
  }

  try {
    const filePath = `${DATA_PREFIX}/${storageKey}.json`
    
    console.log(`[AliyunOSS] 下载: ${storageKey}.json`)
    const res = await tryRequest(filePath)
    
    if (!res) {
      console.error(`[AliyunOSS] 请求失败: ${storageKey}`)
      return { success: false, error: '网络请求失败' }
    }
    
    if (res.statusCode === 200) {
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      console.log(`[AliyunOSS] 下载成功: ${storageKey} (${Array.isArray(data) ? data.length : 1}条)`)
      return { success: true, data: Array.isArray(data) ? data : [data] }
    } else if (res.statusCode === 404) {
      console.log(`[AliyunOSS] 文件不存在: ${storageKey}`)
      return { success: true, data: [] }
    } else if (res.statusCode === 403) {
      console.error(`[AliyunOSS] 权限错误: ${storageKey}`)
      return { success: false, error: '权限错误(403)' }
    } else {
      console.error(`[AliyunOSS] 下载失败: HTTP ${res.statusCode}`)
      return { success: false, error: `HTTP ${res.statusCode}` }
    }
  } catch (err: any) {
    console.error(`[AliyunOSS] 请求异常:`, err.message || err)
    return { success: false, error: err.message || '下载失败' }
  }
}

/**
 * 从阿里云下载学生数据（带数据保护）
 */
export async function downloadStudents(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadFromAliyun<any>('kt_students')
  if (result.success && result.data) {
    // 数据保护：只有下载到有效数据才保存
    if (result.data.length > 0) {
      Taro.setStorageSync('kt_students', result.data)
      console.log(`[AliyunOSS] ✅ 学生数据已保存: ${result.data.length}条`)
    } else {
      // 下载到空数据，保留本地数据
      const localData = Taro.getStorageSync('kt_students') || []
      if (localData.length > 0) {
        console.warn(`[AliyunOSS] ⚠️ 云端学生数据为空，保留本地数据(${localData.length}条)`)
        result.data = localData
      }
    }
  }
  return result
}

/**
 * 从阿里云下载教职工数据（带数据保护）
 */
export async function downloadStaff(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadFromAliyun<any>('kt_staff')
  if (result.success && result.data) {
    // 数据保护：只有下载到有效数据才保存
    if (result.data.length > 0) {
      Taro.setStorageSync('kt_staff', result.data)
      console.log(`[AliyunOSS] ✅ 教职工数据已保存: ${result.data.length}条`)
    } else {
      const localData = Taro.getStorageSync('kt_staff') || []
      if (localData.length > 0) {
        console.warn(`[AliyunOSS] ⚠️ 云端教职工数据为空，保留本地数据(${localData.length}条)`)
        result.data = localData
      }
    }
  }
  return result
}

/**
 * 从阿里云下载健康记录
 */
export async function downloadHealthRecords(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadFromAliyun<any>('kt_health_records')
  if (result.success && result.data) {
    Taro.setStorageSync('kt_health_records', result.data)
  }
  return result
}

/**
 * 从阿里云下载考勤记录
 */
export async function downloadAttendanceRecords(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadFromAliyun<any>('kt_attendance_records')
  if (result.success && result.data) {
    Taro.setStorageSync('kt_attendance_records', result.data)
  }
  return result
}

/**
 * 从阿里云下载食谱数据
 */
export async function downloadMealPlans(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadFromAliyun<any>('kt_meal_plans')
  if (result.success && result.data) {
    // 保存到正确的键名
    Taro.setStorageSync('kt_meal_plans', result.data)
    // 同时保存到旧键名以兼容
    Taro.setStorageSync('kt_kitchen_history_v2', result.data)
  }
  return result
}

/**
 * 从阿里云下载用户数据
 */
export async function downloadUsers(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadFromAliyun<any>('kt_all_users')
  if (result.success && result.data) {
    Taro.setStorageSync('kt_all_users', result.data)
  }
  return result
}

/**
 * 从阿里云下载授权手机号
 */
export async function downloadAuthorizedPhones(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const result = await downloadFromAliyun<any>('kt_authorized_phones')
  if (result.success && result.data) {
    Taro.setStorageSync('kt_authorized_phones', result.data)
  }
  return result
}

/**
 * 检查阿里云连接状态
 */
export async function checkAliyunHealth(): Promise<{
  isHealthy: boolean
  latency?: number
  error?: string
}> {
  if (!isAliyunConfigured) {
    return { isHealthy: false, error: '未配置' }
  }

  const startTime = Date.now()

  try {
    // 尝试获取一个小文件来测试连接
    const testPath = `${DATA_PREFIX}/kt_authorized_phones.json`
    const publicUrl = `${OSS_CONFIG.endpoint}/${testPath}`
    
    console.log('[AliyunOSS] 测试连接:', publicUrl)
    const res = await Taro.request({
      url: publicUrl,
      method: 'GET',
      timeout: 10000,
      responseType: 'text',
    })
    
    const latency = Date.now() - startTime
    console.log(`[AliyunOSS] 连接测试结果: HTTP ${res.statusCode}, 延迟 ${latency}ms`)
    
    if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 403) {
      // 200=成功, 404=文件不存在但OSS可用, 403=权限问题但网络通
      return { isHealthy: true, latency }
    }
    return { isHealthy: false, error: `HTTP ${res.statusCode}` }
  } catch (err: any) {
    console.error('[AliyunOSS] 连接测试失败:', err.message)
    return { isHealthy: false, error: err.message || '连接失败' }
  }
}

/**
 * 从阿里云初始化所有数据
 */
export async function initializeFromAliyun(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{
  success: boolean
  results: Record<string, { count: number; error?: string }>
}> {
  if (!isAliyunConfigured) {
    return { success: false, results: {} }
  }

  console.log('[AliyunOSS] 🚀 开始从阿里云初始化数据...')

  const tasks = [
    { key: 'kt_all_users', fn: downloadUsers, label: '用户数据' },
    { key: 'kt_authorized_phones', fn: downloadAuthorizedPhones, label: '授权手机' },
    { key: 'kt_students', fn: downloadStudents, label: '学生数据' },
    { key: 'kt_staff', fn: downloadStaff, label: '教职工' },
    { key: 'kt_health_records', fn: downloadHealthRecords, label: '健康记录' },
    { key: 'kt_attendance_records', fn: downloadAttendanceRecords, label: '考勤记录' },
    { key: 'kt_meal_plans', fn: downloadMealPlans, label: '食谱数据' },
  ]

  const results: Record<string, { count: number; error?: string }> = {}
  let hasError = false

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    onProgress?.(i + 1, tasks.length, task.label)

    try {
      // 检查本地是否已有数据
      const localData = Taro.getStorageSync(task.key) || []
      
      if (localData.length > 0) {
        console.log(`[AliyunOSS] ✅ ${task.label}: 使用本地数据 (${localData.length}条)`)
        results[task.key] = { count: localData.length }
      } else {
        // 本地无数据，从云端下载
        const result = await task.fn()
        if (result.success) {
          results[task.key] = { count: result.data?.length || 0 }
          console.log(`[AliyunOSS] 📥 ${task.label}: 下载 ${result.data?.length || 0} 条`)
        } else {
          results[task.key] = { count: 0, error: result.error }
          hasError = true
        }
      }
    } catch (err: any) {
      results[task.key] = { count: 0, error: err.message }
      hasError = true
    }

    // 添加小延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  Taro.setStorageSync('kt_last_sync_time', new Date().toISOString())
  console.log('[AliyunOSS] ✅ 初始化完成')

  return { success: !hasError, results }
}

/**
 * 获取同步状态
 */
export function getSyncStatus() {
  return {
    enabled: isAliyunConfigured,
    provider: '阿里云 OSS',
    region: OSS_CONFIG.region,
    bucket: OSS_CONFIG.bucket,
    lastSyncTime: Taro.getStorageSync('kt_last_sync_time') || null,
  }
}

// ============ 上传功能 ============

/**
 * 生成 OSS 签名
 */
function generateSignature(
  method: string,
  contentType: string,
  date: string,
  ossPath: string
): string {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_CONFIG.bucket}/${ossPath}`
  const signature = CryptoJS.HmacSHA1(stringToSign, OSS_CONFIG.accessKeySecret)
  return CryptoJS.enc.Base64.stringify(signature)
}

// ============ 数据保护配置 ============

// 核心数据键（这些数据不允许被空数据覆盖）
const PROTECTED_KEYS = [
  'kt_students',
  'kt_staff',
  'kt_authorized_phones',
  'kt_all_users',
]

// 核心数据的最小记录数（低于此数量拒绝上传，防止少量数据覆盖云端完整数据）
const MIN_RECORDS_FOR_UPLOAD: Record<string, number> = {
  'kt_students': 10,     // 学生数据至少10条（实际116条）
  'kt_staff': 20,        // 教职工至少20条（实际38条）- 防止单设备登录后覆盖
}

/**
 * 上传数据到阿里云 OSS（带数据保护）
 */
export async function uploadToAliyun(storageKey: string, data: any[], forceUpload: boolean = false): Promise<{
  success: boolean
  error?: string
}> {
  if (!isAliyunConfigured) {
    return { success: false, error: '阿里云 OSS 未配置' }
  }

  // 数据保护：检查核心数据是否为空
  const minRecords = MIN_RECORDS_FOR_UPLOAD[storageKey] || 0
  if (!forceUpload && PROTECTED_KEYS.includes(storageKey)) {
    if (!data || data.length < minRecords) {
      const msg = `⚠️ 数据保护: ${storageKey} 数据为空或不足(${data?.length || 0}条)，拒绝上传以防止覆盖云端数据`
      console.warn(`[AliyunOSS] ${msg}`)
      return { success: false, error: msg }
    }
  }

  try {
    const ossPath = `${DATA_PREFIX}/${storageKey}.json`
    const url = `${OSS_CONFIG.endpoint}/${DATA_PREFIX}/${storageKey}.json`
    const content = JSON.stringify(data, null, 2)
    const contentType = 'application/json'
    const date = new Date().toUTCString()
    
    const signature = generateSignature('PUT', contentType, date, ossPath)
    const authorization = `OSS ${OSS_CONFIG.accessKeyId}:${signature}`

    const res = await Taro.request({
      url,
      method: 'PUT',
      header: {
        'Content-Type': contentType,
        'Date': date,
        'Authorization': authorization,
      },
      data: content,
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`[AliyunOSS] ✅ 上传成功: ${storageKey} (${data.length}条)`)
      return { success: true }
    } else {
      console.error(`[AliyunOSS] ❌ 上传失败: HTTP ${res.statusCode}`, res.data)
      return { success: false, error: `HTTP ${res.statusCode}` }
    }
  } catch (err: any) {
    console.error(`[AliyunOSS] ❌ 上传失败: ${storageKey}`, err)
    return { success: false, error: err.message || '上传失败' }
  }
}

/**
 * 上传学生数据
 * 注意：基础名单来自Excel（由管理脚本上传），小程序端只上传编辑后的变更
 * 上传前做去重和数量校验，防止数据膨胀
 */
export async function uploadStudents(): Promise<{ success: boolean; error?: string }> {
  const data = Taro.getStorageSync('kt_students') || []
  // 安全校验：如果数据量异常（超过Excel原始数据的2倍），拒绝上传
  if (data.length > 300) {
    console.warn(`[AliyunOSS] 学生数据异常(${data.length}条)，拒绝上传`)
    return { success: false, error: `数据量异常: ${data.length}条` }
  }
  return await uploadToAliyun('kt_students', data)
}

/**
 * 上传教职工数据
 * ⚠️ 注意：基础名单来自Excel（由管理脚本上传），小程序端只在管理员操作时上传
 * 安全策略：数据量必须在 20~100 条之间，防止少量数据覆盖云端完整数据
 */
export async function uploadStaff(): Promise<{ success: boolean; error?: string }> {
  const data = Taro.getStorageSync('kt_staff') || []
  // 安全校验上限
  if (data.length > 100) {
    console.warn(`[AliyunOSS] 教职工数据异常(${data.length}条)，拒绝上传`)
    return { success: false, error: `数据量异常: ${data.length}条` }
  }
  // 安全校验下限 - 防止少量记录覆盖完整数据
  if (data.length < 20) {
    console.warn(`[AliyunOSS] ⚠️ 教职工数据不足(${data.length}条<20)，拒绝上传以保护云端数据`)
    return { success: false, error: `数据不足: ${data.length}条，可能导致覆盖` }
  }
  return await uploadToAliyun('kt_staff', data)
}

/**
 * 上传考勤记录
 */
export async function uploadAttendanceRecords(): Promise<{ success: boolean; error?: string }> {
  const data = Taro.getStorageSync('kt_attendance_records') || []
  return await uploadToAliyun('kt_attendance_records', data)
}

/**
 * 上传健康记录
 */
export async function uploadHealthRecords(): Promise<{ success: boolean; error?: string }> {
  const data = Taro.getStorageSync('kt_health_records') || []
  return await uploadToAliyun('kt_health_records', data)
}

/**
 * 上传授权手机号到云端
 */
export async function uploadAuthorizedPhones(): Promise<{ success: boolean; error?: string }> {
  const data = Taro.getStorageSync('kt_authorized_phones') || []
  return await uploadToAliyun('kt_authorized_phones', data, true) // 强制上传，即使为空也要同步
}

/**
 * 上传用户数据到云端
 */
export async function uploadUsers(): Promise<{ success: boolean; error?: string }> {
  const data = Taro.getStorageSync('kt_all_users') || []
  return await uploadToAliyun('kt_all_users', data, true)
}

/**
 * 上传所有数据到阿里云
 */
export async function uploadAllToAliyun(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{
  success: boolean
  results: Record<string, { count: number; error?: string }>
}> {
  if (!isAliyunConfigured) {
    return { success: false, results: {} }
  }

  console.log('[AliyunOSS] 🚀 开始上传所有数据到阿里云...')

  // ⚠️ 注意：kt_staff 不参与批量上传！
  // 教职工基础数据由管理脚本从Excel上传，小程序端只在管理员明确操作（添加/分配/删除）时单独上传
  // 批量上传会导致新设备登录后本地只有1条记录覆盖云端38条的问题
  const tasks = [
    { key: 'kt_students', label: '学生数据', maxSafe: 300 },
    // kt_staff 已移除 - 不参与批量上传
    { key: 'kt_health_records', label: '健康记录', maxSafe: 0 },
    { key: 'kt_attendance_records', label: '考勤记录', maxSafe: 0 },
  ]

  const results: Record<string, { count: number; error?: string }> = {}
  let hasError = false

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    onProgress?.(i + 1, tasks.length, task.label)

    try {
      const data = Taro.getStorageSync(task.key) || []
      
      // 安全校验：数据量超过安全上限则跳过上传
      if (task.maxSafe > 0 && data.length > task.maxSafe) {
        console.warn(`[AliyunOSS] ${task.label}: 数据量异常(${data.length}>${task.maxSafe})，跳过上传`)
        results[task.key] = { count: 0, error: `数据量异常: ${data.length}条` }
        continue
      }
      
      if (data.length > 0) {
        const result = await uploadToAliyun(task.key, data)
        if (result.success) {
          results[task.key] = { count: data.length }
          console.log(`[AliyunOSS] ${task.label}: 上传 ${data.length} 条`)
        } else {
          results[task.key] = { count: 0, error: result.error }
          hasError = true
        }
      } else {
        results[task.key] = { count: 0 }
      }
    } catch (err: any) {
      results[task.key] = { count: 0, error: err.message }
      hasError = true
    }

    // 添加小延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  Taro.setStorageSync('kt_last_sync_time', new Date().toISOString())
  console.log('[AliyunOSS] ✅ 上传完成')

  return { success: !hasError, results }
}

/**
 * 双向同步（先下载云端数据合并，再上传）
 */
export async function syncWithAliyun(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{
  success: boolean
  downloaded: number
  uploaded: number
  error?: string
}> {
  if (!isAliyunConfigured) {
    return { success: false, downloaded: 0, uploaded: 0, error: '阿里云 OSS 未配置' }
  }

  console.log('[AliyunOSS] 🔄 开始双向同步...')

  let downloaded = 0
  let uploaded = 0

  // 1. 先下载云端数据
  onProgress?.(1, 3, '下载云端数据')
  const downloadResult = await initializeFromAliyun()
  Object.values(downloadResult.results).forEach(r => {
    downloaded += r.count
  })

  // 2. 上传本地数据
  onProgress?.(2, 3, '上传本地数据')
  const uploadResult = await uploadAllToAliyun()
  Object.values(uploadResult.results).forEach(r => {
    uploaded += r.count
  })

  onProgress?.(3, 3, '同步完成')
  
  console.log(`[AliyunOSS] ✅ 同步完成: 下载 ${downloaded} 条，上传 ${uploaded} 条`)

  return {
    success: downloadResult.success && uploadResult.success,
    downloaded,
    uploaded,
  }
}

/**
 * 仅下载学生数据（带数据保护）
 */
export async function downloadStudentsOnly(): Promise<{
  success: boolean
  count: number
  error?: string
}> {
  if (!isAliyunConfigured) {
    return { success: false, count: 0, error: '阿里云 OSS 未配置' }
  }

  try {
    const result = await downloadFromAliyun<any>('kt_students')
    
    // 下载失败，保留本地数据
    if (!result.success) {
      console.warn(`[AliyunOSS] ⚠️ 下载失败，保留本地数据: ${result.error}`)
      const localData = Taro.getStorageSync(STORAGE_KEYS.STUDENTS) || []
      return { success: false, count: localData.length, error: result.error }
    }
    
    // 下载成功但数据为空，检查是否需要保护
    if (result.data && result.data.length === 0) {
      const localData = Taro.getStorageSync(STORAGE_KEYS.STUDENTS) || []
      if (localData.length > 0) {
        console.warn(`[AliyunOSS] ⚠️ 云端数据为空，保留本地数据(${localData.length}条)`)
        return { success: true, count: localData.length }
      }
    }
    
    // 正常保存数据
    if (result.data && result.data.length > 0) {
      Taro.setStorageSync(STORAGE_KEYS.STUDENTS, result.data)
      console.log(`[AliyunOSS] ✅ 学生数据已保存: ${result.data.length}条`)
    }
    
    return { success: true, count: result.data?.length || 0 }
  } catch (err: any) {
    console.error(`[AliyunOSS] ❌ 下载异常:`, err.message)
    return { success: false, count: 0, error: err.message }
  }
}

/**
 * 下载所有数据（带数据保护）
 */
export async function downloadAllData(): Promise<{
  success: boolean
  students: number
  staff: number
  error?: string
}> {
  if (!isAliyunConfigured) {
    return { success: false, students: 0, staff: 0, error: '阿里云 OSS 未配置' }
  }

  console.log('[AliyunOSS] 🚀 下载所有数据...')

  let students = 0
  let staff = 0
  let hasError = false
  let errorMsg = ''

  // 获取本地数据用于保护
  const localStudents = Taro.getStorageSync(STORAGE_KEYS.STUDENTS) || []
  const localStaff = Taro.getStorageSync(STORAGE_KEYS.STAFF) || []

  try {
    // 下载学生数据
    const studentsResult = await downloadFromAliyun<any>('kt_students')
    if (studentsResult.success && studentsResult.data && studentsResult.data.length > 0) {
      Taro.setStorageSync(STORAGE_KEYS.STUDENTS, studentsResult.data)
      students = studentsResult.data.length
      console.log(`[AliyunOSS] ✅ 学生数据: ${students} 条`)
    } else if (!studentsResult.success) {
      // 下载失败，保留本地数据
      hasError = true
      errorMsg = studentsResult.error || '下载学生数据失败'
      students = localStudents.length
      console.warn(`[AliyunOSS] ⚠️ 下载学生失败，保留本地数据(${students}条)`)
    } else if (studentsResult.data?.length === 0 && localStudents.length > 0) {
      // 云端为空但本地有数据，保留本地
      students = localStudents.length
      console.warn(`[AliyunOSS] ⚠️ 云端学生为空，保留本地数据(${students}条)`)
    }

    // 下载教职工数据
    const staffResult = await downloadFromAliyun<any>('kt_staff')
    if (staffResult.success && staffResult.data && staffResult.data.length > 0) {
      Taro.setStorageSync(STORAGE_KEYS.STAFF, staffResult.data)
      staff = staffResult.data.length
      console.log(`[AliyunOSS] ✅ 教职工数据: ${staff} 条`)
    } else if (!staffResult.success) {
      hasError = true
      errorMsg = staffResult.error || '下载教职工数据失败'
      staff = localStaff.length
      console.warn(`[AliyunOSS] ⚠️ 下载教职工失败，保留本地数据(${staff}条)`)
    } else if (staffResult.data?.length === 0 && localStaff.length > 0) {
      staff = localStaff.length
      console.warn(`[AliyunOSS] ⚠️ 云端教职工为空，保留本地数据(${staff}条)`)
    }

    // 下载授权手机号
    const phonesResult = await downloadFromAliyun<any>('kt_authorized_phones')
    if (phonesResult.success && phonesResult.data && phonesResult.data.length > 0) {
      Taro.setStorageSync(STORAGE_KEYS.AUTHORIZED_PHONES, phonesResult.data)
      console.log(`[AliyunOSS] ✅ 授权手机: ${phonesResult.data.length} 条`)
    }

    // 下载用户数据
    const usersResult = await downloadFromAliyun<any>('kt_all_users')
    if (usersResult.success && usersResult.data) {
      Taro.setStorageSync(STORAGE_KEYS.ALL_USERS, usersResult.data)
      console.log(`[AliyunOSS] ✅ 用户数据: ${usersResult.data.length} 条`)
    }

    Taro.setStorageSync('kt_last_sync_time', new Date().toISOString())

    return {
      success: !hasError,
      students,
      staff,
      error: hasError ? errorMsg : undefined
    }
  } catch (err: any) {
    return { success: false, students: 0, staff: 0, error: err.message }
  }
}
