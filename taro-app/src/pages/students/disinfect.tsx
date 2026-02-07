import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './disinfect.scss'

interface DisinfectRecord {
  id: string
  className: string
  date: string
  time: string
  type: 'daily' | 'weekly' | 'special'  // 日常/周消毒/特殊消毒
  areas: string[]
  method: string
  disinfectant: string
  duration: number  // 分钟
  operator: string
  ventilation: boolean
  notes?: string
  recordedAt: string
}

const CLASS_LIST = ['托班', '小一班', '小二班', '中一班', '中二班', '大一班', '大二班', '公共区域']

const AREA_OPTIONS = [
  '教室地面', '桌椅', '玩具', '门把手', '卫生间',
  '睡眠室', '盥洗室', '户外器械', '空调滤网', '其他'
]

const METHOD_OPTIONS = ['擦拭消毒', '喷洒消毒', '浸泡消毒', '紫外线消毒', '臭氧消毒', '通风换气']

const DISINFECTANT_OPTIONS = ['84消毒液', '酒精', '过氧化氢', '紫外线灯', '臭氧机', '清水']

export default function Disinfect() {
  useGlobalShare({ title: '金星幼儿园 - 消毒记录', path: '/pages/students/disinfect' })
  const today = new Date().toISOString().split('T')[0]
  const [disinfectRecords, setDisinfectRecords] = useState<DisinfectRecord[]>([])
  const [selectedDate, setSelectedDate] = useState(today)
  
  // 录入弹窗
  const [showModal, setShowModal] = useState(false)
  const [className, setClassName] = useState('')
  const [disinfectType, setDisinfectType] = useState<'daily' | 'weekly' | 'special'>('daily')
  const [areas, setAreas] = useState<string[]>([])
  const [method, setMethod] = useState('')
  const [disinfectant, setDisinfectant] = useState('')
  const [duration, setDuration] = useState('30')
  const [operator, setOperator] = useState('')
  const [ventilation, setVentilation] = useState(true)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadDisinfectRecords()
  }, [])

  const loadDisinfectRecords = () => {
    const data = Taro.getStorageSync('kt_disinfect_records') || []
    setDisinfectRecords(Array.isArray(data) ? data : [])
  }

  const saveDisinfectRecord = () => {
    if (!className || !method || !disinfectant || areas.length === 0) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    const record: DisinfectRecord = {
      id: `disinfect_${Date.now()}`,
      className,
      date: selectedDate,
      time: new Date().toTimeString().slice(0, 5),
      type: disinfectType,
      areas,
      method,
      disinfectant,
      duration: parseInt(duration) || 30,
      operator: operator || '教师',
      ventilation,
      notes,
      recordedAt: new Date().toISOString()
    }

    const updated = [record, ...disinfectRecords]
    setDisinfectRecords(updated)
    Taro.setStorageSync('kt_disinfect_records', updated)
    
    resetModal()
    Taro.showToast({ title: '记录已保存', icon: 'success' })
  }

  const resetModal = () => {
    setShowModal(false)
    setClassName('')
    setDisinfectType('daily')
    setAreas([])
    setMethod('')
    setDisinfectant('')
    setDuration('30')
    setOperator('')
    setVentilation(true)
    setNotes('')
  }

  const toggleArea = (area: string) => {
    setAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    )
  }

  // 筛选当日记录
  const todayRecords = disinfectRecords.filter(r => r.date === selectedDate)
  
  // 统计
  const stats = {
    today: disinfectRecords.filter(r => r.date === today).length,
    daily: todayRecords.filter(r => r.type === 'daily').length,
    weekly: todayRecords.filter(r => r.type === 'weekly').length,
    special: todayRecords.filter(r => r.type === 'special').length
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      daily: '日常消毒',
      weekly: '周消毒',
      special: '特殊消毒'
    }
    return labels[type] || type
  }

  return (
    <View className='disinfect-page'>
      <NavBar title='消毒记录' backgroundColor='#0891b2' />
      <NavBarPlaceholder />
      {/* 头部 */}
      <View className='header'>
        <View className='header-info'>
          <Text className='title'>消毒记录</Text>
          <Picker mode='date' value={selectedDate} onChange={(e) => setSelectedDate(e.detail.value)}>
            <View className='date-picker'>
              <Text>{selectedDate}</Text>
              <Text className='arrow'>▼</Text>
            </View>
          </Picker>
        </View>
        <View className='add-btn' onClick={() => setShowModal(true)}>
          <Text>+ 记录</Text>
        </View>
      </View>

      {/* 统计栏 */}
      <View className='stats-bar'>
        <View className='stat-item'>
          <Text className='number cyan'>{stats.today}</Text>
          <Text className='label'>今日消毒</Text>
        </View>
        <View className='stat-item'>
          <Text className='number'>{stats.daily}</Text>
          <Text className='label'>日常</Text>
        </View>
        <View className='stat-item'>
          <Text className='number blue'>{stats.weekly}</Text>
          <Text className='label'>周消毒</Text>
        </View>
        <View className='stat-item'>
          <Text className='number red'>{stats.special}</Text>
          <Text className='label'>特殊</Text>
        </View>
      </View>

      {/* 记录列表 */}
      <ScrollView className='record-list' scrollY>
        {todayRecords.map(record => (
          <View key={record.id} className={`record-card ${record.type}`}>
            <View className='card-header'>
              <View className='class-info'>
                <Text className='class-name'>{record.className}</Text>
                <Text className='time'>{record.date} {record.time}</Text>
              </View>
              <View className={`type-tag ${record.type}`}>
                <Text>{getTypeLabel(record.type)}</Text>
              </View>
            </View>
            
            <View className='card-body'>
              <View className='info-row'>
                <Text className='label'>消毒区域</Text>
                <View className='areas'>
                  {record.areas.map((area, i) => (
                    <Text key={i} className='area-tag'>{area}</Text>
                  ))}
                </View>
              </View>
              <View className='info-grid'>
                <View className='info-item'>
                  <Text className='label'>消毒方式</Text>
                  <Text className='value'>{record.method}</Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>消毒剂</Text>
                  <Text className='value'>{record.disinfectant}</Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>时长</Text>
                  <Text className='value'>{record.duration}分钟</Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>操作人</Text>
                  <Text className='value'>{record.operator}</Text>
                </View>
              </View>
              {record.ventilation && (
                <View className='ventilation-tag'>
                  <Text>✓ 已通风</Text>
                </View>
              )}
              {record.notes && (
                <View className='notes'>
                  <Text className='label'>备注：</Text>
                  <Text>{record.notes}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
        
        {todayRecords.length === 0 && (
          <View className='empty-state'>
            <Text className='icon'>🧹</Text>
            <Text className='text'>该日期暂无消毒记录</Text>
          </View>
        )}
      </ScrollView>

      {/* 录入弹窗 */}
      {showModal && (
        <View className='record-modal'>
          <View className='modal-overlay' onClick={resetModal} />
          <View className='modal-content'>
            <View className='modal-header'>
              <Text className='modal-title'>记录消毒</Text>
            </View>
            
            <ScrollView className='modal-body' scrollY>
              {/* 班级/区域 */}
              <View className='form-item'>
                <Text className='label'>班级/区域 *</Text>
                <View className='class-options'>
                  {CLASS_LIST.map(cls => (
                    <View
                      key={cls}
                      className={`option ${className === cls ? 'active' : ''}`}
                      onClick={() => setClassName(cls)}
                    >
                      <Text>{cls}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* 消毒类型 */}
              <View className='form-item'>
                <Text className='label'>消毒类型</Text>
                <View className='type-options'>
                  {[
                    { value: 'daily', label: '日常消毒' },
                    { value: 'weekly', label: '周消毒' },
                    { value: 'special', label: '特殊消毒' }
                  ].map(item => (
                    <View
                      key={item.value}
                      className={`option ${disinfectType === item.value ? 'active' : ''}`}
                      onClick={() => setDisinfectType(item.value as any)}
                    >
                      <Text>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* 消毒区域 */}
              <View className='form-item'>
                <Text className='label'>消毒区域 *（可多选）</Text>
                <View className='area-options'>
                  {AREA_OPTIONS.map(area => (
                    <View
                      key={area}
                      className={`option ${areas.includes(area) ? 'active' : ''}`}
                      onClick={() => toggleArea(area)}
                    >
                      <Text>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* 消毒方式 */}
              <View className='form-item'>
                <Text className='label'>消毒方式 *</Text>
                <View className='method-options'>
                  {METHOD_OPTIONS.map(m => (
                    <View
                      key={m}
                      className={`option ${method === m ? 'active' : ''}`}
                      onClick={() => setMethod(m)}
                    >
                      <Text>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* 消毒剂 */}
              <View className='form-item'>
                <Text className='label'>消毒剂 *</Text>
                <View className='disinfectant-options'>
                  {DISINFECTANT_OPTIONS.map(d => (
                    <View
                      key={d}
                      className={`option ${disinfectant === d ? 'active' : ''}`}
                      onClick={() => setDisinfectant(d)}
                    >
                      <Text>{d}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* 时长和操作人 */}
              <View className='form-row'>
                <View className='form-item half'>
                  <Text className='label'>消毒时长（分钟）</Text>
                  <Input
                    className='input'
                    type='number'
                    placeholder='30'
                    value={duration}
                    onInput={(e) => setDuration(e.detail.value)}
                  />
                </View>
                <View className='form-item half'>
                  <Text className='label'>操作人</Text>
                  <Input
                    className='input'
                    placeholder='填写姓名'
                    value={operator}
                    onInput={(e) => setOperator(e.detail.value)}
                  />
                </View>
              </View>
              
              {/* 通风 */}
              <View className='form-item'>
                <View 
                  className={`checkbox-item ${ventilation ? 'checked' : ''}`}
                  onClick={() => setVentilation(!ventilation)}
                >
                  <View className='checkbox'>
                    {ventilation && <Text>✓</Text>}
                  </View>
                  <Text className='checkbox-label'>消毒后已开窗通风</Text>
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
              <View className='btn confirm' onClick={saveDisinfectRecord}>
                <Text>保存记录</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
