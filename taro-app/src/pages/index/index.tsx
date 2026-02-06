import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { safeGo } from '../../utils/nav'
import { downloadAllData, isAliyunConfigured } from '../../services/aliyunOssService'
import { downloadAttendance } from '../../services/cloudSyncService'
import { filterStudentsByPermission, getPermissionHint, isAdmin, getAccessibleClasses } from '../../services/permissionService'
import Icon from '../../components/Icon'
import logoImg from '../../assets/logo.png'
import './index.scss'

interface Student {
  id: string
  name: string
  class: string
}

interface DashboardData {
  totalStudents: number
  totalTeachers: number
  todayPresent: number
  todayAbsent: number
  todaySick: number
  todayLeave: number
  todayLate: number
  todayHealthRecords: number
  todayHighTemp: number
  monthPayments: number
  recentPayments: any[]
  classSummary: { name: string; count: number }[]
  attendanceRate: number
}

export default function Index() {
  const [data, setData] = useState<DashboardData>({
    totalStudents: 0,
    totalTeachers: 0,
    todayPresent: 0,
    todayAbsent: 0,
    todaySick: 0,
    todayLeave: 0,
    todayLate: 0,
    todayHealthRecords: 0,
    todayHighTemp: 0,
    monthPayments: 0,
    recentPayments: [],
    classSummary: [],
    attendanceRate: 0
  })
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [permissionInfo, setPermissionInfo] = useState('')
  const [userClasses, setUserClasses] = useState<string[]>([])
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const today = new Date().toISOString().split('T')[0]

  useGlobalShare({ title: '金星幼儿园 - 智慧校园管理', path: '/pages/index/index' })

  useEffect(() => {
    // 启动时强制从云端拉取最新数据
    forceRefreshFromCloud()
    loadUser()
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
  }, [])

  // 强制从云端拉取数据（每次启动都执行）
  const forceRefreshFromCloud = async () => {
    if (!isAliyunConfigured) {
      loadData()
      return
    }
    
    try {
      const result = await downloadAllData()
      if (result.success) {
        console.log(`[Index] 云端数据已刷新: ${result.students}学生, ${result.staff}教职工`)
      }
    } catch (err) {
      console.log('[Index] 云端刷新跳过:', err)
    }
    // 无论成功失败都加载本地数据显示
    loadData()
  }

  // 手动同步数据
  const handleSync = async () => {
    if (!isAliyunConfigured) {
      setSyncError('云端未配置')
      return
    }
    
    setSyncing(true)
    setSyncError('')
    
    try {
      const result = await downloadAllData()
      if (result.success) {
        loadData()
        Taro.showToast({ title: `同步成功: ${result.students}学生, ${result.staff}教职工`, icon: 'none', duration: 3000 })
      } else {
        setSyncError(result.error || '同步失败')
        Taro.showToast({ title: result.error || '同步失败', icon: 'none' })
      }
    } catch (err: any) {
      console.error('[Index] 同步异常:', err)
      setSyncError(err.message || '网络错误')
    } finally {
      setSyncing(false)
    }
  }

  useDidShow(() => {
    loadData()
  })

  const loadUser = () => {
    const user = Taro.getStorageSync('kt_current_user')
    setCurrentUser(user)
    // 加载权限信息
    setPermissionInfo(getPermissionHint(user))
    setUserClasses(getAccessibleClasses(user))
  }

  const loadData = async () => {
    // 学生数据 - 应用权限过滤
    const allStudents: Student[] = Taro.getStorageSync('kt_students') || []
    const students = filterStudentsByPermission(allStudents)
    
    // 教职工数据
    const teachers = Taro.getStorageSync('kt_staff') || []
    
    // 今日考勤 - 先加载本地数据
    let todayAttendance = Taro.getStorageSync(`kt_attendance_${today}`) || {}
    
    // 从云端同步最新考勤数据
    try {
      const result = await downloadAttendance(today)
      if (result.success && result.data && Object.keys(result.data).length > 0) {
        todayAttendance = { ...todayAttendance, ...result.data }
        Taro.setStorageSync(`kt_attendance_${today}`, todayAttendance)
        console.log('[Index] 考勤数据已从云端同步:', Object.keys(result.data).length, '条')
      }
    } catch (err) {
      console.log('[Index] 考勤云同步跳过:', err)
    }
    const studentIds = new Set(students.map(s => s.id))
    const filteredAttendance = Object.entries(todayAttendance).filter(([id]) => studentIds.has(id))
    const presentCount = filteredAttendance.filter(([, r]: any) => r.status === 'present').length
    const absentCount = filteredAttendance.filter(([, r]: any) => r.status === 'absent').length
    const sickCount = filteredAttendance.filter(([, r]: any) => r.status === 'sick').length
    const leaveCount = filteredAttendance.filter(([, r]: any) => r.status === 'leave').length
    const lateCount = filteredAttendance.filter(([, r]: any) => r.status === 'late').length
    
    // 计算出勤率
    const totalRecords = filteredAttendance.length
    const attendanceRate = students.length > 0 
      ? Math.round((presentCount + lateCount) / students.length * 100) 
      : 0
    
    // 今日健康记录
    const todayHealth = Taro.getStorageSync(`kt_health_${today}`) || {}
    const filteredHealth = Object.entries(todayHealth).filter(([id]) => studentIds.has(id))
    const healthRecordsCount = filteredHealth.length
    // 体温偏高（>37.3）
    const highTempCount = filteredHealth.filter(([, r]: any) => {
      const temp = r.morningTemp || r.noonTemp || 0
      return temp > 37.3
    }).length
    
    // 缴费记录
    const payments = Taro.getStorageSync('kt_payments') || Taro.getStorageSync('kt_fee_payments') || []
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthPayments = payments.filter((p: any) => p.paymentDate?.startsWith(currentMonth))
    const monthTotal = monthPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    
    // 班级统计 - 基于权限过滤后的数据（兼容class和className字段）
    const classMap = students.reduce((acc, s: any) => {
      const cls = s.class || s.className || '未分班'
      acc[cls] = (acc[cls] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const classSummary = Object.entries(classMap).map(([name, count]) => ({ name, count }))
    
    setData({
      totalStudents: students.length,
      totalTeachers: teachers.length,
      todayPresent: presentCount,
      todayAbsent: absentCount,
      todaySick: sickCount,
      todayLeave: leaveCount,
      todayLate: lateCount,
      todayHealthRecords: healthRecordsCount,
      todayHighTemp: highTempCount,
      monthPayments: monthTotal,
      recentPayments: payments.slice(0, 5),
      classSummary,
      attendanceRate
    })
  }

  // 根据角色显示不同的快捷操作 - 使用 useMemo 确保 currentUser 更新时重新计算
  const quickActions = useMemo(() => {
    const role = currentUser?.role || 'TEACHER'
    
    // 管理员和超级管理员的操作
    const adminActions = [
      { icon: 'attendance', label: '考勤', path: '/pages/students/attendance' },
      { icon: 'thermometer', label: '健康', path: '/pages/students/health' },
      { icon: 'car', label: '接送', path: '/pages/students/pickup' },
      { icon: 'wallet', label: '收费', path: '/pages/finance/payment' },
      { icon: 'users', label: '学生', path: '/pages/students/index' },
      { icon: 'teacher', label: '教职工', path: '/pages/staff/index' },
      { icon: 'chart', label: '统计', path: '/pages/students/stats' },
      { icon: 'meal', label: '食谱', path: '/pages/kitchen/index' },
    ]
    
    // 教师的操作
    const teacherActions = [
      { icon: 'attendance', label: '考勤', path: '/pages/students/attendance' },
      { icon: 'thermometer', label: '健康', path: '/pages/students/health' },
      { icon: 'car', label: '接送', path: '/pages/students/pickup' },
      { icon: 'users', label: '学生', path: '/pages/students/index' },
      { icon: 'seedling', label: '成长', path: '/pages/growth/index' },
      { icon: 'meal', label: '食谱', path: '/pages/kitchen/index' },
    ]
    
    // 厨房人员的操作
    const kitchenActions = [
      { icon: 'meal', label: '食谱管理', path: '/pages/kitchen/index' },
      { icon: 'alert-triangle', label: '过敏信息', path: '/pages/students/allergies' },
      { icon: 'users', label: '用餐人数', path: '/pages/students/index' },
    ]
    
    // 家长的操作
    const parentActions = [
      { icon: 'user', label: '我的孩子', path: '/pages/growth/index' },
      { icon: 'meal', label: '今日食谱', path: '/pages/kitchen/index' },
      { icon: 'calendar', label: '考勤记录', path: '/pages/students/attendance' },
      { icon: 'receipt', label: '缴费记录', path: '/pages/finance/payment' },
    ]
    
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return adminActions
      case 'TEACHER':
        return teacherActions
      case 'KITCHEN':
        return kitchenActions
      case 'PARENT':
        return parentActions
      default:
        return teacherActions
    }
  }, [currentUser])

  const navigateTo = (path: string) => {
    safeGo(path)
  }

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return (
    <View className='index-page'>
      <ScrollView className='content' scrollY>
        {/* 页面头部 */}
        <View className='page-header' style={{ paddingTop: `${statusBarHeight + 8}px` }}>
          <View className='header-left'>
            <Image className='logo-image' src={logoImg} mode='aspectFit' />
            <View className='welcome-text'>
              <Text className='greeting'>欢迎回来</Text>
              <Text className='user-name'>{currentUser?.name || '用户'}</Text>
            </View>
          </View>
          <View className='user-avatar' onClick={() => safeGo('/pages/profile/index')}>
            <Text>{currentUser?.name?.[0] || '👤'}</Text>
          </View>
        </View>

        {/* 快捷操作 */}
        <View className='quick-actions'>
          {quickActions.map(action => (
            <View key={action.label} className='action-item' onClick={() => navigateTo(action.path)}>
              <View className='icon-wrap'>
                <Icon name={action.icon} size={56} color='ffffff' />
              </View>
              <Text className='label'>{action.label}</Text>
            </View>
          ))}
        </View>

        {/* 数据同步（调试用） */}
        {(data.totalStudents === 0 || data.totalTeachers === 0) && (
          <View className='section' style={{ padding: '20rpx', background: '#fff8e6', borderRadius: '16rpx', marginBottom: '20rpx' }}>
            <Text style={{ fontSize: '26rpx', color: '#666' }}>数据为空，请点击同步</Text>
            <Button 
              onClick={handleSync} 
              loading={syncing}
              style={{ marginTop: '16rpx', background: '#4CAF50', color: '#fff', fontSize: '28rpx' }}
            >
              {syncing ? '同步中...' : '🔄 从云端同步数据'}
            </Button>
            {syncError && <Text style={{ color: 'red', fontSize: '24rpx', marginTop: '10rpx' }}>错误: {syncError}</Text>}
          </View>
        )}

        {/* 今日概览 - 新设计 */}
        <View className='overview-section'>
          <View className='overview-header'>
            <View className='header-left'>
              <Text className='overview-title'>📊 今日概览</Text>
              <Text className='overview-date'>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</Text>
            </View>
            <View className='sync-btn' onClick={handleSync}>
              <Text>{syncing ? '同步中...' : '🔄'}</Text>
            </View>
          </View>
          
          {/* 权限提示 */}
          {permissionInfo && (
            <View className='permission-bar'>
              <Text className='permission-icon'>{isAdmin(currentUser) ? '👔' : '👩‍🏫'}</Text>
              <Text className='permission-text'>{permissionInfo}</Text>
              {userClasses.length > 0 && !isAdmin(currentUser) && (
                <View className='class-badges'>
                  {userClasses.slice(0, 3).map(cls => (
                    <Text key={cls} className='class-badge'>{cls}</Text>
                  ))}
                  {userClasses.length > 3 && <Text className='class-badge more'>+{userClasses.length - 3}</Text>}
                </View>
              )}
            </View>
          )}
          
          <View className='overview-cards'>
            <View className='overview-card students' onClick={() => safeGo('/pages/students/index')}>
              <View className='card-icon'>👦</View>
              <View className='card-content'>
                <Text className='card-number'>{data.totalStudents}</Text>
                <Text className='card-label'>在园学生</Text>
              </View>
              <View className='card-arrow'>›</View>
            </View>
            
            <View className='overview-card teachers' onClick={() => safeGo('/pages/staff/index')}>
              <View className='card-icon'>👩‍🏫</View>
              <View className='card-content'>
                <Text className='card-number'>{data.totalTeachers}</Text>
                <Text className='card-label'>教职工</Text>
              </View>
              <View className='card-arrow'>›</View>
            </View>
            
            <View className='overview-card attendance' onClick={() => safeGo('/pages/students/attendance')}>
              <View className='card-icon'>✅</View>
              <View className='card-content'>
                <Text className='card-number'>{data.todayPresent}<Text className='card-unit'>人</Text></Text>
                <Text className='card-label'>今日出勤</Text>
              </View>
              <View className='attendance-bar'>
                <View 
                  className='bar-fill' 
                  style={{ width: `${data.attendanceRate}%` }}
                />
              </View>
              <Text className='attendance-rate'>{data.attendanceRate}%</Text>
            </View>
          </View>
          
          {/* 今日详细数据 - 仅管理员可见 */}
          {isAdmin(currentUser) && (
            <View className='today-detail'>
              <Text className='detail-title'>📋 今日详情</Text>
              <View className='detail-grid'>
                <View className='detail-item present' onClick={() => safeGo('/pages/students/attendance')}>
                  <Text className='detail-icon'>✅</Text>
                  <Text className='detail-value'>{data.todayPresent}</Text>
                  <Text className='detail-label'>出勤</Text>
                </View>
                <View className='detail-item late' onClick={() => safeGo('/pages/students/attendance')}>
                  <Text className='detail-icon'>⏰</Text>
                  <Text className='detail-value'>{data.todayLate}</Text>
                  <Text className='detail-label'>迟到</Text>
                </View>
                <View className='detail-item sick' onClick={() => safeGo('/pages/students/attendance')}>
                  <Text className='detail-icon'>🏥</Text>
                  <Text className='detail-value'>{data.todaySick}</Text>
                  <Text className='detail-label'>病假</Text>
                </View>
                <View className='detail-item leave' onClick={() => safeGo('/pages/students/attendance')}>
                  <Text className='detail-icon'>📝</Text>
                  <Text className='detail-value'>{data.todayLeave}</Text>
                  <Text className='detail-label'>事假</Text>
                </View>
                <View className='detail-item absent' onClick={() => safeGo('/pages/students/attendance')}>
                  <Text className='detail-icon'>❌</Text>
                  <Text className='detail-value'>{data.todayAbsent}</Text>
                  <Text className='detail-label'>缺勤</Text>
                </View>
                <View className='detail-item health' onClick={() => safeGo('/pages/students/health')}>
                  <Text className='detail-icon'>💊</Text>
                  <Text className='detail-value'>{data.todayHealthRecords}</Text>
                  <Text className='detail-label'>健康记录</Text>
                </View>
              </View>
              
              {/* 异常提醒 */}
              {data.todayHighTemp > 0 && (
                <View className='alert-bar' onClick={() => safeGo('/pages/students/health')}>
                  <Text className='alert-icon'>🌡️</Text>
                  <Text className='alert-text'>今日有 {data.todayHighTemp} 名学生体温偏高（＞37.3°C）</Text>
                  <Text className='alert-arrow'>›</Text>
                </View>
              )}
            </View>
          )}
          
          {/* 厨房用餐数据 - 厨房人员可见 */}
          {currentUser?.role === 'KITCHEN' && (
            <View className='kitchen-meal-section'>
              <Text className='section-title'>🍽️ 今日用餐</Text>
              <View className='meal-cards'>
                <View className='meal-card main'>
                  <View className='meal-icon'>👨‍🍳</View>
                  <View className='meal-info'>
                    <Text className='meal-number'>{data.todayPresent + data.todayLate}</Text>
                    <Text className='meal-label'>今日用餐人数</Text>
                  </View>
                  <Text className='meal-hint'>出勤 {data.todayPresent} + 迟到 {data.todayLate}</Text>
                </View>
                <View className='meal-stats'>
                  <View className='meal-stat' onClick={() => safeGo('/pages/students/allergies')}>
                    <Text className='stat-icon'>⚠️</Text>
                    <Text className='stat-label'>过敏信息</Text>
                    <Text className='stat-arrow'>›</Text>
                  </View>
                  <View className='meal-stat' onClick={() => safeGo('/pages/kitchen/index')}>
                    <Text className='stat-icon'>📋</Text>
                    <Text className='stat-label'>今日食谱</Text>
                    <Text className='stat-arrow'>›</Text>
                  </View>
                </View>
              </View>
              <View className='meal-time-hint'>
                <Text className='time-icon'>🕐</Text>
                <Text className='time-text'>数据更新时间: {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 班级分布 */}
        {data.classSummary.length > 0 && (
          <View className='section'>
            <View className='section-header'>
              <Text className='section-title'>🏫 班级分布</Text>
              <Text className='more' onClick={() => safeGo('/pages/students/index')}>查看全部 &gt;</Text>
            </View>
            <View className='class-grid'>
              {data.classSummary.map(cls => (
                <View 
                  key={cls.name} 
                  className='class-item clickable'
                  onClick={() => safeGo(`/pages/students/index?class=${encodeURIComponent(cls.name)}`)}
                >
                  <Text className='class-name'>{cls.name}</Text>
                  <Text className='class-count'>{cls.count}人</Text>
                  <Text className='class-arrow'>›</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 最近缴费 */}
        {data.recentPayments.length > 0 && (
          <View className='section'>
            <View className='section-header'>
              <Text className='section-title'>💳 最近缴费</Text>
              <Text className='more' onClick={() => safeGo('/pages/finance/index')}>查看全部 &gt;</Text>
            </View>
            <View className='payment-list'>
              {data.recentPayments.map((payment, index) => (
                <View key={index} className='payment-item'>
                  <View className='payment-info'>
                    <Text className='student-name'>{payment.studentName}</Text>
                    <Text className='payment-date'>{formatDate(payment.paymentDate)}</Text>
                  </View>
                  <Text className='payment-amount'>¥{payment.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 功能导航 - 新设计 */}
        <View className='nav-section'>
          <Text className='nav-section-title'>🧭 功能导航</Text>
          
          <View className='nav-categories'>
            {/* 日常管理 */}
            {['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(currentUser?.role) && (
              <View className='nav-category'>
                <Text className='category-title'>日常管理</Text>
                <View className='category-items'>
                  <View className='nav-card' onClick={() => navigateTo('/pages/students/index')}>
                    <Text className='nav-emoji'>📋</Text>
                    <Text className='nav-text'>学生档案</Text>
                  </View>
                  <View className='nav-card' onClick={() => navigateTo('/pages/students/health')}>
                    <Text className='nav-emoji'>🌡️</Text>
                    <Text className='nav-text'>健康打卡</Text>
                  </View>
                  <View className='nav-card' onClick={() => navigateTo('/pages/students/pickup')}>
                    <Text className='nav-emoji'>🚗</Text>
                    <Text className='nav-text'>接送管理</Text>
                  </View>
                  <View className='nav-card' onClick={() => navigateTo('/pages/growth/index')}>
                    <Text className='nav-emoji'>🌱</Text>
                    <Text className='nav-text'>成长档案</Text>
                  </View>
                </View>
              </View>
            )}
            
            {/* 管理功能 */}
            {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && (
              <View className='nav-category'>
                <Text className='category-title'>园务管理</Text>
                <View className='category-items'>
                  <View className='nav-card' onClick={() => safeGo('/pages/staff/index')}>
                    <Text className='nav-emoji'>👩‍🏫</Text>
                    <Text className='nav-text'>教职工</Text>
                  </View>
                  <View className='nav-card' onClick={() => navigateTo('/pages/finance/index')}>
                    <Text className='nav-emoji'>💰</Text>
                    <Text className='nav-text'>财务报表</Text>
                  </View>
                  <View className='nav-card' onClick={() => navigateTo('/pages/students/stats')}>
                    <Text className='nav-emoji'>📊</Text>
                    <Text className='nav-text'>数据统计</Text>
                  </View>
                  <View className='nav-card' onClick={() => navigateTo('/pages/students/disease')}>
                    <Text className='nav-emoji'>🛡️</Text>
                    <Text className='nav-text'>疾病管理</Text>
                  </View>
                </View>
              </View>
            )}
            
            {/* 厨房功能 */}
            {['SUPER_ADMIN', 'ADMIN', 'KITCHEN'].includes(currentUser?.role) && (
              <View className='nav-category'>
                <Text className='category-title'>厨房管理</Text>
                <View className='category-items'>
                  <View className='nav-card' onClick={() => navigateTo('/pages/kitchen/index')}>
                    <Text className='nav-emoji'>🍽️</Text>
                    <Text className='nav-text'>食谱编辑</Text>
                  </View>
                  <View className='nav-card' onClick={() => navigateTo('/pages/students/disinfect')}>
                    <Text className='nav-emoji'>🧹</Text>
                    <Text className='nav-text'>消毒记录</Text>
                  </View>
                </View>
              </View>
            )}
            
            {/* 通用功能 */}
            <View className='nav-category'>
              <Text className='category-title'>更多服务</Text>
              <View className='category-items'>
                <View className='nav-card' onClick={() => navigateTo('/pages/kitchen/index')}>
                  <Text className='nav-emoji'>📅</Text>
                  <Text className='nav-text'>本周食谱</Text>
                </View>
                <View className='nav-card' onClick={() => navigateTo('/pages/profile/index')}>
                  <Text className='nav-emoji'>👤</Text>
                  <Text className='nav-text'>个人中心</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 底部留白 */}
        <View style={{ height: '40rpx' }} />
      </ScrollView>
    </View>
  )
}
