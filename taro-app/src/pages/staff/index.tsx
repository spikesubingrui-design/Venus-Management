import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { downloadFromAliyun, uploadToAliyun, uploadUsers, STORAGE_KEYS } from '../../services/aliyunOssService'
import { downloadStaffFromCloud } from '../../services/cloudSyncService'
import { isAdmin, getCurrentUser, ALL_CLASSES } from '../../services/permissionService'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './index.scss'

interface Teacher {
  id: string
  name: string
  phone: string
  role: string
  class?: string  // 兼容旧数据
  assignedClasses?: string[]  // 新：分配的班级列表
  hireDate?: string
  status?: 'active' | 'inactive'
}

export default function Staff() {
  useGlobalShare({ title: '金星幼儿园 - 教职工管理', path: '/pages/staff/index' })
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [searchText, setSearchText] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    phone: '',
    role: '教师',
    assignedClasses: [] as string[]
  })
  
  // 班级分配弹窗
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  
  // 当前用户是否是管理员
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [canEdit, setCanEdit] = useState(false) // 是否可以编辑（非厨师）

  const roles = ['教师', '保育员', '厨房', '保安', '园长', '副园长', '财务']
  const classes = ALL_CLASSES

  const [isSyncing, setIsSyncing] = useState(false)
  const [cloudDataLoaded, setCloudDataLoaded] = useState(false) // 标记云端数据是否已加载

  useEffect(() => {
    loadTeachers()
    checkPermissions()
  }, [])

  useDidShow(() => {
    loadTeachers()
    checkPermissions()
  })
  
  const checkPermissions = () => {
    const user = getCurrentUser()
    setUserIsAdmin(isAdmin(user))
    // 厨师不能编辑教职工信息
    const isKitchen = user?.role?.toUpperCase() === 'KITCHEN'
    setCanEdit(!isKitchen)
  }

  const loadTeachers = async () => {
    // 先从本地存储加载
    const localData = Taro.getStorageSync(STORAGE_KEYS.STAFF) || []
    setTeachers(localData)
    
    // 自动从云端同步最新数据（必须等待完成）
    try {
      const result = await downloadStaffFromCloud()
      if (result.success && result.data && result.data.length > 0) {
        setTeachers(result.data)
        setCloudDataLoaded(true)
        console.log('[Staff] 云端数据已同步:', result.data.length, '名')
      } else if (localData.length >= 20) {
        // 云端下载失败但本地数据足够多，允许操作
        setCloudDataLoaded(true)
        console.log('[Staff] 云端同步跳过，使用本地数据:', localData.length, '名')
      }
    } catch (err) {
      console.log('[Staff] 云端同步跳过:', err)
      if (localData.length >= 20) {
        setCloudDataLoaded(true)
      }
    }
  }

  // 从云端同步（只下载，不上传）
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const cloudData = await downloadFromAliyun<Teacher>(STORAGE_KEYS.STAFF)
      if (cloudData && cloudData.length > 0) {
        Taro.setStorageSync(STORAGE_KEYS.STAFF, cloudData)
        setTeachers(cloudData)
        setCloudDataLoaded(true)
        Taro.showToast({ title: `已同步 ${cloudData.length} 名教职工`, icon: 'success' })
      } else {
        Taro.showToast({ title: '云端暂无数据', icon: 'none' })
      }
    } catch (err) {
      console.error('[Staff] 同步失败:', err)
      Taro.showToast({ title: '同步失败', icon: 'none' })
    } finally {
      setIsSyncing(false)
    }
  }

  // 过滤教职工
  const filteredTeachers = teachers.filter(t =>
    t.name.includes(searchText) || t.phone.includes(searchText) || t.role.includes(searchText)
  )

  // 按角色分组
  const groupedTeachers = filteredTeachers.reduce((acc, teacher) => {
    const role = teacher.role || '其他'
    if (!acc[role]) acc[role] = []
    acc[role].push(teacher)
    return acc
  }, {} as Record<string, Teacher[]>)

  /**
   * 安全上传教职工数据
   * 必须满足：1）云端数据已加载 2）数据量不低于安全阈值
   */
  const safeUploadStaff = async (data: Teacher[]): Promise<boolean> => {
    if (!cloudDataLoaded) {
      console.warn('[Staff] ⚠️ 云端数据未加载，拒绝上传以防覆盖')
      Taro.showToast({ title: '数据同步中，请稍后重试', icon: 'none' })
      return false
    }
    if (data.length < 20) {
      console.warn(`[Staff] ⚠️ 数据量异常(${data.length}条<20)，拒绝上传以防覆盖云端数据`)
      Taro.showToast({ title: '数据异常，请重新同步', icon: 'none' })
      return false
    }
    const result = await uploadToAliyun(STORAGE_KEYS.STAFF, data)
    if (result.success) {
      console.log(`[Staff] ✅ 安全上传成功: ${data.length}条`)
    } else {
      console.error('[Staff] ❌ 上传失败:', result.error)
    }
    return result.success
  }

  // 添加教职工
  const handleAddTeacher = () => {
    if (!newTeacher.name.trim()) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!newTeacher.phone.trim() || newTeacher.phone.length !== 11) {
      Taro.showToast({ title: '请输入有效手机号', icon: 'none' })
      return
    }

    const teacher: Teacher = {
      id: `t_${Date.now()}`,
      name: newTeacher.name,
      phone: newTeacher.phone,
      role: newTeacher.role,
      assignedClasses: newTeacher.assignedClasses,
      class: newTeacher.assignedClasses[0] || '', // 兼容旧数据
      hireDate: new Date().toISOString().split('T')[0],
      status: 'active'
    }

    const updated = [...teachers, teacher]
    Taro.setStorageSync(STORAGE_KEYS.STAFF, updated)
    setTeachers(updated)
    setIsAddModalOpen(false)
    setNewTeacher({ name: '', phone: '', role: '教师', assignedClasses: [] })
    
    Taro.showToast({ title: '添加成功', icon: 'success' })
    
    // 安全同步到云端
    safeUploadStaff(updated)
  }
  
  // 打开班级分配弹窗
  const openAssignModal = (teacher: Teacher) => {
    if (!userIsAdmin) {
      Taro.showToast({ title: '仅管理员可分配班级', icon: 'none' })
      return
    }
    setSelectedTeacher(teacher)
    // 兼容旧数据：如果有 class 字段，转换为数组
    const currentClasses = teacher.assignedClasses || (teacher.class ? [teacher.class] : [])
    setSelectedClasses(currentClasses)
    setIsAssignModalOpen(true)
  }
  
  // 切换班级选择
  const toggleClassSelection = (cls: string) => {
    setSelectedClasses(prev => 
      prev.includes(cls) 
        ? prev.filter(c => c !== cls) 
        : [...prev, cls]
    )
  }
  
  // 保存班级分配
  const saveAssignment = async () => {
    if (!selectedTeacher) return
    
    const updatedTeachers = teachers.map(t => {
      if (t.id === selectedTeacher.id) {
        return {
          ...t,
          assignedClasses: selectedClasses,
          class: selectedClasses[0] || '' // 兼容旧数据
        }
      }
      return t
    })
    
    Taro.setStorageSync(STORAGE_KEYS.STAFF, updatedTeachers)
    setTeachers(updatedTeachers)
    setIsAssignModalOpen(false)
    setSelectedTeacher(null)
    
    Taro.showToast({ title: '分配成功', icon: 'success' })
    
    // 安全同步到云端
    safeUploadStaff(updatedTeachers)
    
    // 同时更新用户列表中的班级分配
    const users = Taro.getStorageSync('kt_all_users') || []
    const userIndex = users.findIndex((u: any) => u.phone === selectedTeacher.phone)
    if (userIndex !== -1) {
      users[userIndex].assignedClasses = selectedClasses
      Taro.setStorageSync('kt_all_users', users)
      
      // 同步用户数据到云端
      uploadUsers().then(result => {
        if (result.success) {
          console.log('[Staff] 用户班级分配已同步到云端')
        }
      })
    }
  }

  // 删除教职工
  const deleteTeacher = (teacher: Teacher) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定删除 ${teacher.name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const updated = teachers.filter(t => t.id !== teacher.id)
          Taro.setStorageSync(STORAGE_KEYS.STAFF, updated)
          setTeachers(updated)
          Taro.showToast({ title: '删除成功', icon: 'success' })
          
          // 安全同步到云端（不再使用forceUpload）
          safeUploadStaff(updated)
        }
      }
    })
  }

  // 拨打电话
  const callPhone = (phone: string) => {
    Taro.makePhoneCall({ phoneNumber: phone })
  }

  return (
    <View className='staff-page'>
      <NavBar title='教职工管理' />
      <NavBarPlaceholder />
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input'>
          <Text className='icon'>🔍</Text>
          <Input
            placeholder='搜索姓名、电话或角色'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
          />
        </View>
        <View 
          className={`sync-btn ${isSyncing ? 'syncing' : ''}`} 
          onClick={!isSyncing ? handleSync : undefined}
        >
          <Text>{isSyncing ? '...' : '🔄'}</Text>
        </View>
        {canEdit && (
          <View className='add-btn' onClick={() => setIsAddModalOpen(true)}>
            <Text>+</Text>
          </View>
        )}
      </View>

      {/* 统计 */}
      <View className='stats-bar'>
        <Text>共 {filteredTeachers.length} 名教职工</Text>
        {teachers.length === 0 && <Text className='hint'>点击 🔄 从云端同步</Text>}
      </View>

      {/* 列表 */}
      <ScrollView className='staff-list' scrollY>
        {Object.entries(groupedTeachers).map(([role, list]) => (
          <View key={role} className='role-group'>
            <View className='role-header'>
              <Text className='role-name'>{role}</Text>
              <Text className='count'>{list.length}人</Text>
            </View>
            {list.map(teacher => {
              // 获取班级显示文字
              const classDisplay = teacher.assignedClasses?.length 
                ? teacher.assignedClasses.join('、')
                : (teacher.class || '未分配班级')
              
              return (
                <View key={teacher.id} className='staff-card'>
                  <View className='avatar'>
                    <Text>{teacher.name.slice(0, 1)}</Text>
                  </View>
                  <View className='info' onClick={() => openAssignModal(teacher)}>
                    <Text className='name'>{teacher.name}</Text>
                    <Text className='meta'>{teacher.phone}</Text>
                    <View className='class-tags'>
                      {(teacher.assignedClasses?.length || teacher.class) ? (
                        (teacher.assignedClasses || [teacher.class]).filter(Boolean).map(cls => (
                          <Text key={cls} className='class-tag'>{cls}</Text>
                        ))
                      ) : (
                        <Text className='class-tag empty'>未分配班级</Text>
                      )}
                    </View>
                  </View>
                  <View className='actions'>
                    {userIsAdmin && (
                      <View className='action-btn assign' onClick={() => openAssignModal(teacher)}>
                        <Text>📋</Text>
                      </View>
                    )}
                    <View className='action-btn call' onClick={() => callPhone(teacher.phone)}>
                      <Text>📞</Text>
                    </View>
                    {canEdit && (
                      <View className='action-btn delete' onClick={() => deleteTeacher(teacher)}>
                        <Text>🗑️</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        ))}

        {filteredTeachers.length === 0 && (
          <View className='empty'>
            <Text className='icon'>👥</Text>
            <Text>暂无教职工数据</Text>
            <Text className='hint'>请点击顶部 🔄 从云端同步数据</Text>
            <View className='sync-btn-big' onClick={handleSync}>
              <Text>{isSyncing ? '同步中...' : '🔄 立即同步'}</Text>
            </View>
          </View>
        )}

        <View style={{ height: '100rpx' }}></View>
      </ScrollView>

      {/* 添加弹窗 */}
      {isAddModalOpen && (
        <View className='modal-overlay' onClick={() => setIsAddModalOpen(false)}>
          <View className='modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='modal-title'>添加教职工</Text>

            <View className='form-item'>
              <Text className='label'>姓名 *</Text>
              <Input
                placeholder='请输入姓名'
                value={newTeacher.name}
                onInput={(e) => setNewTeacher(prev => ({ ...prev, name: e.detail.value }))}
              />
            </View>

            <View className='form-item'>
              <Text className='label'>手机号 *</Text>
              <Input
                type='number'
                placeholder='请输入11位手机号'
                value={newTeacher.phone}
                onInput={(e) => setNewTeacher(prev => ({ ...prev, phone: e.detail.value }))}
                maxlength={11}
              />
            </View>

            <View className='form-item'>
              <Text className='label'>角色</Text>
              <View className='role-options'>
                {roles.map(role => (
                  <View
                    key={role}
                    className={`role-btn ${newTeacher.role === role ? 'active' : ''}`}
                    onClick={() => setNewTeacher(prev => ({ ...prev, role }))}
                  >
                    <Text>{role}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className='form-item'>
              <Text className='label'>负责班级（可多选）</Text>
              <View className='class-options multi'>
                {classes.map(cls => (
                  <View
                    key={cls}
                    className={`class-btn ${newTeacher.assignedClasses.includes(cls) ? 'active' : ''}`}
                    onClick={() => setNewTeacher(prev => ({
                      ...prev,
                      assignedClasses: prev.assignedClasses.includes(cls)
                        ? prev.assignedClasses.filter(c => c !== cls)
                        : [...prev.assignedClasses, cls]
                    }))}
                  >
                    <Text>{cls}</Text>
                    {newTeacher.assignedClasses.includes(cls) && <Text className='check'>✓</Text>}
                  </View>
                ))}
              </View>
              {newTeacher.assignedClasses.length > 0 && (
                <Text className='selected-hint'>已选：{newTeacher.assignedClasses.join('、')}</Text>
              )}
            </View>

            <View className='modal-actions'>
              <View className='btn cancel' onClick={() => setIsAddModalOpen(false)}>
                <Text>取消</Text>
              </View>
              <View className='btn confirm' onClick={handleAddTeacher}>
                <Text>确认添加</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 班级分配弹窗 - 仅管理员可见 */}
      {isAssignModalOpen && selectedTeacher && (
        <View className='modal-overlay' onClick={() => setIsAssignModalOpen(false)}>
          <View className='modal-content assign-modal' onClick={(e) => e.stopPropagation()}>
            <Text className='modal-title'>分配班级</Text>
            <View className='teacher-info-header'>
              <View className='avatar-large'>
                <Text>{selectedTeacher.name.slice(0, 1)}</Text>
              </View>
              <View className='teacher-detail'>
                <Text className='name'>{selectedTeacher.name}</Text>
                <Text className='role'>{selectedTeacher.role}</Text>
              </View>
            </View>
            
            <View className='assign-hint'>
              <Text>选择该教师负责的班级（可多选）</Text>
            </View>
            
            <View className='class-grid'>
              {classes.map(cls => (
                <View
                  key={cls}
                  className={`class-item ${selectedClasses.includes(cls) ? 'selected' : ''}`}
                  onClick={() => toggleClassSelection(cls)}
                >
                  <Text className='class-name'>{cls}</Text>
                  {selectedClasses.includes(cls) && (
                    <View className='check-icon'>
                      <Text>✓</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            
            {selectedClasses.length > 0 && (
              <View className='selected-summary'>
                <Text>已选班级：{selectedClasses.join('、')}</Text>
              </View>
            )}

            <View className='modal-actions'>
              <View className='btn cancel' onClick={() => setIsAssignModalOpen(false)}>
                <Text>取消</Text>
              </View>
              <View className='btn confirm' onClick={saveAssignment}>
                <Text>确认分配</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
