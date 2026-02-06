import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { subscribeAll, isNotificationConfigured } from '../../services/notificationService'
import {
  checkAliyunHealth,
  getSyncStatus,
  isAliyunConfigured,
  downloadAllData,
  uploadAuthorizedPhones,
  uploadUsers,
  STORAGE_KEYS
} from '../../services/aliyunOssService'
import { isAdmin } from '../../services/permissionService'
import { safeGo } from '../../utils/nav'
import './index.scss'

interface User {
  id: string
  phone: string
  name: string
  role: string
  campus?: string
  assignedClasses?: string[]
}

export default function Profile() {
  useGlobalShare({ title: '金星幼儿园 - 个人中心', path: '/pages/profile/index' })
  const [user, setUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState('')
  const [cloudStatus, setCloudStatus] = useState<{
    isOnline: boolean
    latency?: number
    lastSync?: string
  }>({
    isOnline: false
  })
  const [localDataCount, setLocalDataCount] = useState({ students: 0, staff: 0 })
  
  // 管理员功能状态
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [authorizedPhones, setAuthorizedPhones] = useState<string[]>([])
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    loadUser()
    checkCloud()
    loadLocalDataCount()
    loadAuthorizedPhones()
  }, [])

  const loadUser = () => {
    const userData = Taro.getStorageSync('kt_current_user')
    if (userData) {
      setUser(userData)
      setEditName(userData.name)
      setUserIsAdmin(isAdmin(userData))
    }
  }
  
  // 加载授权手机号列表
  const loadAuthorizedPhones = () => {
    const phones = Taro.getStorageSync('kt_authorized_phones') || []
    setAuthorizedPhones(phones)
  }
  
  // 添加授权手机号
  const handleAddPhone = async () => {
    if (!newPhone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (newPhone.length !== 11) {
      Taro.showToast({ title: '请输入11位手机号', icon: 'none' })
      return
    }
    if (authorizedPhones.includes(newPhone)) {
      Taro.showToast({ title: '该手机号已授权', icon: 'none' })
      return
    }
    
    const updated = [...authorizedPhones, newPhone]
    Taro.setStorageSync('kt_authorized_phones', updated)
    setAuthorizedPhones(updated)
    setNewPhone('')
    
    // 同步到云端
    if (isAliyunConfigured) {
      uploadAuthorizedPhones().then(result => {
        if (result.success) {
          console.log('[Profile] 授权手机号已同步到云端')
        }
      })
    }
    
    Taro.showToast({ title: '添加成功', icon: 'success' })
  }
  
  // 删除授权手机号
  const handleRemovePhone = (phone: string) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定取消 ${phone} 的注册授权吗？`,
      success: (res) => {
        if (res.confirm) {
          const updated = authorizedPhones.filter(p => p !== phone)
          Taro.setStorageSync('kt_authorized_phones', updated)
          setAuthorizedPhones(updated)
          
          // 同步到云端
          if (isAliyunConfigured) {
            uploadAuthorizedPhones().then(result => {
              if (result.success) {
                console.log('[Profile] 授权手机号删除已同步到云端')
              }
            })
          }
          
          Taro.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }

  const loadLocalDataCount = () => {
    const students = Taro.getStorageSync(STORAGE_KEYS.STUDENTS) || []
    const staff = Taro.getStorageSync(STORAGE_KEYS.STAFF) || []
    setLocalDataCount({ students: students.length, staff: staff.length })
  }

  const checkCloud = async () => {
    const syncStatus = getSyncStatus()
    setCloudStatus(prev => ({
      ...prev,
      lastSync: syncStatus.lastSyncTime || undefined
    }))

    if (isAliyunConfigured) {
      const health = await checkAliyunHealth()
      setCloudStatus(prev => ({
        ...prev,
        isOnline: health.isHealthy,
        latency: health.latency
      }))
      
      // 如果云端可用且本地无数据，自动同步
      if (health.isHealthy) {
        const students = Taro.getStorageSync(STORAGE_KEYS.STUDENTS) || []
        if (students.length === 0) {
          autoSync()
        }
      }
    }
  }

  // 自动同步（静默进行）
  const autoSync = async () => {
    if (isSyncing) return
    
    setIsSyncing(true)
    setSyncProgress('自动同步中...')
    
    try {
      const result = await downloadAllData()
      if (result.success) {
        Taro.setStorageSync('kt_last_sync_time', new Date().toISOString())
        loadLocalDataCount()
        checkCloud()
      }
    } catch (err) {
      console.error('[Profile] 自动同步失败:', err)
    } finally {
      setIsSyncing(false)
      setSyncProgress('')
    }
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      SUPER_ADMIN: '超级管理员',
      admin: '管理员',
      teacher: '教师',
      kitchen: '厨房',
      finance: '财务'
    }
    return labels[role] || role
  }

  const handleSaveName = () => {
    if (!editName.trim()) {
      Taro.showToast({ title: '姓名不能为空', icon: 'none' })
      return
    }

    if (user) {
      const updatedUser = { ...user, name: editName }
      Taro.setStorageSync('kt_current_user', updatedUser)
      
      const users = Taro.getStorageSync('kt_all_users') || []
      const index = users.findIndex((u: User) => u.id === user.id)
      if (index !== -1) {
        users[index] = updatedUser
        Taro.setStorageSync('kt_all_users', users)
      }
      
      setUser(updatedUser)
      setIsEditing(false)
      Taro.showToast({ title: '保存成功', icon: 'success' })
    }
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync('kt_current_user')
          Taro.redirectTo({ url: '/pages/login/index' })
        }
      }
    })
  }


  const getStorageInfo = () => {
    const info = Taro.getStorageInfoSync()
    return {
      currentSize: (info.currentSize / 1024).toFixed(2),
      limitSize: (info.limitSize / 1024).toFixed(2)
    }
  }

  const storageInfo = getStorageInfo()

  const menuItems = [
    { icon: '📱', label: '我的手机', value: user?.phone || '-' },
    { icon: '🏫', label: '所属园所', value: user?.campus || '金星幼儿园' },
    { icon: '👤', label: '角色权限', value: user ? getRoleLabel(user.role) : '-' },
  ]

  if (!user) {
    return (
      <View className='profile-page'>
        <View className='not-logged'>
          <Text className='icon'>👤</Text>
          <Text className='text'>未登录</Text>
          <View className='login-btn' onClick={() => Taro.redirectTo({ url: '/pages/login/index' })}>
            <Text>去登录</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='profile-page'>
      {/* 用户卡片 */}
      <View className='user-card'>
        <View className='avatar'>
          <Text>{user.name.slice(0, 1)}</Text>
        </View>
        <View className='info'>
          {isEditing ? (
            <View className='edit-row'>
              <Input
                className='name-input'
                value={editName}
                onInput={(e) => setEditName(e.detail.value)}
                focus
              />
              <View className='edit-btns'>
                <Text className='cancel' onClick={() => { setIsEditing(false); setEditName(user.name) }}>取消</Text>
                <Text className='save' onClick={handleSaveName}>保存</Text>
              </View>
            </View>
          ) : (
            <View className='name-row' onClick={() => setIsEditing(true)}>
              <Text className='name'>{user.name}</Text>
              <Text className='edit-icon'>✏️</Text>
            </View>
          )}
          <Text className='role'>{getRoleLabel(user.role)}</Text>
        </View>
      </View>

      <ScrollView className='content' scrollY>
        {/* 数据同步状态 */}
        <View className='section cloud-section'>
          <Text className='section-title'>☁️ 数据同步</Text>
          
          <View className='cloud-status'>
            <View className='status-row'>
              <Text className='label'>云端状态</Text>
              <View className='status-indicator'>
                <View className={`dot ${cloudStatus.isOnline ? 'online' : 'offline'}`} />
                <Text className={cloudStatus.isOnline ? 'online' : 'offline'}>
                  {isAliyunConfigured 
                    ? (cloudStatus.isOnline ? '已连接' : '连接中...') 
                    : '未配置'}
                </Text>
              </View>
            </View>
            
            <View className='status-row'>
              <Text className='label'>本地数据</Text>
              <Text className='value'>学生 {localDataCount.students} 人，教职工 {localDataCount.staff} 人</Text>
            </View>
            
            {cloudStatus.lastSync && (
              <View className='status-row'>
                <Text className='label'>上次同步</Text>
                <Text className='value'>{new Date(cloudStatus.lastSync).toLocaleString()}</Text>
              </View>
            )}
          </View>

          {isSyncing && (
            <View className='sync-status'>
              <Text className='syncing-text'>🔄 {syncProgress || '同步中...'}</Text>
            </View>
          )}
          
          <Text className='sync-hint'>
            数据会在打开小程序时自动同步
          </Text>
        </View>

        {/* 基本信息 */}
        <View className='section'>
          <Text className='section-title'>基本信息</Text>
          {menuItems.map((item, index) => (
            <View key={index} className='menu-item'>
              <Text className='icon'>{item.icon}</Text>
              <Text className='label'>{item.label}</Text>
              <Text className='value'>{item.value}</Text>
            </View>
          ))}
        </View>
        
        {/* 消息订阅 */}
        <View className='section'>
          <Text className='section-title'>消息通知</Text>
          <View className='menu-item clickable' onClick={async () => {
            if (!isNotificationConfigured()) {
              Taro.showToast({ title: '通知模板配置中', icon: 'none' })
              return
            }
            const res = await subscribeAll()
            if (res.success) {
              Taro.showToast({ title: '订阅成功', icon: 'success' })
            }
          }}>
            <Text className='icon'>🔔</Text>
            <Text className='label'>订阅消息提醒</Text>
            <Text className='value'>考勤/食谱/缴费</Text>
            <Text className='arrow'>›</Text>
          </View>
        </View>

        {/* 管理员功能 - 仅管理员可见 */}
        {userIsAdmin && (
          <View className='section admin-section'>
            <Text className='section-title'>👔 管理员功能</Text>
            
            <View className='menu-item clickable' onClick={() => safeGo('/pages/staff/index')}>
              <Text className='icon'>📋</Text>
              <Text className='label'>班级分配</Text>
              <Text className='arrow'>›</Text>
            </View>
            
            <View className='menu-item clickable' onClick={() => setShowPhoneModal(true)}>
              <Text className='icon'>📱</Text>
              <Text className='label'>授权手机号</Text>
              <Text className='value'>{authorizedPhones.length} 个</Text>
              <Text className='arrow'>›</Text>
            </View>
          </View>
        )}

        {/* 设置 */}
        <View className='section'>
          <Text className='section-title'>设置</Text>
          
          <View className='menu-item'>
            <Text className='icon'>📦</Text>
            <Text className='label'>存储空间</Text>
            <Text className='value'>{storageInfo.currentSize}KB / {storageInfo.limitSize}KB</Text>
          </View>
          
          
          <View className='menu-item'>
            <Text className='icon'>ℹ️</Text>
            <Text className='label'>版本</Text>
            <Text className='value'>v1.1.2</Text>
          </View>
        </View>

        {/* 退出登录 */}
        <View className='logout-btn' onClick={handleLogout}>
          <Text>退出登录</Text>
        </View>

        <View style={{ height: '100rpx' }}></View>
      </ScrollView>
      
      {/* 授权手机号管理弹窗 */}
      {showPhoneModal && (
        <View className='phone-modal-wrapper'>
          <View className='phone-modal-mask' onClick={() => setShowPhoneModal(false)} />
          <View className='phone-modal-box'>
            <View className='phone-modal-header'>
              <Text className='phone-modal-title'>📱 授权手机号管理</Text>
              <Text className='phone-modal-close' onClick={() => setShowPhoneModal(false)}>✕</Text>
            </View>
            
            <View className='phone-modal-body'>
              <Text className='phone-hint'>只有授权的手机号才能注册账号</Text>
              
              {/* 添加新手机号 */}
              <View className='phone-add-row'>
                <Input
                  className='phone-input'
                  type='number'
                  placeholder='输入11位手机号'
                  value={newPhone}
                  onInput={(e) => setNewPhone(e.detail.value)}
                  maxlength={11}
                />
                <Text className='phone-add-btn' onClick={handleAddPhone}>添加</Text>
              </View>
              
              {/* 手机号列表 */}
              <ScrollView className='phone-list' scrollY>
                {authorizedPhones.length === 0 ? (
                  <View className='phone-empty'>
                    <Text>暂无授权手机号</Text>
                    <Text className='phone-empty-hint'>添加手机号后，该号码可注册</Text>
                  </View>
                ) : (
                  authorizedPhones.map(phone => (
                    <View key={phone} className='phone-item'>
                      <Text className='phone-number'>{phone}</Text>
                      <Text className='phone-delete' onClick={() => handleRemovePhone(phone)}>删除</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
