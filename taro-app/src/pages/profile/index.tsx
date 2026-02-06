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
  const [authorizedPhones, setAuthorizedPhones] = useState<any[]>([])
  const [newPhone, setNewPhone] = useState('')
  const [phoneSearchQuery, setPhoneSearchQuery] = useState('')

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
  
  // 工具函数：提取手机号
  const getPhone = (p: any) => typeof p === 'string' ? p : p.phone
  const getName = (p: any) => typeof p === 'string' ? '' : (p.name || '')
  const getCampus = (p: any) => typeof p === 'string' ? '' : (p.campus || '')
  const getPosition = (p: any) => typeof p === 'string' ? '' : (p.position || '')
  const getClass = (p: any) => typeof p === 'string' ? '' : (p.assignedClass || '')
  const getGender = (p: any) => typeof p === 'string' ? '' : (p.gender || '')

  // 加载授权手机号列表（兼容新旧格式）
  const loadAuthorizedPhones = () => {
    const rawPhones = Taro.getStorageSync('kt_authorized_phones') || []
    if (rawPhones.length > 0 && typeof rawPhones[0] === 'string') {
      // 旧格式：尝试从教职工列表关联信息
      const staff = Taro.getStorageSync('kt_staff') || []
      const staffMap = new Map(staff.filter((s: any) => s.phone).map((s: any) => [s.phone.replace(/\D/g, ''), s]))
      const enriched = rawPhones.map((p: string) => {
        const clean = p.replace(/\D/g, '')
        const s: any = staffMap.get(clean)
        if (s) {
          return { phone: clean, name: s.name || '', gender: s.gender || '', campus: s.campus || '', position: s.position || s.role || '', assignedClass: s.class || '' }
        }
        return { phone: clean }
      })
      setAuthorizedPhones(enriched)
    } else {
      setAuthorizedPhones(rawPhones)
    }
  }
  
  // 从教职工导入到授权名单（与网页版一致）
  const handleImportStaff = async () => {
    const staff = Taro.getStorageSync('kt_staff') || []
    const teachers = Taro.getStorageSync('kt_teachers') || []
    const allStaff = staff.length >= teachers.length ? staff : teachers
    
    if (allStaff.length === 0) {
      Taro.showToast({ title: '暂无教职工数据', icon: 'none' })
      return
    }
    
    const existingPhones = new Set(authorizedPhones.map((p: any) => getPhone(p)))
    let addedCount = 0
    const newList: any[] = [...authorizedPhones]
    
    for (const s of allStaff) {
      if (!s.phone) continue
      const clean = s.phone.replace(/\D/g, '')
      if (clean.length !== 11 || existingPhones.has(clean)) continue
      
      newList.push({
        phone: clean,
        name: s.name || '',
        gender: s.gender || '',
        campus: s.campus || '',
        role: s.role || 'TEACHER',
        position: s.position || s.role || '',
        assignedClass: Array.isArray(s.assignedClasses) ? s.assignedClasses[0] : (s.class || ''),
        is_used: false,
        created_at: new Date().toISOString()
      })
      existingPhones.add(clean)
      addedCount++
    }
    
    Taro.setStorageSync('kt_authorized_phones', newList)
    setAuthorizedPhones(newList)
    
    if (isAliyunConfigured) {
      uploadAuthorizedPhones()
    }
    
    Taro.showToast({ title: `导入 ${addedCount} 人`, icon: 'success' })
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
    if (authorizedPhones.some((p: any) => getPhone(p) === newPhone)) {
      Taro.showToast({ title: '该手机号已授权', icon: 'none' })
      return
    }
    
    const newEntry = { phone: newPhone, name: '', campus: '', role: 'TEACHER', created_at: new Date().toISOString() }
    const updated = [...authorizedPhones, newEntry]
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
    const entry = authorizedPhones.find((p: any) => getPhone(p) === phone)
    const displayName = entry ? (getName(entry) ? `${getName(entry)}(${phone})` : phone) : phone
    Taro.showModal({
      title: '确认删除',
      content: `确定取消 ${displayName} 的注册授权吗？`,
      success: (res) => {
        if (res.confirm) {
          const updated = authorizedPhones.filter((p: any) => getPhone(p) !== phone)
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
              <Text className='phone-modal-title'>📱 授权名单管理</Text>
              <Text className='phone-modal-close' onClick={() => setShowPhoneModal(false)}>✕</Text>
            </View>
            
            <View className='phone-modal-body'>
              <Text className='phone-hint'>只有授权名单内的手机号才能注册，共 {authorizedPhones.length} 人</Text>
              
              {/* 操作按钮 */}
              <View className='phone-add-row'>
                <Text className='phone-import-btn' onClick={handleImportStaff}>从教职工导入</Text>
              </View>
              
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
              
              {/* 搜索 */}
              <View className='phone-add-row'>
                <Input
                  className='phone-input'
                  type='text'
                  placeholder='搜索姓名/手机号/园区...'
                  value={phoneSearchQuery}
                  onInput={(e) => setPhoneSearchQuery(e.detail.value)}
                />
              </View>
              
              {/* 授权名单列表 */}
              <ScrollView className='phone-list' scrollY>
                {authorizedPhones.length === 0 ? (
                  <View className='phone-empty'>
                    <Text>暂无授权名单</Text>
                    <Text className='phone-empty-hint'>点击"从教职工导入"批量添加</Text>
                  </View>
                ) : (
                  authorizedPhones
                    .filter((p: any) => {
                      if (!phoneSearchQuery) return true
                      const q = phoneSearchQuery.toLowerCase()
                      return getPhone(p).includes(q) || getName(p).includes(q) || getCampus(p).includes(q) || getClass(p).includes(q)
                    })
                    .map((p: any) => {
                      const phone = getPhone(p)
                      const name = getName(p)
                      const campus = getCampus(p)
                      const position = getPosition(p)
                      const cls = getClass(p)
                      const gender = getGender(p)
                      return (
                        <View key={phone} className='phone-item'>
                          <View className='phone-info'>
                            <View className='phone-name-row'>
                              <Text className='phone-person-name'>{name || '未填写'}</Text>
                              {gender && <Text className={`phone-gender ${gender === '男' ? 'male' : 'female'}`}>{gender}</Text>}
                            </View>
                            <Text className='phone-number'>{phone}</Text>
                            <View className='phone-tags'>
                              {campus && <Text className='phone-tag campus'>{campus}</Text>}
                              {position && <Text className='phone-tag position'>{position}</Text>}
                              {cls && <Text className='phone-tag cls'>{cls}</Text>}
                            </View>
                          </View>
                          <Text className='phone-delete' onClick={() => handleRemovePhone(phone)}>删除</Text>
                        </View>
                      )
                    })
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
