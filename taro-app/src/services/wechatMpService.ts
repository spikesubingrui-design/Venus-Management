/**
 * 微信公众号消息推送服务
 * 奇德金星幼儿园 - 公众号提醒功能
 */

import Taro from '@tarojs/taro'

// 公众号配置（需要在微信公众平台获取）
const MP_CONFIG = {
  appId: '', // 公众号AppID，需要配置
  appSecret: '', // 公众号AppSecret，需要配置
  // 模板消息ID（需要在公众平台申请）
  templates: {
    attendance: '',      // 考勤提醒模板ID
    mealReminder: '',    // 陪餐提醒模板ID
    payment: '',         // 缴费提醒模板ID
    healthAlert: '',     // 健康异常提醒模板ID
    pickup: '',          // 接送提醒模板ID
    menuUpdate: '',      // 食谱更新提醒模板ID
    activity: '',        // 活动通知模板ID
  }
}

// 云函数地址（需要部署云函数）
const CLOUD_FUNCTION_URL = 'https://your-cloud-function.com/mp-message'

// 提醒类型
export type ReminderType = 
  | 'attendance'      // 考勤提醒
  | 'mealReminder'    // 陪餐提醒
  | 'payment'         // 缴费提醒
  | 'healthAlert'     // 健康异常
  | 'pickup'          // 接送提醒
  | 'menuUpdate'      // 食谱更新
  | 'activity'        // 活动通知

// 提醒数据接口
export interface ReminderData {
  type: ReminderType
  toUserOpenId: string  // 接收者的公众号OpenID
  title: string
  content: string
  time?: string
  remark?: string
  url?: string          // 点击跳转链接
  miniprogram?: {       // 跳转小程序
    appid: string
    pagepath: string
  }
}

// 考勤提醒数据
export interface AttendanceReminderData {
  studentName: string
  className: string
  status: 'arrival' | 'departure'  // 到校/离校
  time: string
  parentOpenId: string
}

// 陪餐提醒数据
export interface MealReminderData {
  teacherName: string
  mealType: '早餐' | '午餐' | '下午点'
  className: string
  time: string
  teacherOpenId: string
}

// 缴费提醒数据
export interface PaymentReminderData {
  studentName: string
  feeType: string
  amount: number
  dueDate: string
  parentOpenId: string
}

// 健康异常提醒数据
export interface HealthAlertData {
  studentName: string
  className: string
  alertType: string  // 如：体温异常
  value: string      // 如：38.5℃
  time: string
  parentOpenId: string
}

/**
 * 发送模板消息（通过云函数）
 * 注意：小程序前端无法直接调用公众号API，需要通过云函数中转
 */
export const sendTemplateMessage = async (data: ReminderData): Promise<{ success: boolean; error?: string }> => {
  try {
    // 检查配置
    if (!CLOUD_FUNCTION_URL || CLOUD_FUNCTION_URL.includes('your-cloud-function')) {
      console.log('[公众号消息] 云函数未配置，跳过发送')
      return { success: false, error: '云函数未配置' }
    }

    const response = await Taro.request({
      url: CLOUD_FUNCTION_URL,
      method: 'POST',
      data: {
        action: 'sendTemplate',
        ...data
      }
    })

    if (response.statusCode === 200 && response.data.errcode === 0) {
      console.log('[公众号消息] 发送成功:', data.type)
      return { success: true }
    } else {
      console.error('[公众号消息] 发送失败:', response.data)
      return { success: false, error: response.data.errmsg || '发送失败' }
    }
  } catch (error) {
    console.error('[公众号消息] 请求错误:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 发送考勤提醒
 */
export const sendAttendanceReminder = async (data: AttendanceReminderData) => {
  const statusText = data.status === 'arrival' ? '已到校' : '已离校'
  
  return sendTemplateMessage({
    type: 'attendance',
    toUserOpenId: data.parentOpenId,
    title: '考勤通知',
    content: `${data.studentName}（${data.className}）${statusText}`,
    time: data.time,
    remark: '感谢您对孩子的关注',
    miniprogram: {
      appid: '', // 小程序AppID
      pagepath: '/pages/students/attendance'
    }
  })
}

/**
 * 发送陪餐提醒
 */
export const sendMealReminder = async (data: MealReminderData) => {
  return sendTemplateMessage({
    type: 'mealReminder',
    toUserOpenId: data.teacherOpenId,
    title: '陪餐任务提醒',
    content: `您有${data.mealType}陪餐任务`,
    time: data.time,
    remark: `班级：${data.className}，请提前安排好时间`,
    miniprogram: {
      appid: '',
      pagepath: '/pages/kitchen/index'
    }
  })
}

/**
 * 发送缴费提醒
 */
export const sendPaymentReminder = async (data: PaymentReminderData) => {
  return sendTemplateMessage({
    type: 'payment',
    toUserOpenId: data.parentOpenId,
    title: '缴费提醒',
    content: `${data.studentName}的${data.feeType}费用待缴纳`,
    time: `截止日期：${data.dueDate}`,
    remark: `金额：¥${data.amount}，请及时缴纳`,
    miniprogram: {
      appid: '',
      pagepath: '/pages/students/payment'
    }
  })
}

/**
 * 发送健康异常提醒
 */
export const sendHealthAlert = async (data: HealthAlertData) => {
  return sendTemplateMessage({
    type: 'healthAlert',
    toUserOpenId: data.parentOpenId,
    title: '健康异常提醒',
    content: `${data.studentName}（${data.className}）${data.alertType}`,
    time: data.time,
    remark: `检测值：${data.value}，请关注孩子健康状况`,
    miniprogram: {
      appid: '',
      pagepath: '/pages/students/health'
    }
  })
}

/**
 * 发送食谱更新通知
 */
export const sendMenuUpdateNotice = async (openIds: string[], weekRange: string) => {
  const results = await Promise.all(
    openIds.map(openId => 
      sendTemplateMessage({
        type: 'menuUpdate',
        toUserOpenId: openId,
        title: '食谱更新通知',
        content: `${weekRange}营养食谱已发布`,
        remark: '点击查看本周食谱详情',
        miniprogram: {
          appid: '',
          pagepath: '/pages/kitchen/index'
        }
      })
    )
  )
  
  const successCount = results.filter(r => r.success).length
  console.log(`[公众号消息] 食谱通知发送完成: ${successCount}/${openIds.length}`)
  return { successCount, total: openIds.length }
}

/**
 * 发送活动通知
 */
export const sendActivityNotice = async (openIds: string[], activityTitle: string, activityTime: string, activityDesc: string) => {
  const results = await Promise.all(
    openIds.map(openId => 
      sendTemplateMessage({
        type: 'activity',
        toUserOpenId: openId,
        title: '活动通知',
        content: activityTitle,
        time: activityTime,
        remark: activityDesc,
        miniprogram: {
          appid: '',
          pagepath: '/pages/index/index'
        }
      })
    )
  )
  
  const successCount = results.filter(r => r.success).length
  return { successCount, total: openIds.length }
}

/**
 * 用户OpenID绑定管理
 * 存储用户的公众号OpenID与小程序账号的关联
 */
export interface UserMpBinding {
  userId: string        // 小程序用户ID（手机号）
  mpOpenId: string      // 公众号OpenID
  role: 'parent' | 'teacher' | 'admin'
  bindTime: string
  studentIds?: string[] // 家长关联的学生ID
}

// 保存用户绑定
export const saveUserMpBinding = (binding: UserMpBinding) => {
  const bindings = Taro.getStorageSync('kt_mp_bindings') || []
  const existingIndex = bindings.findIndex((b: UserMpBinding) => b.userId === binding.userId)
  
  if (existingIndex >= 0) {
    bindings[existingIndex] = binding
  } else {
    bindings.push(binding)
  }
  
  Taro.setStorageSync('kt_mp_bindings', bindings)
  console.log('[公众号绑定] 保存成功:', binding.userId)
}

// 获取用户绑定
export const getUserMpBinding = (userId: string): UserMpBinding | null => {
  const bindings = Taro.getStorageSync('kt_mp_bindings') || []
  return bindings.find((b: UserMpBinding) => b.userId === userId) || null
}

// 根据学生ID获取家长的OpenID
export const getParentOpenIdByStudentId = (studentId: string): string | null => {
  const bindings: UserMpBinding[] = Taro.getStorageSync('kt_mp_bindings') || []
  const parentBinding = bindings.find(b => 
    b.role === 'parent' && b.studentIds?.includes(studentId)
  )
  return parentBinding?.mpOpenId || null
}

// 获取所有家长的OpenID列表
export const getAllParentOpenIds = (): string[] => {
  const bindings: UserMpBinding[] = Taro.getStorageSync('kt_mp_bindings') || []
  return bindings
    .filter(b => b.role === 'parent' && b.mpOpenId)
    .map(b => b.mpOpenId)
}

// 获取老师的OpenID
export const getTeacherOpenId = (teacherId: string): string | null => {
  const bindings: UserMpBinding[] = Taro.getStorageSync('kt_mp_bindings') || []
  const teacherBinding = bindings.find(b => 
    b.role === 'teacher' && b.userId === teacherId
  )
  return teacherBinding?.mpOpenId || null
}

export default {
  sendTemplateMessage,
  sendAttendanceReminder,
  sendMealReminder,
  sendPaymentReminder,
  sendHealthAlert,
  sendMenuUpdateNotice,
  sendActivityNotice,
  saveUserMpBinding,
  getUserMpBinding,
  getParentOpenIdByStudentId,
  getAllParentOpenIds,
  getTeacherOpenId
}
