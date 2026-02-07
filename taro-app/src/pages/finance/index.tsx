import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { downloadPayments, isSupabaseConfigured } from '../../services/cloudSyncService'
import { uploadToAliyun, isAliyunConfigured } from '../../services/aliyunOssService'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './index.scss'

interface Payment {
  id: string
  studentId: string
  studentName: string
  studentClass: string
  amount: number
  feeType: string
  feeDetails?: { key: string; label: string; price: number }[]
  periodType: string
  paymentMethod: string
  status: string
  paymentDate: string
  notes?: string
}

// 小程序端只显示基础财务信息，敏感数据在网站端管理
export default function Finance() {
  useGlobalShare({ title: '金星幼儿园 - 财务管理', path: '/pages/finance/index' })
  const [payments, setPayments] = useState<Payment[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'list'>('overview')  // 移除stats标签
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filterClass, setFilterClass] = useState('全部')
  const [currentUser, setCurrentUser] = useState<any>(null)

  const classes = ['全部', '托班', '小一班', '小二班', '中一班', '中二班', '大一班', '大二班']

  useEffect(() => {
    loadPayments()
    // 加载当前用户信息
    const user = Taro.getStorageSync('kt_current_user')
    setCurrentUser(user)
  }, [])

  useDidShow(() => {
    loadPayments()
  })

  const loadPayments = async () => {
    // 先加载本地数据
    let data = Taro.getStorageSync('kt_payments') || []
    setPayments(data)

    // 尝试从云端同步
    if (isSupabaseConfigured) {
      const result = await downloadPayments()
      if (result.success && result.data) {
        setPayments(result.data)
      }
    }
  }

  // 检查是否有管理员权限
  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'admin'

  // 筛选后的记录
  const filteredPayments = payments.filter(p => {
    const matchMonth = p.paymentDate?.startsWith(filterMonth)
    const matchClass = filterClass === '全部' || p.studentClass === filterClass
    return matchMonth && matchClass
  })

  // 统计数据
  const stats = {
    totalAmount: filteredPayments.reduce((sum, p) => sum + p.amount, 0),
    totalCount: filteredPayments.length,
    byMethod: {
      wechat: filteredPayments.filter(p => p.paymentMethod === 'wechat').reduce((s, p) => s + p.amount, 0),
      alipay: filteredPayments.filter(p => p.paymentMethod === 'alipay').reduce((s, p) => s + p.amount, 0),
      cash: filteredPayments.filter(p => p.paymentMethod === 'cash').reduce((s, p) => s + p.amount, 0),
      transfer: filteredPayments.filter(p => p.paymentMethod === 'transfer').reduce((s, p) => s + p.amount, 0),
    },
    byClass: classes.slice(1).map(cls => ({
      name: cls,
      amount: payments.filter(p => p.studentClass === cls && p.paymentDate?.startsWith(filterMonth))
        .reduce((s, p) => s + p.amount, 0)
    }))
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const getMethodLabel = (method: string) => {
    const map: Record<string, string> = {
      wechat: '微信',
      alipay: '支付宝',
      cash: '现金',
      transfer: '转账'
    }
    return map[method] || method
  }

  const getMethodIcon = (method: string) => {
    const map: Record<string, string> = {
      wechat: '💚',
      alipay: '💙',
      cash: '💵',
      transfer: '🏦'
    }
    return map[method] || '💰'
  }

  // 删除记录 - 仅管理员可操作
  const deletePayment = (id: string) => {
    if (!isAdmin) {
      Taro.showToast({ title: '无权限操作', icon: 'none' })
      return
    }
    Taro.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确认删除？',
      success: (res) => {
        if (res.confirm) {
          const updated = payments.filter(p => p.id !== id)
          Taro.setStorageSync('kt_payments', updated)
          if (isAliyunConfigured) {
            uploadToAliyun('kt_payments', updated).catch(() => {})
          }
          setPayments(updated)
          Taro.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }

  return (
    <View className='finance-page'>
      <NavBar title='收费管理' />
      <NavBarPlaceholder />
      {/* 页面提示 - 小程序只显示基础信息 */}
      <View className='info-banner'>
        <Text className='info-icon'>💡</Text>
        <Text className='info-text'>
          完整财务管理请到网站后台：<Text className='link'>venus-management.com</Text>
        </Text>
      </View>

      {/* 筛选栏 */}
      <View className='filter-bar'>
        <Picker mode='date' fields='month' value={filterMonth} onChange={(e) => setFilterMonth(e.detail.value)}>
          <View className='filter-item'>
            <Text className='label'>📅 {filterMonth}</Text>
          </View>
        </Picker>
        <View className='filter-item' onClick={() => {
          const index = classes.indexOf(filterClass)
          const next = (index + 1) % classes.length
          setFilterClass(classes[next])
        }}>
          <Text className='label'>🏫 {filterClass}</Text>
        </View>
      </View>

      {/* 标签页 - 小程序简化为两个标签 */}
      <View className='tabs'>
        {[
          { key: 'overview', label: '概览' },
          { key: 'list', label: '缴费记录' }
        ].map(tab => (
          <View
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView className='content' scrollY>
        {/* 概览 */}
        {activeTab === 'overview' && (
          <View className='overview'>
            {/* 总额卡片 */}
            <View className='total-card'>
              <Text className='label'>本月收费总额</Text>
              <Text className='amount'>¥{stats.totalAmount.toLocaleString()}</Text>
              <Text className='count'>{stats.totalCount}笔交易</Text>
            </View>

            {/* 支付方式 */}
            <View className='method-cards'>
              <View className='method-card wechat'>
                <Text className='icon'>💚</Text>
                <Text className='label'>微信</Text>
                <Text className='amount'>¥{stats.byMethod.wechat.toLocaleString()}</Text>
              </View>
              <View className='method-card alipay'>
                <Text className='icon'>💙</Text>
                <Text className='label'>支付宝</Text>
                <Text className='amount'>¥{stats.byMethod.alipay.toLocaleString()}</Text>
              </View>
              <View className='method-card cash'>
                <Text className='icon'>💵</Text>
                <Text className='label'>现金</Text>
                <Text className='amount'>¥{stats.byMethod.cash.toLocaleString()}</Text>
              </View>
              <View className='method-card transfer'>
                <Text className='icon'>🏦</Text>
                <Text className='label'>转账</Text>
                <Text className='amount'>¥{stats.byMethod.transfer.toLocaleString()}</Text>
              </View>
            </View>

            {/* 最近交易 */}
            <View className='section'>
              <Text className='section-title'>最近交易</Text>
              {filteredPayments.slice(0, 5).map(payment => (
                <View key={payment.id} className='payment-row'>
                  <View className='info'>
                    <Text className='name'>{payment.studentName}</Text>
                    <Text className='meta'>{payment.studentClass} · {formatDate(payment.paymentDate)}</Text>
                  </View>
                  <Text className='amount'>¥{payment.amount.toLocaleString()}</Text>
                </View>
              ))}
              {filteredPayments.length === 0 && (
                <View className='empty'>
                  <Text>暂无交易记录</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 记录列表 - 简化版，隐藏敏感操作 */}
        {activeTab === 'list' && (
          <View className='list-view'>
            {filteredPayments.map(payment => (
              <View key={payment.id} className='payment-card'>
                <View className='card-header'>
                  <View className='student'>
                    <Text className='name'>{payment.studentName}</Text>
                    <Text className='class'>{payment.studentClass}</Text>
                  </View>
                  <Text className='amount'>¥{payment.amount.toLocaleString()}</Text>
                </View>
                
                <View className='card-body'>
                  <View className='info-row'>
                    <Text className='label'>支付方式</Text>
                    <Text className='value'>{getMethodIcon(payment.paymentMethod)} {getMethodLabel(payment.paymentMethod)}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>缴费项目</Text>
                    <Text className='value'>{payment.feeDetails?.map(f => f.label).join('、') || '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>缴费时间</Text>
                    <Text className='value'>{new Date(payment.paymentDate).toLocaleString()}</Text>
                  </View>
                </View>

                {/* 仅管理员显示删除按钮 */}
                {isAdmin && (
                  <View className='card-footer'>
                    <View className='delete-btn' onClick={() => deletePayment(payment.id)}>
                      <Text>🗑️ 删除</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
            {filteredPayments.length === 0 && (
              <View className='empty-large'>
                <Text className='icon'>📭</Text>
                <Text className='text'>暂无缴费记录</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: '150rpx' }}></View>
      </ScrollView>

      {/* 新建按钮 */}
      <View className='fab' onClick={() => Taro.navigateTo({ url: '/pages/finance/payment' })}>
        <Text>+ 新建收费</Text>
      </View>
    </View>
  )
}
