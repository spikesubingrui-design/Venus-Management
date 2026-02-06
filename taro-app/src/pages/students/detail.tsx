import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import { getCurrentUser } from '../../services/permissionService'
import { uploadToAliyun, isAliyunConfigured } from '../../services/aliyunOssService'
import './detail.scss'

interface Student {
  id: string
  name: string
  gender?: string
  class?: string
  className?: string
  birthDate?: string
  height?: number
  weight?: number
  bloodType?: string
  allergies?: string
  parent_name?: string
  parentName?: string
  parent_relation?: string
  parent_phone?: string
  parentPhone?: string
  emergencyContact?: string
  emergencyPhone?: string
  address?: string
  enrollDate?: string
  status?: string
}

// 兼容字段名
const getClass = (s: Student) => s.class || s.className || ''
const getParentName = (s: Student) => s.parent_name || s.parentName || ''
const getParentPhone = (s: Student) => s.parent_phone || s.parentPhone || ''

interface AttendanceRecord {
  date: string
  status: 'present' | 'absent' | 'sick' | 'leave'
  notes?: string
}

export default function StudentDetail() {
  useGlobalShare({ title: '金星幼儿园 - 学生详情', path: '/pages/students/index' })
  const router = useRouter()
  const { id } = router.params

  const [student, setStudent] = useState<Student | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Student>>({})
  const [activeTab, setActiveTab] = useState<'info' | 'attendance' | 'payment'>('info')
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [canEdit, setCanEdit] = useState(true)

  useEffect(() => {
    // 检查权限
    const user = getCurrentUser()
    const isKitchen = user?.role?.toUpperCase() === 'KITCHEN'
    setCanEdit(!isKitchen)
    
    loadStudent()
    loadAttendance()
    loadPayments()
  }, [id])

  const loadStudent = () => {
    const students = Taro.getStorageSync('kt_students') || []
    const found = students.find((s: Student) => s.id === id)
    if (found) {
      setStudent(found)
      setEditForm(found)
    }
  }

  const loadAttendance = () => {
    // 加载最近30天的考勤记录
    const records: AttendanceRecord[] = []
    const today = new Date()
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayRecords = Taro.getStorageSync(`kt_attendance_${dateStr}`) || {}
      if (dayRecords[id!]) {
        records.push({
          date: dateStr,
          status: dayRecords[id!].status,
          notes: dayRecords[id!].notes
        })
      }
    }
    
    setAttendanceRecords(records)
  }

  const loadPayments = () => {
    const allPayments = Taro.getStorageSync('kt_payments') || []
    const studentPayments = allPayments.filter((p: any) => p.studentId === id)
    setPayments(studentPayments)
  }

  const handleSave = () => {
    if (!editForm.name?.trim()) {
      Taro.showToast({ title: '姓名不能为空', icon: 'none' })
      return
    }

    // 同时更新两种字段名格式，保持兼容
    const updatedForm = {
      ...editForm,
      class: editForm.class,
      className: editForm.class,
      parent_name: editForm.parent_name,
      parentName: editForm.parent_name,
      parent_phone: editForm.parent_phone,
      parentPhone: editForm.parent_phone,
    }

    const students = Taro.getStorageSync('kt_students') || []
    const updated = students.map((s: Student) => 
      s.id === id ? { ...s, ...updatedForm } : s
    )
    
    Taro.setStorageSync('kt_students', updated)
    setStudent(updatedForm as Student)
    setIsEditing(false)
    Taro.showToast({ title: '保存成功', icon: 'success' })
    // 同步到OSS
    if (isAliyunConfigured && updated.length >= 10) {
      uploadToAliyun('kt_students', updated).catch(() => {})
    }
  }

  // 删除学生（需要二次确认）
  const handleDelete = () => {
    Taro.showModal({
      title: '⚠️ 确认删除',
      content: `确定要删除学生「${student?.name}」吗？此操作不可撤销。`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          // 二次确认
          Taro.showModal({
            title: '再次确认',
            content: '删除后数据无法恢复，是否继续？',
            confirmColor: '#ef4444',
            success: (res2) => {
              if (res2.confirm) {
                const students = Taro.getStorageSync('kt_students') || []
                const updated = students.filter((s: Student) => s.id !== id)
                Taro.setStorageSync('kt_students', updated)
                // 同步到OSS
                if (isAliyunConfigured && updated.length >= 10) {
                  uploadToAliyun('kt_students', updated).catch(() => {})
                }
                Taro.showToast({ title: '已删除', icon: 'success' })
                setTimeout(() => {
                  Taro.navigateBack()
                }, 1500)
              }
            }
          })
        }
      }
    })
  }

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      present: '出勤',
      absent: '缺勤',
      sick: '病假',
      leave: '事假'
    }
    return map[status] || status
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      present: '#22c55e',
      absent: '#ef4444',
      sick: '#f59e0b',
      leave: '#3b82f6'
    }
    return map[status] || '#94a3b8'
  }

  if (!student) {
    return (
      <View className='loading'>
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className='detail-page'>
      <NavBar title='学生详情' />
      <NavBarPlaceholder />
      
      {/* 顶部信息卡 */}
      <View className='header-card'>
        <View className='avatar'>
          <Text>{student.gender === '女' ? '👧' : '👦'}</Text>
        </View>
        <View className='basic-info'>
          <Text className='name'>{student.name}</Text>
          <Text className='class'>{getClass(student)}</Text>
        </View>
        {!isEditing && canEdit && (
          <View className='header-actions'>
            <View className='edit-btn' onClick={() => setIsEditing(true)}>
              <Text>✏️ 编辑</Text>
            </View>
            <View className='more-btn' onClick={handleDelete}>
              <Text>🗑️</Text>
            </View>
          </View>
        )}
      </View>

      {/* 标签页 */}
      <View className='tabs'>
        {[
          { key: 'info', label: '📋 基本信息' },
          { key: 'attendance', label: '📅 考勤记录' },
          { key: 'payment', label: '💰 缴费记录' }
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
        {/* 基本信息 */}
        {activeTab === 'info' && (
          <View className='info-section'>
            {isEditing ? (
              // 编辑模式
              <View className='edit-form'>
                <View className='form-group'>
                  <Text className='group-title'>👶 学生信息</Text>
                  
                  <View className='form-item'>
                    <Text className='label'>姓名</Text>
                    <Input
                      value={editForm.name}
                      onInput={(e) => setEditForm(prev => ({ ...prev, name: e.detail.value }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>性别</Text>
                    <View className='gender-btns'>
                      {['男', '女'].map(g => (
                        <View
                          key={g}
                          className={`gender-btn ${editForm.gender === g ? 'active' : ''}`}
                          onClick={() => setEditForm(prev => ({ ...prev, gender: g as '男' | '女' }))}
                        >
                          <Text>{g}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>班级</Text>
                    <Input
                      value={editForm.class}
                      onInput={(e) => setEditForm(prev => ({ ...prev, class: e.detail.value }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>出生日期</Text>
                    <Input
                      type='text'
                      placeholder='YYYY-MM-DD'
                      value={editForm.birthDate}
                      onInput={(e) => setEditForm(prev => ({ ...prev, birthDate: e.detail.value }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>身高(cm)</Text>
                    <Input
                      type='digit'
                      value={editForm.height?.toString()}
                      onInput={(e) => setEditForm(prev => ({ ...prev, height: Number(e.detail.value) }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>体重(kg)</Text>
                    <Input
                      type='digit'
                      value={editForm.weight?.toString()}
                      onInput={(e) => setEditForm(prev => ({ ...prev, weight: Number(e.detail.value) }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>血型</Text>
                    <Input
                      value={editForm.bloodType}
                      onInput={(e) => setEditForm(prev => ({ ...prev, bloodType: e.detail.value }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>过敏信息</Text>
                    <Input
                      value={editForm.allergies}
                      onInput={(e) => setEditForm(prev => ({ ...prev, allergies: e.detail.value }))}
                    />
                  </View>
                </View>

                <View className='form-group'>
                  <Text className='group-title'>👨‍👩‍👧 家长信息</Text>
                  
                  <View className='form-item'>
                    <Text className='label'>家长姓名</Text>
                    <Input
                      value={editForm.parent_name}
                      onInput={(e) => setEditForm(prev => ({ ...prev, parent_name: e.detail.value }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>与孩子关系</Text>
                    <Input
                      value={editForm.parent_relation}
                      onInput={(e) => setEditForm(prev => ({ ...prev, parent_relation: e.detail.value }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>联系电话</Text>
                    <Input
                      type='number'
                      value={editForm.parent_phone}
                      onInput={(e) => setEditForm(prev => ({ ...prev, parent_phone: e.detail.value }))}
                    />
                  </View>
                  
                  <View className='form-item'>
                    <Text className='label'>家庭地址</Text>
                    <Input
                      value={editForm.address}
                      onInput={(e) => setEditForm(prev => ({ ...prev, address: e.detail.value }))}
                    />
                  </View>
                </View>

                <View className='action-btns'>
                  <View className='btn cancel' onClick={() => { setIsEditing(false); setEditForm(student) }}>
                    <Text>取消</Text>
                  </View>
                  <View className='btn save' onClick={handleSave}>
                    <Text>保存</Text>
                  </View>
                </View>
              </View>
            ) : (
              // 查看模式
              <View className='info-display'>
                <View className='info-group'>
                  <Text className='group-title'>👶 学生信息</Text>
                  <View className='info-row'>
                    <Text className='label'>性别</Text>
                    <Text className='value'>{student.gender || '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>班级</Text>
                    <Text className='value'>{getClass(student) || '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>出生日期</Text>
                    <Text className='value'>{student.birthDate || '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>身高</Text>
                    <Text className='value'>{student.height ? `${student.height}cm` : '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>体重</Text>
                    <Text className='value'>{student.weight ? `${student.weight}kg` : '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>血型</Text>
                    <Text className='value'>{student.bloodType || '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>过敏信息</Text>
                    <Text className='value'>{student.allergies || '无'}</Text>
                  </View>
                </View>

                <View className='info-group'>
                  <Text className='group-title'>👨‍👩‍👧 家长信息</Text>
                  <View className='info-row'>
                    <Text className='label'>家长姓名</Text>
                    <Text className='value'>{getParentName(student) || '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>与孩子关系</Text>
                    <Text className='value'>{student.parent_relation || '-'}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>联系电话</Text>
                    <Text className='value clickable' onClick={() => {
                      const phone = getParentPhone(student)
                      if (phone) Taro.makePhoneCall({ phoneNumber: phone })
                    }}>
                      {getParentPhone(student) || '-'}
                    </Text>
                  </View>
                  <View className='info-row'>
                    <Text className='label'>家庭地址</Text>
                    <Text className='value'>{student.address || '-'}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 考勤记录 */}
        {activeTab === 'attendance' && (
          <View className='attendance-section'>
            <View className='attendance-stats'>
              <View className='stat-item'>
                <Text className='number'>{attendanceRecords.filter(r => r.status === 'present').length}</Text>
                <Text className='label'>出勤</Text>
              </View>
              <View className='stat-item'>
                <Text className='number' style={{ color: '#ef4444' }}>{attendanceRecords.filter(r => r.status === 'absent').length}</Text>
                <Text className='label'>缺勤</Text>
              </View>
              <View className='stat-item'>
                <Text className='number' style={{ color: '#f59e0b' }}>{attendanceRecords.filter(r => r.status === 'sick').length}</Text>
                <Text className='label'>病假</Text>
              </View>
              <View className='stat-item'>
                <Text className='number' style={{ color: '#3b82f6' }}>{attendanceRecords.filter(r => r.status === 'leave').length}</Text>
                <Text className='label'>事假</Text>
              </View>
            </View>

            <View className='record-list'>
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record, index) => (
                  <View key={index} className='record-item'>
                    <Text className='date'>{record.date}</Text>
                    <Text className='status' style={{ color: getStatusColor(record.status) }}>
                      {getStatusLabel(record.status)}
                    </Text>
                    {record.notes && <Text className='notes'>{record.notes}</Text>}
                  </View>
                ))
              ) : (
                <View className='empty'>
                  <Text>暂无考勤记录</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 缴费记录 */}
        {activeTab === 'payment' && (
          <View className='payment-section'>
            {payments.length > 0 ? (
              payments.map((payment, index) => (
                <View key={index} className='payment-item'>
                  <View className='payment-header'>
                    <Text className='amount'>¥{payment.amount.toLocaleString()}</Text>
                    <Text className='status paid'>已缴</Text>
                  </View>
                  <View className='payment-details'>
                    <Text className='date'>{new Date(payment.paymentDate).toLocaleDateString()}</Text>
                    <Text className='type'>
                      {payment.feeDetails?.map((f: any) => f.label).join('、') || payment.feeType}
                    </Text>
                  </View>
                  {payment.notes && <Text className='notes'>{payment.notes}</Text>}
                </View>
              ))
            ) : (
              <View className='empty'>
                <Text>暂无缴费记录</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 底部操作 */}
      {activeTab === 'attendance' && (
        <View className='footer-btn' onClick={() => Taro.navigateTo({ url: `/pages/students/attendance?id=${id}&name=${student.name}&class=${getClass(student)}` })}>
          <Text>📝 记录今日考勤</Text>
        </View>
      )}

      {activeTab === 'payment' && (
        <View className='footer-btn' onClick={() => Taro.navigateTo({ url: `/pages/finance/payment` })}>
          <Text>💳 新建缴费</Text>
        </View>
      )}
    </View>
  )
}
