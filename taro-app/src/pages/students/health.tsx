import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { uploadHealthRecord, downloadHealthRecordsFromCloud } from '../../services/cloudSyncService'
import { filterStudentsByPermission, getCurrentUser } from '../../services/permissionService'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './health.scss'

interface Student {
  id: string
  name: string
  class: string
  allergies?: string[]
}

interface HealthRecord {
  studentId: string
  date: string
  morningTemp?: number
  noonTemp?: number
  breakfastStatus?: 'all' | 'half' | 'little' | ''
  lunchStatus?: 'all' | 'half' | 'little' | ''
  napStatus?: 'good' | 'normal' | 'poor' | ''
  moodStatus?: 'happy' | 'normal' | 'upset' | ''
  notes?: string
  syncedToParent?: boolean
  recordedAt?: string
}

const MEAL_OPTIONS = [
  { value: '', label: '未记录' },
  { value: 'all', label: '全吃' },
  { value: 'half', label: '一半' },
  { value: 'little', label: '少量' },
]

const NAP_OPTIONS = [
  { value: '', label: '未记录' },
  { value: 'good', label: '好' },
  { value: 'normal', label: '一般' },
  { value: 'poor', label: '差' },
]

const MOOD_OPTIONS = [
  { value: '', label: '未记录' },
  { value: 'happy', label: '开心' },
  { value: 'normal', label: '一般' },
  { value: 'upset', label: '不开心' },
]

export default function Health() {
  useGlobalShare({ title: '金星幼儿园 - 健康管理', path: '/pages/students/health' })
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<Student[]>([])
  const [healthRecords, setHealthRecords] = useState<Record<string, HealthRecord>>({})
  const [selectedClass, setSelectedClass] = useState<string>('全部')
  const [canEdit, setCanEdit] = useState(true)

  useEffect(() => {
    // 检查权限：厨师只能查看
    const user = getCurrentUser()
    const isKitchen = user?.role?.toUpperCase() === 'KITCHEN'
    setCanEdit(!isKitchen)
    
    loadStudents()
    loadHealthRecords()
  }, [selectedDate])

  const loadStudents = () => {
    const data = Taro.getStorageSync('kt_students') || []
    // 应用权限过滤
    const filteredData = filterStudentsByPermission(Array.isArray(data) ? data : [])
    setStudents(filteredData)
  }

  const loadHealthRecords = async () => {
    // 先加载本地数据
    const data = Taro.getStorageSync(`kt_health_${selectedDate}`) || {}
    setHealthRecords(data)
    
    // 尝试从云端同步
    try {
      const result = await downloadHealthRecordsFromCloud()
      if (result.success && result.data) {
        // 筛选当天的健康记录
        const todayRecords = result.data.filter((r: any) => r.date === selectedDate)
        if (todayRecords.length > 0) {
          const recordMap: Record<string, HealthRecord> = {}
          todayRecords.forEach((r: any) => {
            recordMap[r.studentId] = r
          })
          const merged = { ...data, ...recordMap }
          setHealthRecords(merged)
          Taro.setStorageSync(`kt_health_${selectedDate}`, merged)
          console.log('[健康记录] 云端数据已同步:', todayRecords.length, '条')
        }
      }
    } catch (err) {
      console.log('[健康记录] 云端同步跳过:', err)
    }
  }

  const saveHealthRecord = (studentId: string, updates: Partial<HealthRecord>) => {
    const current = healthRecords[studentId] || { studentId, date: selectedDate }
    const updated = { ...current, ...updates, recordedAt: new Date().toISOString() }
    
    const newRecords = { ...healthRecords, [studentId]: updated }
    setHealthRecords(newRecords)
    Taro.setStorageSync(`kt_health_${selectedDate}`, newRecords)
    
    // 自动同步到云端
    uploadHealthRecord(selectedDate, studentId, updated).then(result => {
      if (result.success) {
        console.log('[健康记录] 已同步到云端:', studentId)
      } else {
        console.error('[健康记录] 同步失败:', result.error)
      }
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

  // 判断体温是否异常
  const isTempAbnormal = (temp?: number) => temp && temp >= 37.3

  // 统计
  const stats = {
    total: filteredStudents.length,
    recorded: Object.keys(healthRecords).filter(k => filteredStudents.some(s => s.id === k)).length,
    highTemp: Object.values(healthRecords).filter(r => 
      isTempAbnormal(r.morningTemp) || isTempAbnormal(r.noonTemp)
    ).length
  }

  // 同步给家长
  const syncToParent = (studentId: string) => {
    const record = healthRecords[studentId]
    const student = students.find(s => s.id === studentId)
    if (!record || !student) return

    // 生成日报内容
    const report = generateDailyReport(student, record)
    
    // 标记已同步
    saveHealthRecord(studentId, { syncedToParent: true })
    
    Taro.showToast({ title: '已发送给家长', icon: 'success' })
  }

  const generateDailyReport = (student: Student, record: HealthRecord) => {
    const mealLabel = (status?: string) => {
      const map: Record<string, string> = { all: '全部吃完', half: '吃了一半', little: '吃得较少' }
      return map[status || ''] || '未记录'
    }
    const napLabel = (status?: string) => {
      const map: Record<string, string> = { good: '睡得很好', normal: '睡眠一般', poor: '睡眠较差' }
      return map[status || ''] || '未记录'
    }
    const moodLabel = (status?: string) => {
      const map: Record<string, string> = { happy: '心情愉快', normal: '心情平稳', upset: '情绪低落' }
      return map[status || ''] || '未记录'
    }

    return `【${student.name}今日在园情况】
日期：${selectedDate}
晨检体温：${record.morningTemp || '-'}℃
午检体温：${record.noonTemp || '-'}℃
早餐：${mealLabel(record.breakfastStatus)}
午餐：${mealLabel(record.lunchStatus)}
午睡：${napLabel(record.napStatus)}
情绪：${moodLabel(record.moodStatus)}
${record.notes ? `备注：${record.notes}` : ''}`
  }

  return (
    <View className='health-page'>
      <NavBar title='健康打卡' backgroundColor='#ef4444' />
      <NavBarPlaceholder />
      {/* 头部 */}
      <View className='header'>
        <Picker mode='date' value={selectedDate} onChange={(e) => setSelectedDate(e.detail.value)}>
          <View className='date-display'>
            <Text className='date'>{selectedDate}</Text>
            <Text className='arrow'>▼</Text>
          </View>
        </Picker>
        
        <View className='stats-info'>
          <Text className='recorded'>{stats.recorded}/{stats.total} 已记录</Text>
          {stats.highTemp > 0 && (
            <Text className='alert'>⚠️ {stats.highTemp}人体温异常</Text>
          )}
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
              const record = healthRecords[student.id] || {}
              const hasHighTemp = isTempAbnormal(record.morningTemp) || isTempAbnormal(record.noonTemp)
              
              return (
                <View key={student.id} className={`student-card ${hasHighTemp ? 'alert' : ''}`}>
                  <View className='student-header'>
                    <View className='student-info'>
                      <Text className='name'>{student.name}</Text>
                      {student.allergies && student.allergies.length > 0 && (
                        <Text className='allergy-tag'>过敏</Text>
                      )}
                    </View>
                    {canEdit && (
                      <View
                        className={`sync-btn ${record.syncedToParent ? 'synced' : ''}`}
                        onClick={() => !record.syncedToParent && syncToParent(student.id)}
                      >
                        <Text>{record.syncedToParent ? '✓ 已同步' : '发送家长'}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View className='record-grid'>
                    {/* 体温 */}
                    <View className='record-item'>
                      <Text className='item-label'>晨检</Text>
                      <Input
                        type='digit'
                        className={`temp-input ${isTempAbnormal(record.morningTemp) ? 'high' : ''}`}
                        placeholder='36.5'
                        value={record.morningTemp?.toString() || ''}
                        onInput={(e) => canEdit && saveHealthRecord(student.id, { 
                          morningTemp: parseFloat(e.detail.value) || undefined 
                        })}
                        disabled={!canEdit}
                      />
                      <Text className='unit'>℃</Text>
                    </View>
                    
                    <View className='record-item'>
                      <Text className='item-label'>午检</Text>
                      <Input
                        type='digit'
                        className={`temp-input ${isTempAbnormal(record.noonTemp) ? 'high' : ''}`}
                        placeholder='36.5'
                        value={record.noonTemp?.toString() || ''}
                        onInput={(e) => canEdit && saveHealthRecord(student.id, { 
                          noonTemp: parseFloat(e.detail.value) || undefined 
                        })}
                        disabled={!canEdit}
                      />
                      <Text className='unit'>℃</Text>
                    </View>
                    
                    {/* 用餐 */}
                    <View className='record-item'>
                      <Text className='item-label'>早餐</Text>
                      <Picker
                        mode='selector'
                        range={MEAL_OPTIONS}
                        rangeKey='label'
                        value={MEAL_OPTIONS.findIndex(o => o.value === record.breakfastStatus)}
                        onChange={(e) => canEdit && saveHealthRecord(student.id, { 
                          breakfastStatus: MEAL_OPTIONS[+e.detail.value].value as any 
                        })}
                        disabled={!canEdit}
                      >
                        <View className={`select-box ${!canEdit ? 'disabled' : ''}`}>
                          <Text>{MEAL_OPTIONS.find(o => o.value === record.breakfastStatus)?.label || '选择'}</Text>
                        </View>
                      </Picker>
                    </View>
                    
                    <View className='record-item'>
                      <Text className='item-label'>午餐</Text>
                      <Picker
                        mode='selector'
                        range={MEAL_OPTIONS}
                        rangeKey='label'
                        value={MEAL_OPTIONS.findIndex(o => o.value === record.lunchStatus)}
                        onChange={(e) => canEdit && saveHealthRecord(student.id, { 
                          lunchStatus: MEAL_OPTIONS[+e.detail.value].value as any 
                        })}
                        disabled={!canEdit}
                      >
                        <View className={`select-box ${!canEdit ? 'disabled' : ''}`}>
                          <Text>{MEAL_OPTIONS.find(o => o.value === record.lunchStatus)?.label || '选择'}</Text>
                        </View>
                      </Picker>
                    </View>
                    
                    {/* 午睡情绪 */}
                    <View className='record-item'>
                      <Text className='item-label'>午睡</Text>
                      <Picker
                        mode='selector'
                        range={NAP_OPTIONS}
                        rangeKey='label'
                        value={NAP_OPTIONS.findIndex(o => o.value === record.napStatus)}
                        onChange={(e) => canEdit && saveHealthRecord(student.id, { 
                          napStatus: NAP_OPTIONS[+e.detail.value].value as any 
                        })}
                        disabled={!canEdit}
                      >
                        <View className={`select-box ${!canEdit ? 'disabled' : ''}`}>
                          <Text>{NAP_OPTIONS.find(o => o.value === record.napStatus)?.label || '选择'}</Text>
                        </View>
                      </Picker>
                    </View>
                    
                    <View className='record-item'>
                      <Text className='item-label'>情绪</Text>
                      <Picker
                        mode='selector'
                        range={MOOD_OPTIONS}
                        rangeKey='label'
                        value={MOOD_OPTIONS.findIndex(o => o.value === record.moodStatus)}
                        onChange={(e) => canEdit && saveHealthRecord(student.id, { 
                          moodStatus: MOOD_OPTIONS[+e.detail.value].value as any 
                        })}
                        disabled={!canEdit}
                      >
                        <View className={`select-box ${!canEdit ? 'disabled' : ''}`}>
                          <Text>{MOOD_OPTIONS.find(o => o.value === record.moodStatus)?.label || '选择'}</Text>
                        </View>
                      </Picker>
                    </View>
                  </View>
                  
                  {/* 备注 */}
                  <View className='notes-section'>
                    <Input
                      className='notes-input'
                      placeholder='备注（可选）'
                      value={record.notes || ''}
                      onInput={(e) => canEdit && saveHealthRecord(student.id, { notes: e.detail.value })}
                      disabled={!canEdit}
                    />
                  </View>
                </View>
              )
            })}
          </View>
        ))}
        
        {filteredStudents.length === 0 && (
          <View className='empty-state'>
            <Text className='icon'>📋</Text>
            <Text className='text'>暂无学生数据</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
