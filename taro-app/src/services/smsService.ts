/**
 * 短信验证码服务 - 小程序版
 * 
 * 模式说明：
 * 1. 开发模式（USE_REAL_SMS = false）：生成模拟验证码，显示在界面上
 * 2. 生产模式（USE_REAL_SMS = true）：通过云函数发送真实短信
 */

import Taro from '@tarojs/taro'

// ============================================
// 📌 配置区域 - 请根据实际情况修改
// ============================================

// 是否启用真实短信（true = 发送真实短信，false = 开发模式显示验证码）
const USE_REAL_SMS = true

// 阿里云短信云函数配置
const SMS_CONFIG = {
  // 云函数URL
  functionUrl: 'https://venus-gfectwrqon.cn-beijing.fcapp.run',
}

// ============================================
// 以下代码无需修改
// ============================================

// 验证码本地存储（开发模式）
const codeStore: Map<string, { code: string; expiresAt: number; sentAt: number }> = new Map()

/**
 * 发送验证码
 */
export async function sendVerificationCode(phone: string): Promise<{
  success: boolean
  message: string
  code?: string  // 开发模式返回验证码用于显示
}> {
  // 验证手机号格式
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, message: '请输入正确的手机号码' }
  }

  // 检查发送频率（60秒内不能重复发送）
  const existing = codeStore.get(phone)
  if (existing && Date.now() - existing.sentAt < 60000) {
    const remaining = Math.ceil((60000 - (Date.now() - existing.sentAt)) / 1000)
    return { success: false, message: `请${remaining}秒后再试` }
  }

  // 生成6位随机验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const now = Date.now()
  const expiresAt = now + 5 * 60 * 1000 // 5分钟过期

  // 生产模式：调用云函数发送真实短信
  if (USE_REAL_SMS && SMS_CONFIG.functionUrl) {
    try {
      console.log('[SMS] 调用云函数发送短信...')
      
      const response = await Taro.request({
        url: SMS_CONFIG.functionUrl,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
        },
        data: {
          action: 'send',
          phone,
        },
        timeout: 15000,
      })

      console.log('[SMS] 云函数响应:', response)

      console.log('[SMS] 响应状态码:', response.statusCode)
      console.log('[SMS] 响应数据:', response.data)
      
      if (response.statusCode === 200) {
        const result = typeof response.data === 'string' 
          ? JSON.parse(response.data) 
          : response.data

        if (result && result.success) {
          // 本地也存储，用于验证（备用）
          codeStore.set(phone, { code: '', expiresAt, sentAt: now })
          return { success: true, message: result.message || '验证码已发送到您的手机' }
        } else {
          return { success: false, message: (result && result.message) || '发送失败，请重试' }
        }
      } else if (response.statusCode === 429) {
        return { success: false, message: '发送太频繁，请稍后再试' }
      } else if (response.statusCode === 400) {
        const result = typeof response.data === 'string' 
          ? JSON.parse(response.data) 
          : response.data
        return { success: false, message: (result && result.message) || '请求参数错误' }
      } else {
        console.error('[SMS] 云函数错误:', response)
        return { success: false, message: `服务错误(${response.statusCode})` }
      }
    } catch (error: any) {
      console.error('[SMS] 请求失败:', error)
      
      // 网络错误时回退到开发模式
      if (error.errMsg?.includes('timeout') || error.errMsg?.includes('fail')) {
        console.log('[SMS] 网络错误，回退到开发模式')
        codeStore.set(phone, { code, expiresAt, sentAt: now })
        return {
          success: true,
          message: '网络异常，使用开发模式',
          code,
        }
      }
      
      return { success: false, message: '网络错误，请稍后重试' }
    }
  }

  // 开发模式：直接返回验证码
  codeStore.set(phone, { code, expiresAt, sentAt: now })
  console.log(`[SMS 开发模式] ${phone} => ${code}`)
  
  return {
    success: true,
    message: '验证码已生成（开发模式）',
    code, // 开发模式返回验证码
  }
}

/**
 * 验证验证码
 */
export async function verifyCode(phone: string, inputCode: string): Promise<{
  success: boolean
  message: string
}> {
  if (!phone || !inputCode) {
    return { success: false, message: '请输入手机号和验证码' }
  }

  if (!/^\d{6}$/.test(inputCode)) {
    return { success: false, message: '验证码格式错误' }
  }

  // 生产模式：调用云函数验证
  if (USE_REAL_SMS && SMS_CONFIG.functionUrl) {
    try {
      const response = await Taro.request({
        url: SMS_CONFIG.functionUrl,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
        },
        data: {
          action: 'verify',
          phone,
          code: inputCode,
        },
        timeout: 10000,
      })

      if (response.statusCode === 200) {
        const result = typeof response.data === 'string'
          ? JSON.parse(response.data)
          : response.data
        return { 
          success: result?.success ?? false, 
          message: result?.message || (result?.success ? '验证成功' : '验证失败')
        }
      } else {
        const result = typeof response.data === 'string'
          ? JSON.parse(response.data)
          : response.data
        return { success: false, message: result?.message || '验证失败' }
      }
    } catch (error) {
      console.error('[SMS] 验证请求失败:', error)
      // 回退到本地验证
    }
  }

  // 开发模式 / 回退：本地验证
  const stored = codeStore.get(phone)

  if (!stored) {
    return { success: false, message: '请先获取验证码' }
  }

  if (Date.now() > stored.expiresAt) {
    codeStore.delete(phone)
    return { success: false, message: '验证码已过期，请重新获取' }
  }

  // 开发模式下，验证存储的验证码
  if (stored.code && stored.code !== inputCode) {
    return { success: false, message: '验证码错误' }
  }

  // 验证成功，删除验证码
  codeStore.delete(phone)
  return { success: true, message: '验证成功' }
}

/**
 * 检查是否使用真实短信服务
 */
export function isRealSmsEnabled(): boolean {
  return USE_REAL_SMS && !!SMS_CONFIG.functionUrl
}

/**
 * 获取短信服务状态
 */
export function getSmsServiceStatus(): {
  mode: 'production' | 'development'
  configured: boolean
} {
  return {
    mode: USE_REAL_SMS ? 'production' : 'development',
    configured: !!SMS_CONFIG.functionUrl,
  }
}
