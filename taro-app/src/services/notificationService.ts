/**
 * 小程序订阅消息服务
 * 通过微信订阅消息实现：考勤异常提醒、食谱更新通知、缴费提醒
 * 
 * 使用前需在微信公众平台 → 小程序后台 → 订阅消息 → 选用模板
 * 配置好模板ID后填入下方 TEMPLATE_IDS
 */

import Taro from '@tarojs/taro'
import { uploadToAliyun, downloadFromAliyun } from './aliyunOssService'

// ============ 配置区 ============
// 小程序 AppID
const MINI_APP_ID = 'wxa9a22865dfe6d498'

// 订阅消息模板ID（需在微信公众平台申请后填入）
// 申请路径：微信公众平台 → 功能 → 订阅消息 → 选用模板
export const TEMPLATE_IDS = {
  // 考勤异常提醒模板（推荐关键词：学生姓名、班级、异常类型、日期、备注）
  attendance: '',
  // 食谱更新通知模板（推荐关键词：更新内容、适用日期、备注）  
  menuUpdate: '',
  // 缴费提醒模板（推荐关键词：学生姓名、费用项目、金额、截止日期、备注）
  payment: '',
}

// 是否已配置模板ID
export const isNotificationConfigured = (): boolean => {
  return Object.values(TEMPLATE_IDS).some(id => id.length > 0)
}

// ============ 订阅消息（客户端） ============

/**
 * 请求用户订阅消息权限
 * 调用后弹出微信授权弹窗，用户可选择"允许"或"取消"
 * @param types 要订阅的消息类型
 * @returns 每个模板的订阅结果
 */
export const requestSubscribe = async (
  types: Array<'attendance' | 'menuUpdate' | 'payment'>
): Promise<{ success: boolean; results?: Record<string, string> }> => {
  const tmplIds = types
    .map(t => TEMPLATE_IDS[t])
    .filter(id => id.length > 0)

  if (tmplIds.length === 0) {
    console.log('[通知] 未配置模板ID，跳过订阅')
    return { success: false }
  }

  try {
    const res = await Taro.requestSubscribeMessage({ tmplIds })
    console.log('[通知] 订阅结果:', res)
    
    // 记录订阅状态
    const subscriptions = Taro.getStorageSync('kt_subscriptions') || {}
    const user = Taro.getStorageSync('kt_current_user')
    if (user) {
      subscriptions[user.phone] = {
        ...subscriptions[user.phone],
        ...res,
        lastTime: new Date().toISOString()
      }
      Taro.setStorageSync('kt_subscriptions', subscriptions)
    }

    return { success: true, results: res as any }
  } catch (err) {
    console.log('[通知] 订阅取消或失败:', err)
    return { success: false }
  }
}

/**
 * 一键订阅全部消息
 */
export const subscribeAll = async () => {
  return requestSubscribe(['attendance', 'menuUpdate', 'payment'])
}

// ============ 通知队列（存储到OSS，由后端发送） ============

interface NotificationItem {
  id: string
  type: 'attendance' | 'menuUpdate' | 'payment'
  templateId: string
  toUserPhone: string     // 接收者手机号
  data: Record<string, { value: string }>  // 模板数据
  page?: string           // 点击跳转页面
  createdAt: string
  sent: boolean
}

/**
 * 添加考勤异常通知到队列
 */
export const queueAttendanceNotice = async (params: {
  studentName: string
  className: string
  status: string          // '病假' | '事假' | '缺勤' 等
  date: string
  remark?: string
}) => {
  if (!TEMPLATE_IDS.attendance) return

  const item: NotificationItem = {
    id: `att_${Date.now()}`,
    type: 'attendance',
    templateId: TEMPLATE_IDS.attendance,
    toUserPhone: '',  // 由后端根据学生匹配家长
    data: {
      thing1: { value: params.studentName },
      thing2: { value: params.className },
      thing3: { value: params.status },
      date4: { value: params.date },
      thing5: { value: params.remark || '请及时关注' },
    },
    page: '/pages/students/attendance',
    createdAt: new Date().toISOString(),
    sent: false
  }

  await addToQueue(item)
  console.log('[通知] 考勤异常已入队:', params.studentName, params.status)
}

/**
 * 添加食谱更新通知到队列
 */
export const queueMenuUpdateNotice = async (params: {
  weekRange: string       // 如 "2026.2.3-2.7"
  updatedBy: string       // 更新人
}) => {
  if (!TEMPLATE_IDS.menuUpdate) return

  const item: NotificationItem = {
    id: `menu_${Date.now()}`,
    type: 'menuUpdate',
    templateId: TEMPLATE_IDS.menuUpdate,
    toUserPhone: '__all_staff__', // 标记发送给全体教职工
    data: {
      thing1: { value: `${params.weekRange}营养食谱已更新` },
      date2: { value: new Date().toLocaleDateString('zh-CN') },
      thing3: { value: `由${params.updatedBy}发布，请查看详情` },
    },
    page: '/pages/kitchen/index',
    createdAt: new Date().toISOString(),
    sent: false
  }

  await addToQueue(item)
  console.log('[通知] 食谱更新已入队:', params.weekRange)
}

/**
 * 添加缴费提醒通知到队列
 */
export const queuePaymentNotice = async (params: {
  studentName: string
  feeType: string         // 费用类型
  amount: number
  dueDate: string
  parentPhone?: string
}) => {
  if (!TEMPLATE_IDS.payment) return

  const item: NotificationItem = {
    id: `pay_${Date.now()}`,
    type: 'payment',
    templateId: TEMPLATE_IDS.payment,
    toUserPhone: params.parentPhone || '',
    data: {
      thing1: { value: params.studentName },
      thing2: { value: params.feeType },
      amount3: { value: `${params.amount}元` },
      date4: { value: params.dueDate },
      thing5: { value: '请及时缴纳，如有疑问请联系园区' },
    },
    page: '/pages/finance/index',
    createdAt: new Date().toISOString(),
    sent: false
  }

  await addToQueue(item)
  console.log('[通知] 缴费提醒已入队:', params.studentName, params.feeType)
}

// ============ 队列管理 ============

const QUEUE_KEY = 'kt_notification_queue'

async function addToQueue(item: NotificationItem) {
  try {
    const queue: NotificationItem[] = Taro.getStorageSync(QUEUE_KEY) || []
    queue.push(item)
    // 只保留最近100条
    const trimmed = queue.slice(-100)
    Taro.setStorageSync(QUEUE_KEY, trimmed)

    // 同步到云端（后端服务可以读取并发送）
    await uploadToAliyun(QUEUE_KEY, trimmed)
  } catch (err) {
    console.error('[通知] 入队失败:', err)
  }
}

/**
 * 获取待发送通知数量
 */
export const getPendingCount = (): number => {
  const queue: NotificationItem[] = Taro.getStorageSync(QUEUE_KEY) || []
  return queue.filter(item => !item.sent).length
}

/**
 * 获取通知历史
 */
export const getNotificationHistory = (): NotificationItem[] => {
  return Taro.getStorageSync(QUEUE_KEY) || []
}

export default {
  TEMPLATE_IDS,
  isNotificationConfigured,
  requestSubscribe,
  subscribeAll,
  queueAttendanceNotice,
  queueMenuUpdateNotice,
  queuePaymentNotice,
  getPendingCount,
  getNotificationHistory,
}
