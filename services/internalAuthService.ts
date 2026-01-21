/**
 * 专业模式验证服务
 */

const INTERNAL_AUTH_KEY = 'kt_cache_session'  // 隐蔽命名
const INTERNAL_PASSWORD_KEY = 'kt_pref_v2'     // 隐蔽命名
const DEFAULT_PASSWORD = 'qdjx7777'
const AUTH_DURATION = 30 * 60 * 1000 // 30分钟有效期

interface InternalAuth {
  verified: boolean
  expireAt: number
  verifiedBy: string
}

// 简单哈希函数
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * 验证内账访问密码
 */
export function verifyInternalPassword(password: string, userName: string): boolean {
  const savedHash = localStorage.getItem(INTERNAL_PASSWORD_KEY)
  const inputHash = simpleHash(password)
  
  // 如果没有设置过密码，使用默认密码
  const correctHash = savedHash || simpleHash(DEFAULT_PASSWORD)
  
  if (inputHash === correctHash) {
    // 设置验证状态，30分钟有效
    const auth: InternalAuth = {
      verified: true,
      expireAt: Date.now() + AUTH_DURATION,
      verifiedBy: userName
    }
    sessionStorage.setItem(INTERNAL_AUTH_KEY, JSON.stringify(auth))
    return true
  }
  return false
}

/**
 * 检查是否已通过二次验证
 */
export function isInternalVerified(): boolean {
  const authStr = sessionStorage.getItem(INTERNAL_AUTH_KEY)
  if (!authStr) return false
  
  try {
    const auth: InternalAuth = JSON.parse(authStr)
    if (Date.now() > auth.expireAt) {
      sessionStorage.removeItem(INTERNAL_AUTH_KEY)
      return false
    }
    return auth.verified
  } catch {
    return false
  }
}

/**
 * 获取验证信息
 */
export function getInternalAuthInfo(): { verified: boolean; expireAt?: number; verifiedBy?: string; remainingMinutes?: number } {
  const authStr = sessionStorage.getItem(INTERNAL_AUTH_KEY)
  if (!authStr) return { verified: false }
  
  try {
    const auth: InternalAuth = JSON.parse(authStr)
    if (Date.now() > auth.expireAt) {
      sessionStorage.removeItem(INTERNAL_AUTH_KEY)
      return { verified: false }
    }
    return {
      verified: true,
      expireAt: auth.expireAt,
      verifiedBy: auth.verifiedBy,
      remainingMinutes: Math.ceil((auth.expireAt - Date.now()) / 60000)
    }
  } catch {
    return { verified: false }
  }
}

/**
 * 设置内账密码（仅超级管理员）
 */
export function setInternalPassword(newPassword: string): void {
  const hash = simpleHash(newPassword)
  localStorage.setItem(INTERNAL_PASSWORD_KEY, hash)
}

/**
 * 检查是否已设置自定义密码
 */
export function hasCustomPassword(): boolean {
  return localStorage.getItem(INTERNAL_PASSWORD_KEY) !== null
}

/**
 * 清除验证状态（退出内账模式）
 */
export function clearInternalAuth(): void {
  sessionStorage.removeItem(INTERNAL_AUTH_KEY)
}

/**
 * 延长验证有效期
 */
export function extendAuthDuration(): void {
  const authStr = sessionStorage.getItem(INTERNAL_AUTH_KEY)
  if (!authStr) return
  
  try {
    const auth: InternalAuth = JSON.parse(authStr)
    auth.expireAt = Date.now() + AUTH_DURATION
    sessionStorage.setItem(INTERNAL_AUTH_KEY, JSON.stringify(auth))
  } catch {
    // ignore
  }
}

// ============ 数据类型 ============

export type AccountType = 'public' | 'internal'

export interface InternalFinanceRecord {
  id: string
  accountType: AccountType
  publicAmount: number
  publicDescription: string
  internalAmount?: number
  internalDescription?: string
  internalNotes?: string
  sensitiveInfo?: string
  diffReason?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

// ============ 数据存储 ============

const INTERNAL_RECORDS_KEY = 'kt_memo_data'  // 隐蔽命名

/**
 * 获取所有内账记录
 */
export function getInternalRecords(): InternalFinanceRecord[] {
  const data = localStorage.getItem(INTERNAL_RECORDS_KEY)
  return data ? JSON.parse(data) : []
}

/**
 * 保存内账记录
 */
export function saveInternalRecord(record: InternalFinanceRecord): void {
  const records = getInternalRecords()
  const index = records.findIndex(r => r.id === record.id)
  
  if (index >= 0) {
    records[index] = { ...record, updatedAt: new Date().toISOString() }
  } else {
    records.push({ ...record, createdAt: new Date().toISOString() })
  }
  
  localStorage.setItem(INTERNAL_RECORDS_KEY, JSON.stringify(records))
}

/**
 * 删除内账记录
 */
export function deleteInternalRecord(id: string): void {
  const records = getInternalRecords().filter(r => r.id !== id)
  localStorage.setItem(INTERNAL_RECORDS_KEY, JSON.stringify(records))
}

/**
 * 获取内账记录统计
 */
export function getInternalStats() {
  const records = getInternalRecords()
  
  // 计算内外差异
  const publicTotal = records.reduce((sum, r) => sum + r.publicAmount, 0)
  const internalTotal = records.reduce((sum, r) => sum + (r.internalAmount || r.publicAmount), 0)
  const difference = internalTotal - publicTotal
  
  return {
    recordCount: records.length,
    publicTotal,
    internalTotal,
    difference,
    differencePercent: publicTotal > 0 ? ((difference / publicTotal) * 100).toFixed(2) : '0'
  }
}
