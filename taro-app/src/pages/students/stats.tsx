import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './stats.scss'

interface Student {
  id: string
  name: string
  class: string
  gender?: string
  birthDate?: string
}

interface Teacher {
  id: string
  name: string
  role: string
}

interface AttendanceRecord {
  studentId: string
  status: string
  time?: string
  notes?: string
}

interface HealthRecord {
  studentId: string
  morningTemp?: number
  noonTemp?: number
  breakfastStatus?: string
  lunchStatus?: string
  napStatus?: string
  moodStatus?: string
}

// 专业建议生成器
function generateAdvice(data: {
  attendanceRate: number
  sickRate: number
  leaveRate: number
  absentRate: number
  lateRate: number
  highTempRate: number
  mealGoodRate: number
  napGoodRate: number
  happyRate: number
  sickReasons: Record<string, number>
  consecutiveAbsent: string[]
  lowAttendanceClasses: { name: string; rate: number }[]
}): { type: 'success' | 'warning' | 'danger' | 'info'; title: string; content: string }[] {
  const advice: { type: 'success' | 'warning' | 'danger' | 'info'; title: string; content: string }[] = []

  // 出勤率分析
  if (data.attendanceRate >= 95) {
    advice.push({
      type: 'success',
      title: '出勤率优秀',
      content: `园所出勤率达到${data.attendanceRate}%，保持良好！建议继续保持家园沟通，定期发送健康提醒。`
    })
  } else if (data.attendanceRate >= 85) {
    advice.push({
      type: 'info',
      title: '出勤率良好',
      content: `出勤率${data.attendanceRate}%，处于正常水平。建议关注请假原因，加强晨检和健康管理。`
    })
  } else {
    advice.push({
      type: 'warning',
      title: '出勤率偏低',
      content: `出勤率仅${data.attendanceRate}%，需要重点关注。建议：1)分析请假原因分布；2)加强家园沟通；3)关注班级差异。`
    })
  }

  // 病假分析
  if (data.sickRate > 10) {
    const topReasons = Object.entries(data.sickReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason]) => reason)
      .join('、')
    
    advice.push({
      type: 'warning',
      title: '病假率偏高',
      content: `病假率${data.sickRate.toFixed(1)}%，主要原因：${topReasons || '未记录'}。建议：1)加强通风消毒；2)做好晨午检；3)提醒家长关注儿童健康。`
    })
  }

  // 体温异常
  if (data.highTempRate > 5) {
    advice.push({
      type: 'danger',
      title: '体温异常预警',
      content: `体温异常率${data.highTempRate.toFixed(1)}%，需要高度警惕。建议：1)加强体温监测频次；2)做好发热儿童隔离；3)及时通知家长就医。`
    })
  }

  // 连续缺勤预警
  if (data.consecutiveAbsent.length > 0) {
    advice.push({
      type: 'danger',
      title: '连续缺勤预警',
      content: `${data.consecutiveAbsent.slice(0, 3).join('、')}等${data.consecutiveAbsent.length}名幼儿连续缺勤超过3天。建议主动联系家长了解情况，做好关怀跟进。`
    })
  }

  // 班级差异
  if (data.lowAttendanceClasses.length > 0) {
    const classes = data.lowAttendanceClasses.map(c => `${c.name}(${c.rate}%)`).join('、')
    advice.push({
      type: 'warning',
      title: '班级出勤差异',
      content: `以下班级出勤率较低：${classes}。建议关注这些班级的健康状况，必要时进行班级消毒。`
    })
  }

  // 用餐情况
  if (data.mealGoodRate < 60) {
    advice.push({
      type: 'info',
      title: '用餐情况关注',
      content: `用餐全吃率${data.mealGoodRate.toFixed(1)}%。建议：1)了解幼儿挑食情况；2)调整菜品口味；3)加强营养知识宣传。`
    })
  }

  // 午睡质量
  if (data.napGoodRate < 60) {
    advice.push({
      type: 'info',
      title: '午睡质量关注',
      content: `午睡良好率${data.napGoodRate.toFixed(1)}%。建议：1)保持午睡环境安静；2)适当调整午睡时间；3)关注睡眠困难幼儿。`
    })
  }

  // 情绪状态
  if (data.happyRate < 70) {
    advice.push({
      type: 'info',
      title: '情绪状态关注',
      content: `幼儿开心率${data.happyRate.toFixed(1)}%。建议：1)增加趣味活动；2)关注情绪低落幼儿；3)加强正向激励。`
    })
  }

  // 迟到率
  if (data.lateRate > 5) {
    advice.push({
      type: 'info',
      title: '迟到情况提醒',
      content: `迟到率${data.lateRate.toFixed(1)}%。建议向家长强调准时入园的重要性，确保幼儿不错过早操和早餐。`
    })
  }

  // 如果没有任何问题
  if (advice.length === 1 && advice[0].type === 'success') {
    advice.push({
      type: 'success',
      title: '园所运营良好',
      content: '各项指标正常，请继续保持。建议定期复盘数据，持续优化管理流程。'
    })
  }

  return advice
}

export default function Stats() {
  useGlobalShare({ title: '金星幼儿园 - 数据统计', path: '/pages/students/stats' })
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('全部')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today')
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'health' | 'advice'>('overview')
  
  // 统计数据
  const [attendanceStats, setAttendanceStats] = useState<Record<string, Record<string, AttendanceRecord>>>({})
  const [healthStats, setHealthStats] = useState<Record<string, Record<string, HealthRecord>>>({})

  useEffect(() => {
    loadStudents()
    loadTeachers()
    loadStats()
  }, [dateRange])

  const loadStudents = () => {
    const data = Taro.getStorageSync('kt_students') || []
    setStudents(Array.isArray(data) ? data : [])
  }

  const loadTeachers = () => {
    const data = Taro.getStorageSync('kt_teachers') || []
    setTeachers(Array.isArray(data) ? data : [])
  }

  const loadStats = () => {
    const today = new Date()
    const days = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 30
    const attendanceData: Record<string, Record<string, AttendanceRecord>> = {}
    const healthData: Record<string, Record<string, HealthRecord>> = {}

    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const attendance = Taro.getStorageSync(`kt_attendance_${dateStr}`) || {}
      const health = Taro.getStorageSync(`kt_health_${dateStr}`) || {}
      
      attendanceData[dateStr] = attendance
      healthData[dateStr] = health
    }

    setAttendanceStats(attendanceData)
    setHealthStats(healthData)
  }
  
  // 获取日期范围显示文本
  const getDateRangeText = () => {
    if (dateRange === 'today') return '今日'
    if (dateRange === 'week') return '近7天'
    return '近30天'
  }

  // 获取班级列表
  const classList = useMemo(() => {
    const classes = new Set(students.map(s => s.class || '未分班'))
    return ['全部', ...Array.from(classes).sort((a, b) => a.localeCompare(b, 'zh-CN'))]
  }, [students])

  // 班级数量
  const classCount = useMemo(() => {
    return new Set(students.map(s => s.class || '未分班')).size
  }, [students])

  // 师生比
  const teacherStudentRatio = useMemo(() => {
    if (teachers.length === 0) return '0:0'
    const ratio = (students.length / teachers.length).toFixed(1)
    return `1:${ratio}`
  }, [students, teachers])

  // 筛选学生
  const filteredStudents = useMemo(() => {
    if (selectedClass === '全部') return students
    return students.filter(s => (s.class || '未分班') === selectedClass)
  }, [students, selectedClass])

  // 计算考勤统计
  const attendanceSummary = useMemo(() => {
    const dates = Object.keys(attendanceStats)
    let totalPresent = 0
    let totalLate = 0
    let totalAbsent = 0
    let totalSick = 0
    let totalLeave = 0
    let totalRecords = 0
    const sickReasons: Record<string, number> = {}
    const leaveReasons: Record<string, number> = {}
    const dailyRates: { date: string; rate: number }[] = []

    // 连续缺勤统计
    const studentAbsentDays: Record<string, number> = {}

    dates.forEach(date => {
      const records = attendanceStats[date]
      let dayPresent = 0
      let dayTotal = 0

      filteredStudents.forEach(student => {
        const record = records[student.id]
        if (record) {
          totalRecords++
          dayTotal++
          switch (record.status) {
            case 'present': 
              totalPresent++
              dayPresent++
              studentAbsentDays[student.id] = 0
              break
            case 'late': 
              totalLate++
              dayPresent++
              studentAbsentDays[student.id] = 0
              break
            case 'absent': 
              totalAbsent++
              studentAbsentDays[student.id] = (studentAbsentDays[student.id] || 0) + 1
              break
            case 'sick': 
              totalSick++
              studentAbsentDays[student.id] = (studentAbsentDays[student.id] || 0) + 1
              // 解析病假原因
              if (record.notes) {
                const reason = record.notes.split('：')[0] || record.notes
                sickReasons[reason] = (sickReasons[reason] || 0) + 1
              }
              break
            case 'leave': 
              totalLeave++
              studentAbsentDays[student.id] = (studentAbsentDays[student.id] || 0) + 1
              // 解析事假原因
              if (record.notes) {
                const reason = record.notes.split('：')[0] || record.notes
                leaveReasons[reason] = (leaveReasons[reason] || 0) + 1
              }
              break
          }
        }
      })

      if (dayTotal > 0) {
        dailyRates.push({
          date: date.slice(5), // MM-DD
          rate: Math.round((dayPresent / dayTotal) * 100)
        })
      }
    })

    // 找出连续缺勤超过3天的学生
    const consecutiveAbsent = Object.entries(studentAbsentDays)
      .filter(([_, days]) => days >= 3)
      .map(([id]) => {
        const student = filteredStudents.find(s => s.id === id)
        return student?.name || id
      })

    const totalPossible = dates.length * filteredStudents.length
    const attendanceRate = totalPossible > 0 
      ? Math.round(((totalPresent + totalLate) / totalPossible) * 100) 
      : 0

    return {
      dates: dates.length,
      totalStudents: filteredStudents.length,
      totalRecords,
      present: totalPresent,
      late: totalLate,
      absent: totalAbsent,
      sick: totalSick,
      leave: totalLeave,
      attendanceRate,
      sickRate: totalPossible > 0 ? (totalSick / totalPossible) * 100 : 0,
      leaveRate: totalPossible > 0 ? (totalLeave / totalPossible) * 100 : 0,
      absentRate: totalPossible > 0 ? (totalAbsent / totalPossible) * 100 : 0,
      lateRate: totalPossible > 0 ? (totalLate / totalPossible) * 100 : 0,
      sickReasons,
      leaveReasons,
      dailyRates: dailyRates.reverse(),
      consecutiveAbsent
    }
  }, [attendanceStats, filteredStudents])

  // 计算健康统计
  const healthSummary = useMemo(() => {
    const dates = Object.keys(healthStats)
    let highTempCount = 0
    let totalTempRecords = 0
    let mealStats = { all: 0, half: 0, little: 0 }
    let napStats = { good: 0, normal: 0, poor: 0 }
    let moodStats = { happy: 0, normal: 0, upset: 0 }
    const highTempStudents: { name: string; temp: number; date: string }[] = []

    dates.forEach(date => {
      const records = healthStats[date]
      filteredStudents.forEach(student => {
        const record = records[student.id]
        if (record) {
          // 体温统计
          if (record.morningTemp) {
            totalTempRecords++
            if (record.morningTemp >= 37.3) {
              highTempCount++
              highTempStudents.push({
                name: student.name,
                temp: record.morningTemp,
                date: date.slice(5)
              })
            }
          }
          if (record.noonTemp) {
            totalTempRecords++
            if (record.noonTemp >= 37.3) {
              highTempCount++
              highTempStudents.push({
                name: student.name,
                temp: record.noonTemp,
                date: date.slice(5)
              })
            }
          }
          
          // 用餐统计
          if (record.breakfastStatus) {
            mealStats[record.breakfastStatus as keyof typeof mealStats]++
          }
          if (record.lunchStatus) {
            mealStats[record.lunchStatus as keyof typeof mealStats]++
          }
          
          // 午睡统计
          if (record.napStatus) {
            napStats[record.napStatus as keyof typeof napStats]++
          }
          
          // 情绪统计
          if (record.moodStatus) {
            moodStats[record.moodStatus as keyof typeof moodStats]++
          }
        }
      })
    })

    const totalMeals = mealStats.all + mealStats.half + mealStats.little
    const totalNaps = napStats.good + napStats.normal + napStats.poor
    const totalMoods = moodStats.happy + moodStats.normal + moodStats.upset

    return {
      highTempCount,
      totalTempRecords,
      highTempRate: totalTempRecords > 0 
        ? (highTempCount / totalTempRecords) * 100 
        : 0,
      highTempStudents: highTempStudents.slice(0, 10),
      mealStats,
      mealGoodRate: totalMeals > 0 ? (mealStats.all / totalMeals) * 100 : 0,
      napStats,
      napGoodRate: totalNaps > 0 ? (napStats.good / totalNaps) * 100 : 0,
      moodStats,
      happyRate: totalMoods > 0 ? (moodStats.happy / totalMoods) * 100 : 0
    }
  }, [healthStats, filteredStudents])

  // 按班级统计考勤率
  const classAttendanceRates = useMemo(() => {
    const dates = Object.keys(attendanceStats)
    const classStats: Record<string, { present: number; total: number }> = {}

    dates.forEach(date => {
      const records = attendanceStats[date]
      students.forEach(student => {
        const cls = student.class || '未分班'
        if (!classStats[cls]) {
          classStats[cls] = { present: 0, total: 0 }
        }
        classStats[cls].total++
        const record = records[student.id]
        if (record && (record.status === 'present' || record.status === 'late')) {
          classStats[cls].present++
        }
      })
    })

    return Object.entries(classStats).map(([cls, stats]) => ({
      className: cls,
      rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      present: stats.present,
      total: stats.total
    })).sort((a, b) => b.rate - a.rate)
  }, [attendanceStats, students])

  // 出勤率低的班级
  const lowAttendanceClasses = useMemo(() => {
    return classAttendanceRates
      .filter(c => c.rate < 85)
      .map(c => ({ name: c.className, rate: c.rate }))
  }, [classAttendanceRates])

  // 生成专业建议
  const professionalAdvice = useMemo(() => {
    return generateAdvice({
      attendanceRate: attendanceSummary.attendanceRate,
      sickRate: attendanceSummary.sickRate,
      leaveRate: attendanceSummary.leaveRate,
      absentRate: attendanceSummary.absentRate,
      lateRate: attendanceSummary.lateRate,
      highTempRate: healthSummary.highTempRate,
      mealGoodRate: healthSummary.mealGoodRate,
      napGoodRate: healthSummary.napGoodRate,
      happyRate: healthSummary.happyRate,
      sickReasons: attendanceSummary.sickReasons,
      consecutiveAbsent: attendanceSummary.consecutiveAbsent,
      lowAttendanceClasses
    })
  }, [attendanceSummary, healthSummary, lowAttendanceClasses])

  // 渲染概览标签页
  const renderOverview = () => (
    <>
      {/* 园所运营卡片 */}
      <View className='stats-card operation'>
        <View className='card-header'>
          <Text className='card-title'>🏫 园所运营概览</Text>
        </View>
        
        <View className='operation-grid'>
          <View className='op-item'>
            <Text className='op-icon'>👶</Text>
            <Text className='op-value'>{students.length}</Text>
            <Text className='op-label'>在园幼儿</Text>
          </View>
          <View className='op-item'>
            <Text className='op-icon'>👨‍🏫</Text>
            <Text className='op-value'>{teachers.length}</Text>
            <Text className='op-label'>教职员工</Text>
          </View>
          <View className='op-item'>
            <Text className='op-icon'>🏠</Text>
            <Text className='op-value'>{classCount}</Text>
            <Text className='op-label'>班级数量</Text>
          </View>
          <View className='op-item'>
            <Text className='op-icon'>⚖️</Text>
            <Text className='op-value'>{teacherStudentRatio}</Text>
            <Text className='op-label'>师生比</Text>
          </View>
        </View>
      </View>

      {/* 核心指标卡片 */}
      <View className='stats-card kpi'>
        <View className='card-header'>
          <Text className='card-title'>📊 核心指标 ({getDateRangeText()})</Text>
        </View>
        
        <View className='kpi-grid'>
          <View className={`kpi-item ${attendanceSummary.attendanceRate >= 90 ? 'good' : attendanceSummary.attendanceRate >= 80 ? 'normal' : 'bad'}`}>
            <View className='kpi-main'>
              <Text className='kpi-value'>{attendanceSummary.attendanceRate}%</Text>
              <Text className='kpi-label'>出勤率</Text>
            </View>
            <Text className='kpi-trend'>{attendanceSummary.attendanceRate >= 90 ? '✅ 优秀' : attendanceSummary.attendanceRate >= 80 ? '📊 良好' : '⚠️ 关注'}</Text>
          </View>
          
          <View className={`kpi-item ${attendanceSummary.sickRate <= 5 ? 'good' : attendanceSummary.sickRate <= 10 ? 'normal' : 'bad'}`}>
            <View className='kpi-main'>
              <Text className='kpi-value'>{attendanceSummary.sickRate.toFixed(1)}%</Text>
              <Text className='kpi-label'>病假率</Text>
            </View>
            <Text className='kpi-trend'>{attendanceSummary.sickRate <= 5 ? '✅ 正常' : attendanceSummary.sickRate <= 10 ? '📊 关注' : '⚠️ 偏高'}</Text>
          </View>
          
          <View className={`kpi-item ${healthSummary.highTempRate <= 2 ? 'good' : healthSummary.highTempRate <= 5 ? 'normal' : 'bad'}`}>
            <View className='kpi-main'>
              <Text className='kpi-value'>{healthSummary.highTempRate.toFixed(1)}%</Text>
              <Text className='kpi-label'>体温异常率</Text>
            </View>
            <Text className='kpi-trend'>{healthSummary.highTempRate <= 2 ? '✅ 正常' : healthSummary.highTempRate <= 5 ? '📊 关注' : '🚨 警惕'}</Text>
          </View>
          
          <View className={`kpi-item ${healthSummary.mealGoodRate >= 70 ? 'good' : healthSummary.mealGoodRate >= 50 ? 'normal' : 'bad'}`}>
            <View className='kpi-main'>
              <Text className='kpi-value'>{healthSummary.mealGoodRate.toFixed(1)}%</Text>
              <Text className='kpi-label'>用餐良好率</Text>
            </View>
            <Text className='kpi-trend'>{healthSummary.mealGoodRate >= 70 ? '✅ 良好' : healthSummary.mealGoodRate >= 50 ? '📊 一般' : '⚠️ 关注'}</Text>
          </View>
        </View>
      </View>

      {/* 班级排名 */}
      {classAttendanceRates.length > 0 && (
        <View className='stats-card ranking'>
          <View className='card-header'>
            <Text className='card-title'>🏆 班级出勤率排名</Text>
          </View>
          
          <View className='rank-list'>
            {classAttendanceRates.map((item, index) => (
              <View key={item.className} className='rank-item'>
                <View className={`rank-badge ${index < 3 ? `top-${index + 1}` : ''}`}>
                  <Text>{index + 1}</Text>
                </View>
                <Text className='class-name'>{item.className}</Text>
                <View className='rate-bar'>
                  <View className='bar-fill' style={{ width: `${item.rate}%` }} />
                </View>
                <Text className={`rate-text ${item.rate >= 90 ? 'green' : item.rate >= 80 ? 'yellow' : 'red'}`}>{item.rate}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  )

  // 渲染考勤详情标签页
  const renderAttendance = () => (
    <>
      {/* 考勤统计卡片 */}
      <View className='stats-card attendance'>
        <View className='card-header'>
          <Text className='card-title'>📋 考勤统计</Text>
          <Text className='date-range'>{getDateRangeText()}</Text>
        </View>
        
        <View className='highlight-stat'>
          <Text className='big-number'>{attendanceSummary.attendanceRate}%</Text>
          <Text className='stat-label'>总出勤率</Text>
        </View>
        
        <View className='stat-grid'>
          <View className='stat-item'>
            <Text className='number green'>{attendanceSummary.present}</Text>
            <Text className='label'>出勤</Text>
          </View>
          <View className='stat-item'>
            <Text className='number yellow'>{attendanceSummary.late}</Text>
            <Text className='label'>迟到</Text>
          </View>
          <View className='stat-item'>
            <Text className='number red'>{attendanceSummary.absent}</Text>
            <Text className='label'>缺勤</Text>
          </View>
          <View className='stat-item'>
            <Text className='number orange'>{attendanceSummary.sick}</Text>
            <Text className='label'>病假</Text>
          </View>
          <View className='stat-item'>
            <Text className='number blue'>{attendanceSummary.leave}</Text>
            <Text className='label'>事假</Text>
          </View>
        </View>
      </View>

      {/* 病假原因分析 */}
      {Object.keys(attendanceSummary.sickReasons).length > 0 && (
        <View className='stats-card reason-analysis'>
          <View className='card-header'>
            <Text className='card-title'>🏥 病假原因分析</Text>
          </View>
          
          <View className='reason-list'>
            {Object.entries(attendanceSummary.sickReasons)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, count]) => {
                const total = Object.values(attendanceSummary.sickReasons).reduce((a, b) => a + b, 0)
                const percent = Math.round((count / total) * 100)
                return (
                  <View key={reason} className='reason-item'>
                    <Text className='reason-name'>{reason}</Text>
                    <View className='reason-bar'>
                      <View className='bar-fill sick' style={{ width: `${percent}%` }} />
                    </View>
                    <Text className='reason-count'>{count}次 ({percent}%)</Text>
                  </View>
                )
              })}
          </View>
        </View>
      )}

      {/* 事假原因分析 */}
      {Object.keys(attendanceSummary.leaveReasons).length > 0 && (
        <View className='stats-card reason-analysis'>
          <View className='card-header'>
            <Text className='card-title'>📝 事假原因分析</Text>
          </View>
          
          <View className='reason-list'>
            {Object.entries(attendanceSummary.leaveReasons)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, count]) => {
                const total = Object.values(attendanceSummary.leaveReasons).reduce((a, b) => a + b, 0)
                const percent = Math.round((count / total) * 100)
                return (
                  <View key={reason} className='reason-item'>
                    <Text className='reason-name'>{reason}</Text>
                    <View className='reason-bar'>
                      <View className='bar-fill leave' style={{ width: `${percent}%` }} />
                    </View>
                    <Text className='reason-count'>{count}次 ({percent}%)</Text>
                  </View>
                )
              })}
          </View>
        </View>
      )}

      {/* 连续缺勤预警 */}
      {attendanceSummary.consecutiveAbsent.length > 0 && (
        <View className='stats-card alert-card'>
          <View className='card-header'>
            <Text className='card-title'>🚨 连续缺勤预警</Text>
          </View>
          
          <View className='alert-content'>
            <View className='alert-icon-big'>⚠️</View>
            <Text className='alert-desc'>以下幼儿连续缺勤超过3天，请及时关注：</Text>
            <View className='alert-students'>
              {attendanceSummary.consecutiveAbsent.map(name => (
                <View key={name} className='alert-student-tag'>
                  <Text>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 出勤趋势 */}
      {attendanceSummary.dailyRates.length > 0 && (
        <View className='stats-card trend'>
          <View className='card-header'>
            <Text className='card-title'>📈 出勤趋势</Text>
          </View>
          
          <View className='trend-chart'>
            {attendanceSummary.dailyRates.slice(-7).map(item => (
              <View key={item.date} className='trend-bar'>
                <View 
                  className={`bar ${item.rate >= 90 ? 'green' : item.rate >= 80 ? 'yellow' : 'red'}`} 
                  style={{ height: `${item.rate}%` }}
                >
                  <Text className='bar-value'>{item.rate}%</Text>
                </View>
                <Text className='bar-date'>{item.date}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  )

  // 渲染健康详情标签页
  const renderHealth = () => (
    <>
      {/* 体温监控 */}
      <View className='stats-card temp-monitor'>
        <View className='card-header'>
          <Text className='card-title'>🌡️ 体温监控</Text>
        </View>
        
        <View className='temp-summary'>
          <View className='temp-main'>
            <Text className={`temp-value ${healthSummary.highTempRate > 5 ? 'danger' : healthSummary.highTempRate > 2 ? 'warning' : 'normal'}`}>
              {healthSummary.highTempCount}
            </Text>
            <Text className='temp-label'>体温异常次数</Text>
          </View>
          <View className='temp-info'>
            <Text className='info-text'>检测总数：{healthSummary.totalTempRecords}次</Text>
            <Text className='info-text'>异常率：{healthSummary.highTempRate.toFixed(1)}%</Text>
          </View>
        </View>

        {healthSummary.highTempStudents.length > 0 && (
          <View className='temp-list'>
            <Text className='list-title'>近期体温异常记录：</Text>
            {healthSummary.highTempStudents.map((item, idx) => (
              <View key={idx} className='temp-record'>
                <Text className='record-name'>{item.name}</Text>
                <Text className='record-temp'>{item.temp}℃</Text>
                <Text className='record-date'>{item.date}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 用餐情况 */}
      <View className='stats-card health'>
        <View className='card-header'>
          <Text className='card-title'>🍽️ 用餐情况</Text>
        </View>
        
        <View className='meal-summary'>
          <View className='meal-rate'>
            <Text className='rate-value'>{healthSummary.mealGoodRate.toFixed(1)}%</Text>
            <Text className='rate-label'>全吃率</Text>
          </View>
        </View>
        
        <View className='health-section'>
          <View className='bar-chart'>
            <View className='bar-row'>
              <Text className='bar-label'>全吃</Text>
              <View className='bar-track'>
                <View 
                  className='bar-value green' 
                  style={{ 
                    width: `${(healthSummary.mealStats.all / 
                      (healthSummary.mealStats.all + healthSummary.mealStats.half + healthSummary.mealStats.little || 1)) * 100}%` 
                  }} 
                />
              </View>
              <Text className='bar-count'>{healthSummary.mealStats.all}</Text>
            </View>
            <View className='bar-row'>
              <Text className='bar-label'>一半</Text>
              <View className='bar-track'>
                <View 
                  className='bar-value yellow' 
                  style={{ 
                    width: `${(healthSummary.mealStats.half / 
                      (healthSummary.mealStats.all + healthSummary.mealStats.half + healthSummary.mealStats.little || 1)) * 100}%` 
                  }} 
                />
              </View>
              <Text className='bar-count'>{healthSummary.mealStats.half}</Text>
            </View>
            <View className='bar-row'>
              <Text className='bar-label'>少量</Text>
              <View className='bar-track'>
                <View 
                  className='bar-value red' 
                  style={{ 
                    width: `${(healthSummary.mealStats.little / 
                      (healthSummary.mealStats.all + healthSummary.mealStats.half + healthSummary.mealStats.little || 1)) * 100}%` 
                  }} 
                />
              </View>
              <Text className='bar-count'>{healthSummary.mealStats.little}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 午睡与情绪 */}
      <View className='stats-card dual-section'>
        <View className='dual-item'>
          <View className='card-header'>
            <Text className='card-title'>😴 午睡质量</Text>
          </View>
          <View className='pie-stats'>
            <View className='pie-item'>
              <Text className='pie-value green'>{healthSummary.napStats.good}</Text>
              <Text className='pie-label'>好</Text>
            </View>
            <View className='pie-item'>
              <Text className='pie-value yellow'>{healthSummary.napStats.normal}</Text>
              <Text className='pie-label'>一般</Text>
            </View>
            <View className='pie-item'>
              <Text className='pie-value red'>{healthSummary.napStats.poor}</Text>
              <Text className='pie-label'>差</Text>
            </View>
          </View>
          <View className='summary-line'>
            <Text>良好率：</Text>
            <Text className='highlight'>{healthSummary.napGoodRate.toFixed(1)}%</Text>
          </View>
        </View>
        
        <View className='dual-item'>
          <View className='card-header'>
            <Text className='card-title'>😊 情绪状态</Text>
          </View>
          <View className='pie-stats'>
            <View className='pie-item'>
              <Text className='pie-value green'>{healthSummary.moodStats.happy}</Text>
              <Text className='pie-label'>开心</Text>
            </View>
            <View className='pie-item'>
              <Text className='pie-value yellow'>{healthSummary.moodStats.normal}</Text>
              <Text className='pie-label'>一般</Text>
            </View>
            <View className='pie-item'>
              <Text className='pie-value red'>{healthSummary.moodStats.upset}</Text>
              <Text className='pie-label'>不开心</Text>
            </View>
          </View>
          <View className='summary-line'>
            <Text>开心率：</Text>
            <Text className='highlight'>{healthSummary.happyRate.toFixed(1)}%</Text>
          </View>
        </View>
      </View>
    </>
  )

  // 渲染专业建议标签页
  const renderAdvice = () => (
    <>
      <View className='advice-header'>
        <Text className='advice-title'>🎯 智能分析报告</Text>
        <Text className='advice-subtitle'>基于{getDateRangeText()}数据分析</Text>
      </View>
      
      {professionalAdvice.map((item, index) => (
        <View key={index} className={`advice-card ${item.type}`}>
          <View className='advice-card-header'>
            <Text className='advice-icon'>
              {item.type === 'success' ? '✅' : item.type === 'warning' ? '⚠️' : item.type === 'danger' ? '🚨' : 'ℹ️'}
            </Text>
            <Text className='advice-card-title'>{item.title}</Text>
          </View>
          <Text className='advice-content'>{item.content}</Text>
        </View>
      ))}

      {/* 数据概览 */}
      <View className='stats-card overview'>
        <View className='card-header'>
          <Text className='card-title'>📋 数据概览</Text>
        </View>
        
        <View className='overview-grid'>
          <View className='overview-item'>
            <Text className='value'>{filteredStudents.length}</Text>
            <Text className='label'>学生总数</Text>
          </View>
          <View className='overview-item'>
            <Text className='value'>{attendanceSummary.dates}</Text>
            <Text className='label'>统计天数</Text>
          </View>
          <View className='overview-item'>
            <Text className='value'>{attendanceSummary.totalRecords}</Text>
            <Text className='label'>考勤记录</Text>
          </View>
          <View className='overview-item'>
            <Text className='value'>{healthSummary.totalTempRecords}</Text>
            <Text className='label'>体温记录</Text>
          </View>
        </View>
      </View>
    </>
  )

  return (
    <View className='stats-page'>
      <NavBar title='数据统计' backgroundColor='#6366f1' />
      <NavBarPlaceholder />
      
      {/* 头部 */}
      <View className='header'>
        <View className='header-top'>
          <Text className='title'>📊 园长数据看板</Text>
          <View className='range-tabs'>
            <View 
              className={`tab ${dateRange === 'today' ? 'active' : ''}`}
              onClick={() => setDateRange('today')}
            >
              <Text>今日</Text>
            </View>
            <View 
              className={`tab ${dateRange === 'week' ? 'active' : ''}`}
              onClick={() => setDateRange('week')}
            >
              <Text>7天</Text>
            </View>
            <View 
              className={`tab ${dateRange === 'month' ? 'active' : ''}`}
              onClick={() => setDateRange('month')}
            >
              <Text>30天</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 标签切换 */}
      <View className='tab-bar'>
        <View 
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Text className='tab-icon'>🏠</Text>
          <Text className='tab-text'>概览</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <Text className='tab-icon'>📋</Text>
          <Text className='tab-text'>考勤</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <Text className='tab-icon'>💊</Text>
          <Text className='tab-text'>健康</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'advice' ? 'active' : ''}`}
          onClick={() => setActiveTab('advice')}
        >
          <Text className='tab-icon'>💡</Text>
          <Text className='tab-text'>建议</Text>
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

      <ScrollView className='stats-content' scrollY>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'attendance' && renderAttendance()}
        {activeTab === 'health' && renderHealth()}
        {activeTab === 'advice' && renderAdvice()}
        
        <View style={{ height: '100rpx' }} />
      </ScrollView>
    </View>
  )
}
