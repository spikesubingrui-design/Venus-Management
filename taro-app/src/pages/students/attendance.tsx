import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { uploadAttendance, downloadAttendance } from '../../services/cloudSyncService'
import { filterStudentsByPermission, getPermissionHint, getCurrentUser } from '../../services/permissionService'
import { queueAttendanceNotice } from '../../services/notificationService'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './attendance.scss'

interface Student {
  id: string
  name: string
  class: string
}

type AttendanceStatus = 'present' | 'absent' | 'sick' | 'leave' | 'late'

interface AttendanceRecord {
  studentId: string
  status: AttendanceStatus
  time?: string
  notes?: string
}

export default function Attendance() {
  useGlobalShare({ title: '金星幼儿园 - 考勤管理', path: '/pages/students/attendance' })
  const router = useRouter()
  const { id, name, class: studentClass } = router.params

  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<Student[]>([])
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord>>({})
  
  // 单个学生考勤
  const [singleStatus, setSingleStatus] = useState<AttendanceStatus>('present')
  const [singleNotes, setSingleNotes] = useState('')
  
  // 批量备注
  const [batchNotes, setBatchNotes] = useState<Record<string, string>>({})
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  
  // 确认弹窗
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  // 备注弹窗（用于病假/事假）
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [notesModalStudent, setNotesModalStudent] = useState<Student | null>(null)
  const [notesModalStatus, setNotesModalStatus] = useState<AttendanceStatus>('sick')
  const [notesModalInput, setNotesModalInput] = useState('')
  const [selectedReason, setSelectedReason] = useState('')
  
  // 常见原因列表
  const SICK_REASONS = ['发烧', '感冒', '咳嗽', '肠胃不适', '手足口病', '水痘', '过敏', '其他疾病']
  const LEAVE_REASONS = ['家中有事', '外出旅游', '回老家', '看医生', '参加活动', '家长接送不便', '其他事由']
  const ABSENT_REASONS = ['无故未到', '联系不上家长', '未提前请假', '其他原因']
  
  // 权限控制：厨师只能查看，不能编辑
  const [canEdit, setCanEdit] = useState(true)
  
  useEffect(() => {
    // 检查权限
    const user = getCurrentUser()
    const isKitchen = user?.role?.toUpperCase() === 'KITCHEN'
    setCanEdit(!isKitchen)
    
    loadStudents()
    loadAttendance()
  }, [selectedDate])

  const loadStudents = () => {
    const data = Taro.getStorageSync('kt_students') || []
    // 应用权限过滤
    const filteredData = filterStudentsByPermission(data)
    
    // 如果是单个学生模式，只显示该学生
    if (id && name) {
      setStudents(filteredData.filter((s: Student) => studentClass ? s.class === studentClass : true))
    } else {
      setStudents(filteredData)
    }
    
    console.log('[考勤] 学生数据已过滤:', filteredData.length, '名 (原', data.length, '名)')
  }

  const loadAttendance = async () => {
    // 先加载本地数据
    let data = Taro.getStorageSync(`kt_attendance_${selectedDate}`) || {}
    setAttendanceData(data)
    
    // 始终尝试从云端同步最新数据
    try {
      const result = await downloadAttendance(selectedDate)
      if (result.success && result.data && Object.keys(result.data).length > 0) {
        data = { ...data, ...result.data } // 合并云端数据
        setAttendanceData(data)
        Taro.setStorageSync(`kt_attendance_${selectedDate}`, data)
        console.log('[考勤] 云端数据已同步:', Object.keys(result.data).length, '条')
      }
    } catch (err) {
      console.log('[考勤] 云端同步跳过:', err)
    }
    
    // 如果是单个学生，加载其状态
    if (id && data[id]) {
      setSingleStatus(data[id].status)
      setSingleNotes(data[id].notes || '')
    }
  }

  const saveAttendance = async (studentId: string, record: AttendanceRecord) => {
    const data = Taro.getStorageSync(`kt_attendance_${selectedDate}`) || {}
    data[studentId] = record
    Taro.setStorageSync(`kt_attendance_${selectedDate}`, data)
    setAttendanceData(data)

    // 始终同步到云端
    const result = await uploadAttendance(selectedDate, studentId, record)
    if (result.success) {
      console.log('[考勤] 已同步到云端:', studentId)
    } else {
      console.error('[考勤] 同步失败:', result.error)
    }

    // 异常考勤入队通知（病假/事假/缺勤）
    if (['sick', 'leave', 'absent'].includes(record.status)) {
      const student = students.find(s => s.id === studentId)
      const statusLabels: Record<string, string> = { sick: '病假', leave: '事假', absent: '缺勤' }
      if (student) {
        queueAttendanceNotice({
          studentName: student.name,
          className: student.class || '',
          status: statusLabels[record.status] || record.status,
          date: selectedDate,
          remark: record.notes || undefined
        })
      }
    }
  }

  // 单个学生提交
  const handleSingleSubmit = () => {
    if (!id) return

    const record: AttendanceRecord = {
      studentId: id,
      status: singleStatus,
      time: new Date().toISOString(),
      notes: singleNotes
    }

    saveAttendance(id, record)
    Taro.showToast({ title: '考勤已记录', icon: 'success' })
    
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  }

  // 批量更新
  const updateBatchStatus = (studentId: string, status: AttendanceStatus, notes?: string) => {
    // 如果是病假、事假或缺勤，弹出原因选择弹窗
    if ((status === 'sick' || status === 'leave' || status === 'absent') && notes === undefined) {
      const student = students.find(s => s.id === studentId)
      if (student) {
        setNotesModalStudent(student)
        setNotesModalStatus(status)
        // 解析已有的备注，尝试恢复选择的原因
        const existingNotes = batchNotes[studentId] || attendanceData[studentId]?.notes || ''
        const colonIndex = existingNotes.indexOf('：')
        if (colonIndex > 0) {
          setSelectedReason(existingNotes.substring(0, colonIndex))
          setNotesModalInput(existingNotes.substring(colonIndex + 1))
        } else {
          setSelectedReason(existingNotes)
          setNotesModalInput('')
        }
        setShowNotesModal(true)
        return
      }
    }
    
    const record: AttendanceRecord = {
      studentId,
      status,
      time: new Date().toISOString(),
      notes: notes || batchNotes[studentId] || ''
    }
    saveAttendance(studentId, record)
  }
  
  // 确认备注弹窗
  const handleNotesModalConfirm = () => {
    if (notesModalStudent) {
      // 组合原因和备注
      let finalNotes = selectedReason
      if (notesModalInput.trim()) {
        finalNotes = selectedReason ? `${selectedReason}：${notesModalInput}` : notesModalInput
      }
      
      const record: AttendanceRecord = {
        studentId: notesModalStudent.id,
        status: notesModalStatus,
        time: new Date().toISOString(),
        notes: finalNotes
      }
      saveAttendance(notesModalStudent.id, record)
      setBatchNotes(prev => ({ ...prev, [notesModalStudent.id]: finalNotes }))
    }
    setShowNotesModal(false)
    setNotesModalStudent(null)
    setNotesModalInput('')
    setSelectedReason('')
  }
  
  // 取消备注弹窗
  const handleNotesModalCancel = () => {
    setShowNotesModal(false)
    setNotesModalStudent(null)
    setNotesModalInput('')
    setSelectedReason('')
  }
  
  // 选择原因
  const handleSelectReason = (reason: string) => {
    setSelectedReason(prev => prev === reason ? '' : reason)
  }
  
  // 获取当前状态的原因列表
  const getCurrentReasons = () => {
    switch (notesModalStatus) {
      case 'sick': return SICK_REASONS
      case 'leave': return LEAVE_REASONS
      case 'absent': return ABSENT_REASONS
      default: return []
    }
  }
  
  // 更新批量备注
  const updateBatchNotes = (studentId: string, notes: string) => {
    setBatchNotes(prev => ({ ...prev, [studentId]: notes }))
    // 如果该学生已有考勤记录，更新备注
    const record = attendanceData[studentId]
    if (record) {
      saveAttendance(studentId, { ...record, notes })
    }
  }
  
  // 切换展开备注输入框
  const toggleExpand = (studentId: string) => {
    setExpandedStudent(prev => prev === studentId ? null : studentId)
  }

  // 全部出勤
  const markAllPresent = () => {
    Taro.showModal({
      title: '全部出勤',
      content: `确认将${studentClass || '全部'}班级标记为出勤？`,
      success: (res) => {
        if (res.confirm) {
          const filtered = studentClass 
            ? students.filter(s => s.class === studentClass)
            : students
            
          filtered.forEach(student => {
            updateBatchStatus(student.id, 'present')
          })
          
          Taro.showToast({ title: '已全部标记出勤', icon: 'success' })
        }
      }
    })
  }

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      present: '✅',
      late: '⏰',
      absent: '❌',
      sick: '🏥',
      leave: '📝'
    }
    return icons[status] || '⏳'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      present: '出勤',
      late: '迟到',
      absent: '缺勤',
      sick: '病假',
      leave: '事假'
    }
    return labels[status] || '未记录'
  }

  // 按班级分组
  const groupedStudents = students.reduce((acc, student) => {
    const cls = student.class || '未分班'
    if (!acc[cls]) acc[cls] = []
    acc[cls].push(student)
    return acc
  }, {} as Record<string, Student[]>)

  // 统计
  const stats = {
    total: students.length,
    present: Object.values(attendanceData).filter(r => r.status === 'present').length,
    late: Object.values(attendanceData).filter(r => r.status === 'late').length,
    absent: Object.values(attendanceData).filter(r => r.status === 'absent').length,
    sick: Object.values(attendanceData).filter(r => r.status === 'sick').length,
    leave: Object.values(attendanceData).filter(r => r.status === 'leave').length,
    unrecorded: students.length - Object.keys(attendanceData).filter(k => students.some(s => s.id === k)).length
  }
  
  // 获取非出勤学生列表
  const getNonPresentStudents = () => {
    return students.filter(s => {
      const record = attendanceData[s.id]
      return record && record.status !== 'present'
    }).map(s => ({
      ...s,
      status: attendanceData[s.id]?.status,
      notes: attendanceData[s.id]?.notes
    }))
  }
  
  // 确认提交考勤
  const handleConfirmSubmit = () => {
    setShowConfirmModal(false)
    Taro.showToast({ title: '考勤已提交', icon: 'success' })
  }

  // 如果是单个学生模式
  if (id && name) {
    return (
      <View className='attendance-page'>
        <NavBar title='考勤记录' />
        <NavBarPlaceholder />
        <View className='single-mode'>
          <View className='student-info'>
            <Text className='name'>{decodeURIComponent(name)}</Text>
            <Text className='class'>{decodeURIComponent(studentClass || '')}</Text>
          </View>

          <View className='date-picker'>
            <Picker mode='date' value={selectedDate} onChange={(e) => setSelectedDate(e.detail.value)}>
              <View className='picker-content'>
                <Text className='label'>日期</Text>
                <Text className='value'>{selectedDate}</Text>
              </View>
            </Picker>
          </View>

          <View className='status-options'>
            <Text className='section-title'>考勤状态</Text>
            {(['present', 'late', 'absent', 'sick', 'leave'] as const).map(status => (
              <View
                key={status}
                className={`status-option ${singleStatus === status ? 'active' : ''} ${!canEdit ? 'disabled' : ''}`}
                onClick={() => canEdit && setSingleStatus(status)}
              >
                <Text className='icon'>{getStatusIcon(status)}</Text>
                <Text className='label'>{getStatusLabel(status)}</Text>
                {singleStatus === status && <Text className='check'>✓</Text>}
              </View>
            ))}
          </View>

          <View className='notes-section'>
            <Text className='section-title'>备注说明</Text>
            <Input
              className='notes-input'
              placeholder='可填写原因或备注'
              value={singleNotes}
              onInput={(e) => setSingleNotes(e.detail.value)}
              disabled={!canEdit}
            />
          </View>

          {canEdit ? (
            <View className='submit-btn' onClick={handleSingleSubmit}>
              <Text>提交考勤</Text>
            </View>
          ) : (
            <View className='submit-btn disabled'>
              <Text>仅可查看（无编辑权限）</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  // 批量考勤模式
  return (
    <View className='attendance-page'>
      <NavBar title='考勤记录' />
      <NavBarPlaceholder />
      {/* 日期选择 */}
      <View className='header'>
        <Picker mode='date' value={selectedDate} onChange={(e) => setSelectedDate(e.detail.value)}>
          <View className='date-display'>
            <Text className='date'>{selectedDate}</Text>
            <Text className='arrow'>▼</Text>
          </View>
        </Picker>
        
        {canEdit && (
          <View className='header-btns'>
            <View className='quick-btn' onClick={markAllPresent}>
              <Text>✅ 全部出勤</Text>
            </View>
            <View className='submit-btn' onClick={() => setShowConfirmModal(true)}>
              <Text>确认提交</Text>
            </View>
          </View>
        )}
      </View>

      {/* 统计栏 */}
      <View className='stats-bar'>
        <View className='stat-item'>
          <Text className='number'>{stats.present}</Text>
          <Text className='label'>出勤</Text>
        </View>
        <View className='stat-item'>
          <Text className='number yellow'>{stats.late}</Text>
          <Text className='label'>迟到</Text>
        </View>
        <View className='stat-item'>
          <Text className='number red'>{stats.absent}</Text>
          <Text className='label'>缺勤</Text>
        </View>
        <View className='stat-item'>
          <Text className='number orange'>{stats.sick}</Text>
          <Text className='label'>病假</Text>
        </View>
        <View className='stat-item'>
          <Text className='number blue'>{stats.leave}</Text>
          <Text className='label'>事假</Text>
        </View>
        <View className='stat-item'>
          <Text className='number gray'>{stats.unrecorded}</Text>
          <Text className='label'>未记录</Text>
        </View>
      </View>

      {/* 学生列表 */}
      <ScrollView className='student-list' scrollY>
        {Object.entries(groupedStudents).map(([cls, stuList]) => (
          <View key={cls} className='class-group'>
            <View className='class-header'>
              <Text className='class-name'>{cls}</Text>
              <Text className='count'>{stuList.length}人</Text>
            </View>
            
            {stuList.map(student => {
              const record = attendanceData[student.id]
              const currentStatus = record?.status
              const isExpanded = expandedStudent === student.id
              const notes = batchNotes[student.id] || record?.notes || ''
              
              return (
                <View key={student.id} className='student-card'>
                  <View className='student-row'>
                    <View className='student-info' onClick={() => toggleExpand(student.id)}>
                      <Text className='name'>{student.name}</Text>
                      {currentStatus && (
                        <Text className={`current-status ${currentStatus}`}>
                          {getStatusIcon(currentStatus)} {getStatusLabel(currentStatus)}
                        </Text>
                      )}
                      {notes && <Text className='has-notes'>📝</Text>}
                    </View>
                    
                    <View className='status-btns'>
                      {(['present', 'late', 'absent', 'sick', 'leave'] as const).map(status => (
                        <View
                          key={status}
                          className={`status-btn ${status} ${currentStatus === status ? 'active' : ''} ${!canEdit ? 'disabled' : ''}`}
                          onClick={() => canEdit && updateBatchStatus(student.id, status)}
                        >
                          <Text>{getStatusIcon(status)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  
                  {/* 备注输入框 */}
                  {isExpanded && canEdit && (
                    <View className='notes-row'>
                      <Input
                        className='notes-input'
                        placeholder='填写备注（如请假原因等）'
                        value={notes}
                        onInput={(e) => updateBatchNotes(student.id, e.detail.value)}
                      />
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}
      </ScrollView>
      
      {/* 病假/事假/缺勤原因弹窗 */}
      {showNotesModal && notesModalStudent && (
        <View className='notes-modal-wrapper'>
          <View className='notes-modal-mask' onTouchMove={(e) => e.stopPropagation()} onClick={handleNotesModalCancel} />
          <View className='notes-modal-box'>
            <View className='notes-modal-header'>
              <Text className='notes-modal-title'>
                {notesModalStatus === 'sick' ? '🏥 病假' : notesModalStatus === 'leave' ? '📝 事假' : '❌ 缺勤'}
              </Text>
              <Text className='notes-modal-student'>{notesModalStudent.name} · {notesModalStudent.class}</Text>
            </View>
            
            <View className='notes-modal-body'>
              {/* 常见原因选择 */}
              <Text className='notes-section-title'>
                {notesModalStatus === 'sick' ? '选择病因：' : '选择原因：'}
              </Text>
              <View className='notes-reason-list'>
                {getCurrentReasons().map(reason => (
                  <Text 
                    key={reason}
                    className={`notes-reason-item ${selectedReason === reason ? 'active' : ''}`}
                    onClick={() => handleSelectReason(reason)}
                  >
                    {reason}
                  </Text>
                ))}
              </View>
              
              {/* 备注输入框 */}
              <Text className='notes-section-title'>补充说明（选填）：</Text>
              <Input
                className='notes-text-input'
                placeholder='可填写详细情况、预计返园时间等'
                value={notesModalInput}
                onInput={(e) => setNotesModalInput(e.detail.value)}
              />
            </View>
            
            <View className='notes-modal-footer'>
              <Text className='notes-btn-cancel' onClick={handleNotesModalCancel}>取消</Text>
              <Text className='notes-btn-confirm' onClick={handleNotesModalConfirm}>确认</Text>
            </View>
          </View>
        </View>
      )}
      
      {/* 确认提交弹窗 */}
      {showConfirmModal && (
        <View className='confirm-modal'>
          <View className='modal-overlay' onClick={() => setShowConfirmModal(false)} />
          <View className='modal-content'>
            <View className='modal-header'>
              <Text className='modal-title'>确认提交考勤</Text>
            </View>
            
            <View className='modal-body'>
              <Text className='confirm-date'>日期：{selectedDate}</Text>
              
              <View className='stats-summary'>
                <View className='stat-row'>
                  <Text className='stat-label'>出勤人数</Text>
                  <Text className='stat-value green'>{stats.present} 人</Text>
                </View>
                <View className='stat-row'>
                  <Text className='stat-label'>迟到人数</Text>
                  <Text className='stat-value yellow'>{stats.late} 人</Text>
                </View>
                <View className='stat-row'>
                  <Text className='stat-label'>请假人数</Text>
                  <Text className='stat-value orange'>{stats.sick + stats.leave} 人</Text>
                </View>
                <View className='stat-row'>
                  <Text className='stat-label'>缺勤人数</Text>
                  <Text className='stat-value red'>{stats.absent} 人</Text>
                </View>
                <View className='stat-row total'>
                  <Text className='stat-label'>总人数</Text>
                  <Text className='stat-value'>{stats.total} 人</Text>
                </View>
              </View>
              
              {/* 非出勤学生名单 */}
              {getNonPresentStudents().length > 0 && (
                <View className='non-present-list'>
                  <Text className='list-title'>非出勤学生：</Text>
                  <View className='student-tags'>
                    {getNonPresentStudents().map(s => (
                      <View key={s.id} className={`student-tag ${s.status}`}>
                        <Text>{s.name}</Text>
                        <Text className='tag-status'>{getStatusLabel(s.status || '')}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
            
            <View className='modal-footer'>
              <View className='btn cancel' onClick={() => setShowConfirmModal(false)}>
                <Text>取消</Text>
              </View>
              <View className='btn confirm' onClick={handleConfirmSubmit}>
                <Text>确认提交</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
