import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './disease.scss'

interface Student {
  id: string
  name: string
  class: string
}

interface DiseaseRecord {
  id: string
  studentId: string
  studentName: string
  className: string
  diseaseType: string
  diagnosisDate: string
  symptoms: string[]
  treatmentStatus: 'treating' | 'isolated' | 'recovered'
  returnDate?: string
  returnCertificate?: boolean
  notes?: string
  recordedAt: string
}

const DISEASE_TYPES = [
  '手足口病', '疱疹性咽峡炎', '流感', '水痘', 
  '腮腺炎', '猩红热', '诺如病毒', '轮状病毒', '其他'
]

const COMMON_SYMPTOMS = [
  '发热', '咳嗽', '流涕', '呕吐', '腹泻', 
  '皮疹', '咽痛', '乏力', '食欲不振', '其他'
]

export default function Disease() {
  useGlobalShare({ title: '金星幼儿园 - 疾病管理', path: '/pages/students/disease' })
  const [students, setStudents] = useState<Student[]>([])
  const [diseaseRecords, setDiseaseRecords] = useState<DiseaseRecord[]>([])
  const [activeTab, setActiveTab] = useState<'active' | 'recovered'>('active')
  
  // 录入弹窗
  const [showModal, setShowModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [diseaseType, setDiseaseType] = useState('')
  const [diagnosisDate, setDiagnosisDate] = useState(new Date().toISOString().split('T')[0])
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [treatmentStatus, setTreatmentStatus] = useState<'treating' | 'isolated'>('treating')
  const [notes, setNotes] = useState('')
  
  // 学生选择
  const [showStudentPicker, setShowStudentPicker] = useState(false)

  useEffect(() => {
    loadStudents()
    loadDiseaseRecords()
  }, [])

  const loadStudents = () => {
    const data = Taro.getStorageSync('kt_students') || []
    setStudents(Array.isArray(data) ? data : [])
  }

  const loadDiseaseRecords = () => {
    const data = Taro.getStorageSync('kt_disease_records') || []
    setDiseaseRecords(Array.isArray(data) ? data : [])
  }

  const saveDiseaseRecord = () => {
    if (!selectedStudent || !diseaseType) {
      Taro.showToast({ title: '请选择学生和疾病类型', icon: 'none' })
      return
    }

    const record: DiseaseRecord = {
      id: `disease_${Date.now()}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      className: selectedStudent.class || '未分班',
      diseaseType,
      diagnosisDate,
      symptoms,
      treatmentStatus,
      notes,
      recordedAt: new Date().toISOString()
    }

    const updated = [...diseaseRecords, record]
    setDiseaseRecords(updated)
    Taro.setStorageSync('kt_disease_records', updated)
    
    resetModal()
    Taro.showToast({ title: '记录已保存', icon: 'success' })
  }

  const updateRecordStatus = (recordId: string, status: 'treating' | 'isolated' | 'recovered', returnDate?: string) => {
    const updated = diseaseRecords.map(r => {
      if (r.id === recordId) {
        return { ...r, treatmentStatus: status, returnDate }
      }
      return r
    })
    setDiseaseRecords(updated)
    Taro.setStorageSync('kt_disease_records', updated)
    Taro.showToast({ title: '状态已更新', icon: 'success' })
  }

  const resetModal = () => {
    setShowModal(false)
    setSelectedStudent(null)
    setDiseaseType('')
    setDiagnosisDate(new Date().toISOString().split('T')[0])
    setSymptoms([])
    setTreatmentStatus('treating')
    setNotes('')
  }

  const toggleSymptom = (symptom: string) => {
    setSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    )
  }

  // 统计
  const activeRecords = diseaseRecords.filter(r => r.treatmentStatus !== 'recovered')
  const recoveredRecords = diseaseRecords.filter(r => r.treatmentStatus === 'recovered')
  const stats = {
    treating: diseaseRecords.filter(r => r.treatmentStatus === 'treating').length,
    isolated: diseaseRecords.filter(r => r.treatmentStatus === 'isolated').length,
    recovered: recoveredRecords.length
  }

  const displayRecords = activeTab === 'active' ? activeRecords : recoveredRecords

  return (
    <View className='disease-page'>
      <NavBar title='传染病管理' backgroundColor='#dc2626' />
      <NavBarPlaceholder />
      {/* 头部 */}
      <View className='header'>
        <Text className='title'>传染病管理</Text>
        <View className='add-btn' onClick={() => setShowModal(true)}>
          <Text>+ 登记</Text>
        </View>
      </View>

      {/* 统计栏 */}
      <View className='stats-bar'>
        <View className='stat-item'>
          <Text className='number orange'>{stats.treating}</Text>
          <Text className='label'>治疗中</Text>
        </View>
        <View className='stat-item'>
          <Text className='number red'>{stats.isolated}</Text>
          <Text className='label'>隔离中</Text>
        </View>
        <View className='stat-item'>
          <Text className='number green'>{stats.recovered}</Text>
          <Text className='label'>已康复</Text>
        </View>
      </View>

      {/* 标签页 */}
      <View className='tabs'>
        <View 
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <Text>当前患病 ({activeRecords.length})</Text>
        </View>
        <View 
          className={`tab ${activeTab === 'recovered' ? 'active' : ''}`}
          onClick={() => setActiveTab('recovered')}
        >
          <Text>已康复 ({recoveredRecords.length})</Text>
        </View>
      </View>

      {/* 记录列表 */}
      <ScrollView className='record-list' scrollY>
        {displayRecords.map(record => (
          <View key={record.id} className='record-card'>
            <View className='card-header'>
              <View className='student-info'>
                <Text className='name'>{record.studentName}</Text>
                <Text className='class'>{record.className}</Text>
              </View>
              <View className={`status-tag ${record.treatmentStatus}`}>
                <Text>
                  {record.treatmentStatus === 'treating' ? '治疗中' :
                   record.treatmentStatus === 'isolated' ? '隔离中' : '已康复'}
                </Text>
              </View>
            </View>
            
            <View className='card-body'>
              <View className='info-row'>
                <Text className='label'>疾病类型</Text>
                <Text className='value disease-type'>{record.diseaseType}</Text>
              </View>
              <View className='info-row'>
                <Text className='label'>确诊日期</Text>
                <Text className='value'>{record.diagnosisDate}</Text>
              </View>
              {record.symptoms.length > 0 && (
                <View className='info-row'>
                  <Text className='label'>症状</Text>
                  <View className='symptoms'>
                    {record.symptoms.map((s, i) => (
                      <Text key={i} className='symptom-tag'>{s}</Text>
                    ))}
                  </View>
                </View>
              )}
              {record.returnDate && (
                <View className='info-row'>
                  <Text className='label'>返园日期</Text>
                  <Text className='value green'>{record.returnDate}</Text>
                </View>
              )}
              {record.notes && (
                <View className='info-row'>
                  <Text className='label'>备注</Text>
                  <Text className='value'>{record.notes}</Text>
                </View>
              )}
            </View>
            
            {record.treatmentStatus !== 'recovered' && (
              <View className='card-actions'>
                {record.treatmentStatus === 'treating' && (
                  <View 
                    className='action-btn isolate'
                    onClick={() => updateRecordStatus(record.id, 'isolated')}
                  >
                    <Text>标记隔离</Text>
                  </View>
                )}
                <View 
                  className='action-btn recover'
                  onClick={() => {
                    Taro.showModal({
                      title: '确认康复',
                      content: '确认该学生已康复并可返园？',
                      success: (res) => {
                        if (res.confirm) {
                          const today = new Date().toISOString().split('T')[0]
                          updateRecordStatus(record.id, 'recovered', today)
                        }
                      }
                    })
                  }}
                >
                  <Text>标记康复</Text>
                </View>
              </View>
            )}
          </View>
        ))}
        
        {displayRecords.length === 0 && (
          <View className='empty-state'>
            <Text className='icon'>🏥</Text>
            <Text className='text'>
              {activeTab === 'active' ? '暂无患病记录' : '暂无康复记录'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 录入弹窗 */}
      {showModal && (
        <View className='record-modal'>
          <View className='modal-overlay' onClick={resetModal} />
          <View className='modal-content'>
            <View className='modal-header'>
              <Text className='modal-title'>登记传染病</Text>
            </View>
            
            <ScrollView className='modal-body' scrollY>
              {/* 选择学生 */}
              <View className='form-item'>
                <Text className='label'>选择学生 *</Text>
                <View 
                  className='student-picker'
                  onClick={() => setShowStudentPicker(true)}
                >
                  <Text className={selectedStudent ? '' : 'placeholder'}>
                    {selectedStudent ? `${selectedStudent.name} - ${selectedStudent.class}` : '点击选择学生'}
                  </Text>
                </View>
              </View>
              
              {/* 疾病类型 */}
              <View className='form-item'>
                <Text className='label'>疾病类型 *</Text>
                <View className='disease-options'>
                  {DISEASE_TYPES.map(type => (
                    <View
                      key={type}
                      className={`option ${diseaseType === type ? 'active' : ''}`}
                      onClick={() => setDiseaseType(type)}
                    >
                      <Text>{type}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* 确诊日期 */}
              <View className='form-item'>
                <Text className='label'>确诊日期</Text>
                <Picker
                  mode='date'
                  value={diagnosisDate}
                  onChange={(e) => setDiagnosisDate(e.detail.value)}
                >
                  <View className='date-picker'>
                    <Text>{diagnosisDate}</Text>
                  </View>
                </Picker>
              </View>
              
              {/* 症状 */}
              <View className='form-item'>
                <Text className='label'>症状（可多选）</Text>
                <View className='symptom-options'>
                  {COMMON_SYMPTOMS.map(symptom => (
                    <View
                      key={symptom}
                      className={`option ${symptoms.includes(symptom) ? 'active' : ''}`}
                      onClick={() => toggleSymptom(symptom)}
                    >
                      <Text>{symptom}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* 状态 */}
              <View className='form-item'>
                <Text className='label'>当前状态</Text>
                <View className='status-options'>
                  <View
                    className={`option ${treatmentStatus === 'treating' ? 'active' : ''}`}
                    onClick={() => setTreatmentStatus('treating')}
                  >
                    <Text>治疗中</Text>
                  </View>
                  <View
                    className={`option ${treatmentStatus === 'isolated' ? 'active' : ''}`}
                    onClick={() => setTreatmentStatus('isolated')}
                  >
                    <Text>隔离中</Text>
                  </View>
                </View>
              </View>
              
              {/* 备注 */}
              <View className='form-item'>
                <Text className='label'>备注</Text>
                <Input
                  className='input'
                  placeholder='其他说明（选填）'
                  value={notes}
                  onInput={(e) => setNotes(e.detail.value)}
                />
              </View>
            </ScrollView>
            
            <View className='modal-footer'>
              <View className='btn cancel' onClick={resetModal}>
                <Text>取消</Text>
              </View>
              <View className='btn confirm' onClick={saveDiseaseRecord}>
                <Text>保存记录</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 学生选择弹窗 */}
      {showStudentPicker && (
        <View className='student-picker-modal'>
          <View className='modal-overlay' onClick={() => setShowStudentPicker(false)} />
          <View className='picker-content'>
            <View className='picker-header'>
              <Text className='picker-title'>选择学生</Text>
              <Text className='close-btn' onClick={() => setShowStudentPicker(false)}>✕</Text>
            </View>
            <ScrollView className='student-list' scrollY>
              {students.map(student => (
                <View
                  key={student.id}
                  className={`student-item ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedStudent(student)
                    setShowStudentPicker(false)
                  }}
                >
                  <Text className='name'>{student.name}</Text>
                  <Text className='class'>{student.class || '未分班'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}
