import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './pickup.scss'

interface Student {
  id: string
  name: string
  class: string
}

interface PickupRecord {
  id: string
  studentId: string
  date: string
  type: 'dropoff' | 'pickup'  // 送入/接走
  time: string
  pickerName: string
  pickerRelation: string
  pickerPhone?: string
  notes?: string
  recordedAt: string
}

export default function Pickup() {
  useGlobalShare({ title: '金星幼儿园 - 接送管理', path: '/pages/students/pickup' })
  const today = new Date().toISOString().split('T')[0]
  const [students, setStudents] = useState<Student[]>([])
  const [pickupRecords, setPickupRecords] = useState<PickupRecord[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('全部')
  
  // 录入弹窗
  const [showModal, setShowModal] = useState(false)
  const [modalStudent, setModalStudent] = useState<Student | null>(null)
  const [modalType, setModalType] = useState<'dropoff' | 'pickup'>('dropoff')
  const [pickerName, setPickerName] = useState('')
  const [pickerRelation, setPickerRelation] = useState('')
  const [pickerPhone, setPickerPhone] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadStudents()
    loadPickupRecords()
  }, [])

  const loadStudents = () => {
    const data = Taro.getStorageSync('kt_students') || []
    setStudents(Array.isArray(data) ? data : [])
  }

  const loadPickupRecords = () => {
    const data = Taro.getStorageSync('kt_pickup_records') || []
    setPickupRecords(Array.isArray(data) ? data : [])
  }

  const savePickupRecord = () => {
    if (!modalStudent || !pickerName || !pickerRelation) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    const record: PickupRecord = {
      id: `pickup_${Date.now()}`,
      studentId: modalStudent.id,
      date: today,
      type: modalType,
      time: new Date().toTimeString().slice(0, 5),
      pickerName,
      pickerRelation,
      pickerPhone,
      notes,
      recordedAt: new Date().toISOString()
    }

    const updated = [...pickupRecords, record]
    setPickupRecords(updated)
    Taro.setStorageSync('kt_pickup_records', updated)
    
    resetModal()
    Taro.showToast({ title: '记录已保存', icon: 'success' })
  }

  const resetModal = () => {
    setShowModal(false)
    setModalStudent(null)
    setPickerName('')
    setPickerRelation('')
    setPickerPhone('')
    setNotes('')
  }

  const openRecordModal = (student: Student, type: 'dropoff' | 'pickup') => {
    setModalStudent(student)
    setModalType(type)
    setShowModal(true)
  }

  // 扫码接送
  const handleScanQR = () => {
    Taro.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        try {
          const data = JSON.parse(res.result)
          if (data.studentId && data.type) {
            const student = students.find(s => s.id === data.studentId)
            if (student) {
              openRecordModal(student, data.type)
            }
          }
        } catch (e) {
          Taro.showToast({ title: '二维码格式错误', icon: 'none' })
        }
      },
      fail: () => {
        Taro.showToast({ title: '扫码取消', icon: 'none' })
      }
    })
  }

  // 生成学生二维码数据
  const showStudentQR = (student: Student) => {
    const qrData = JSON.stringify({
      studentId: student.id,
      studentName: student.name,
      type: 'pickup'
    })
    
    Taro.showModal({
      title: `${student.name}的接送二维码`,
      content: '请家长保存此二维码用于接送签到',
      showCancel: false
    })
  }

  // 获取班级列表
  const classList = ['全部', ...new Set(students.map(s => s.class || '未分班'))]

  // 筛选学生
  const filteredStudents = selectedClass === '全部' 
    ? students 
    : students.filter(s => (s.class || '未分班') === selectedClass)

  // 按班级分组
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const cls = student.class || '未分班'
    if (!acc[cls]) acc[cls] = []
    acc[cls].push(student)
    return acc
  }, {} as Record<string, Student[]>)

  // 获取学生今日接送记录
  const getStudentTodayRecords = (studentId: string) => {
    return pickupRecords.filter(r => r.studentId === studentId && r.date === today)
  }

  // 今日统计
  const todayRecords = pickupRecords.filter(r => r.date === today)
  const stats = {
    dropoff: todayRecords.filter(r => r.type === 'dropoff').length,
    pickup: todayRecords.filter(r => r.type === 'pickup').length
  }

  return (
    <View className='pickup-page'>
      <NavBar title='接送管理' backgroundColor='#3b82f6' />
      <NavBarPlaceholder />
      {/* 头部 */}
      <View className='header'>
        <View className='header-info'>
          <Text className='title'>今日接送</Text>
          <Text className='date'>{today}</Text>
        </View>
        
        <View className='header-btns'>
          <View className='scan-btn' onClick={handleScanQR}>
            <Text>📷 扫码</Text>
          </View>
        </View>
      </View>

      {/* 统计栏 */}
      <View className='stats-bar'>
        <View className='stat-item'>
          <Text className='number blue'>{stats.dropoff}</Text>
          <Text className='label'>已送入</Text>
        </View>
        <View className='stat-item'>
          <Text className='number green'>{stats.pickup}</Text>
          <Text className='label'>已接走</Text>
        </View>
        <View className='stat-item'>
          <Text className='number gray'>{filteredStudents.length}</Text>
          <Text className='label'>总人数</Text>
        </View>
      </View>

      {/* 班级筛选 */}
      <ScrollView className='class-tabs' scrollX>
        {classList.map(cls => (
          <View
            key={cls}
            className={`class-tab ${selectedClass === cls ? 'active' : ''}`}
            onClick={() => setSelectedClass(cls)}
          >
            <Text>{cls}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 学生列表 */}
      <ScrollView className='student-list' scrollY>
        {Object.entries(groupedStudents).map(([cls, stuList]) => (
          <View key={cls} className='class-group'>
            <View className='class-header'>
              <Text className='class-name'>{cls}</Text>
              <Text className='count'>{stuList.length}人</Text>
            </View>
            
            {stuList.map(student => {
              const todayRecs = getStudentTodayRecords(student.id)
              const hasDropoff = todayRecs.some(r => r.type === 'dropoff')
              const hasPickup = todayRecs.some(r => r.type === 'pickup')
              
              return (
                <View key={student.id} className='student-card'>
                  <View className='student-info'>
                    <Text className='name'>{student.name}</Text>
                    <View className='status-tags'>
                      <Text className={`tag ${hasDropoff ? 'active blue' : ''}`}>
                        送入 {hasDropoff ? '✓' : '-'}
                      </Text>
                      <Text className={`tag ${hasPickup ? 'active green' : ''}`}>
                        接走 {hasPickup ? '✓' : '-'}
                      </Text>
                    </View>
                  </View>
                  
                  <View className='action-btns'>
                    <View 
                      className='action-btn dropoff'
                      onClick={() => openRecordModal(student, 'dropoff')}
                    >
                      <Text>+ 送入</Text>
                    </View>
                    <View 
                      className='action-btn pickup'
                      onClick={() => openRecordModal(student, 'pickup')}
                    >
                      <Text>+ 接走</Text>
                    </View>
                    <View 
                      className='action-btn qr'
                      onClick={() => showStudentQR(student)}
                    >
                      <Text>📱</Text>
                    </View>
                  </View>
                  
                  {/* 今日记录 */}
                  {todayRecs.length > 0 && (
                    <View className='today-records'>
                      {todayRecs.map(rec => (
                        <View key={rec.id} className='record-item'>
                          <Text className={`type ${rec.type}`}>
                            {rec.type === 'dropoff' ? '送入' : '接走'}
                          </Text>
                          <Text className='time'>{rec.time}</Text>
                          <Text className='picker'>{rec.pickerName}（{rec.pickerRelation}）</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}
        
        {filteredStudents.length === 0 && (
          <View className='empty-state'>
            <Text className='icon'>🚗</Text>
            <Text className='text'>暂无学生数据</Text>
          </View>
        )}
      </ScrollView>

      {/* 录入弹窗 */}
      {showModal && (
        <View className='record-modal'>
          <View className='modal-overlay' onClick={resetModal} />
          <View className='modal-content'>
            <View className='modal-header'>
              <Text className='modal-title'>
                {modalType === 'dropoff' ? '送入登记' : '接走登记'}
              </Text>
              <Text className='student-name'>{modalStudent?.name}</Text>
            </View>
            
            <View className='modal-body'>
              <View className='form-item'>
                <Text className='label'>接送人姓名 *</Text>
                <Input
                  className='input'
                  placeholder='请输入姓名'
                  value={pickerName}
                  onInput={(e) => setPickerName(e.detail.value)}
                />
              </View>
              
              <View className='form-item'>
                <Text className='label'>与幼儿关系 *</Text>
                <View className='relation-options'>
                  {['父亲', '母亲', '爷爷', '奶奶', '外公', '外婆', '其他'].map(rel => (
                    <View
                      key={rel}
                      className={`option ${pickerRelation === rel ? 'active' : ''}`}
                      onClick={() => setPickerRelation(rel)}
                    >
                      <Text>{rel}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              <View className='form-item'>
                <Text className='label'>联系电话</Text>
                <Input
                  className='input'
                  type='number'
                  placeholder='请输入电话（选填）'
                  value={pickerPhone}
                  onInput={(e) => setPickerPhone(e.detail.value)}
                />
              </View>
              
              <View className='form-item'>
                <Text className='label'>备注</Text>
                <Input
                  className='input'
                  placeholder='备注信息（选填）'
                  value={notes}
                  onInput={(e) => setNotes(e.detail.value)}
                />
              </View>
            </View>
            
            <View className='modal-footer'>
              <View className='btn cancel' onClick={resetModal}>
                <Text>取消</Text>
              </View>
              <View className='btn confirm' onClick={savePickupRecord}>
                <Text>确认{modalType === 'dropoff' ? '送入' : '接走'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
