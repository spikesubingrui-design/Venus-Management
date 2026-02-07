/**
 * 微信手机号快捷登录服务
 * 
 * 流程：
 * 1. 前端：用户点击 <Button openType="getPhoneNumber"> 触发微信授权
 * 2. 前端：获取回调中的 code（动态令牌）
 * 3. 后端：用 code + access_token 调用 phonenumber.getPhoneNumber 换取手机号
 * 4. 前端：拿到手机号后执行登录/注册流程
 */

import Taro from '@tarojs/taro'

// ============ 配置 ============
// 复用已有的阿里云函数计算服务（与短信服务相同的URL）
const CLOUD_FUNCTION_URL = 'https://venus-gfectwrqon.cn-beijing.fcapp.run'

/**
 * 通过微信 code 换取手机号
 * 调用已有的云函数，action: 'getPhoneNumber'
 * @param code getPhoneNumber 回调中的动态令牌
 * @returns 手机号或错误
 */
export const getPhoneByCode = async (code: string): Promise<{
  success: boolean
  phone?: string
  error?: string
}> => {
  try {
    const res = await Taro.request({
      url: CLOUD_FUNCTION_URL,
      method: 'POST',
      data: { action: 'getPhoneNumber', code },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    if (res.statusCode === 200 && res.data?.success && res.data?.phone) {
      console.log('[WxPhone] 手机号获取成功')
      return { success: true, phone: res.data.phone }
    }

    return { 
      success: false, 
      error: res.data?.error || '获取手机号失败，请使用验证码登录' 
    }
  } catch (err: any) {
    console.error('[WxPhone] 请求失败:', err)
    return { success: false, error: '网络请求失败，请使用验证码登录' }
  }
}

/**
 * 检查是否支持微信手机号登录
 */
export const isWxPhoneLoginEnabled = (): boolean => {
  return CLOUD_FUNCTION_URL.length > 0
}

export default {
  getPhoneByCode,
  isWxPhoneLoginEnabled,
}
