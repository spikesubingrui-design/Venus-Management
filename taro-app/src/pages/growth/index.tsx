import { View, Text, Textarea, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import useGlobalShare from '../../hooks/useGlobalShare'
import { ALL_TEMPLATES, TEMPLATES_BY_GRADE, EvaluationTemplate, EvaluationItem } from '../../data/evaluationTemplates'
import { uploadStudent, uploadEvaluation, uploadObservation, deleteObservationAndSync, downloadStudentsFromCloud } from '../../services/cloudSyncService'
import { getCurrentUser } from '../../services/permissionService'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './index.scss'

// 评价等级
const LEVELS = [
  { value: 5, label: '优秀', color: 'level-5' },
  { value: 4, label: '良好', color: 'level-4' },
  { value: 3, label: '一般', color: 'level-3' },
  { value: 2, label: '需加强', color: 'level-2' },
  { value: 1, label: '待发展', color: 'level-1' },
]

// 火山引擎API配置
const DOUBAO_CONFIG = {
  apiKey: '4af189ab-83aa-4a05-8e97-9104e9a9fcf6',
  textModel: 'ep-m-20260106154051-f4szt',
  visionApiKey: 'dbc246a9-05d7-460b-9b62-481151a3e8f3',
  visionModel: 'ep-20260203220912-hlqlx',
}

// AI润色API - 根据3-6岁儿童学习与发展指南
const polishComment = async (
  studentName: string, 
  grade: string,
  domain: string,
  templateName: string, 
  evaluationData: any,
  comment: string
) => {
  const apiKey = DOUBAO_CONFIG.apiKey
  if (!apiKey) {
    throw new Error('API Key未配置')
  }

  // 生成评价摘要
  const booleanItems = evaluationData.booleans || {}
  const ratingItems = evaluationData.ratings || {}
  const checkedCount = Object.values(booleanItems).filter(v => v).length
  const totalBooleans = Object.keys(booleanItems).length
  const avgRating = Object.values(ratingItems).length > 0 
    ? (Object.values(ratingItems) as number[]).reduce((a, b) => a + b, 0) / Object.values(ratingItems).length 
    : 0

  const prompt = `请根据《3-6岁儿童学习与发展指南》的标准，为幼儿园教师润色以下发展评价评语，使其更加专业、符合学龄前儿童发展特点。

学生姓名：${studentName}
年级：${grade}
评价领域：${domain}
评价类型：${templateName}
是/否项完成情况：${checkedCount}/${totalBooleans}项达标
等级评分平均分：${avgRating.toFixed(1)}/5

教师原始评语：
${comment || '（教师未填写评语）'}

要求：
1. 如果原评语为空，请根据评价结果生成一段专业评语
2. 语言温馨、专业，体现对幼儿发展的关注
3. 符合${grade}幼儿（${grade === '托班' ? '2-3岁' : grade === '小班' ? '3-4岁' : grade === '中班' ? '4-5岁' : '5-6岁'}）的年龄发展特点
4. 提供具体的发展建议
5. 控制在100-150字

请直接输出润色后的评语。`

  const response = await Taro.request({
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    data: {
      model: 'ep-m-20260106154051-f4szt',
      messages: [
        { role: 'system', content: '你是一位专业、温暖的幼儿园教师，根据《3-6岁儿童学习与发展指南》撰写评语。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    },
  })

  console.log('[总评润色] 响应:', JSON.stringify(response.data))
  
  // 检查错误
  if (response.data?.error) {
    throw new Error(response.data.error.message || 'API调用失败')
  }
  
  const choices = response.data?.choices || []
  if (choices.length === 0) {
    return comment // 返回原评语
  }
  
  const firstChoice = choices[0]
  let result = firstChoice?.message?.content || firstChoice?.delta?.content || firstChoice?.text || ''
  
  return result.trim() || comment
}

// AI润色单个填写项
const polishItemText = async (
  studentName: string,
  grade: string,
  domain: string,
  itemName: string,
  text: string
) => {
  const apiKey = DOUBAO_CONFIG.apiKey
  if (!apiKey) {
    throw new Error('API Key未配置')
  }

  const prompt = `请根据《3-6岁儿童学习与发展指南》的标准，润色以下幼儿园评价内容：

学生姓名：${studentName}
年级：${grade}（${grade === '托班' ? '2-3岁' : grade === '小班' ? '3-4岁' : grade === '中班' ? '4-5岁' : '5-6岁'}）
评价领域：${domain}
评价项目：${itemName}
教师原始填写内容：${text || '（未填写）'}

要求：
1. 语言温馨、专业，体现对幼儿发展的关注
2. 符合该年龄段幼儿的发展特点
3. 如原内容为空，根据项目名称生成简短评价
4. 控制在30-50字

请直接输出润色后的内容。`

  const response = await Taro.request({
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    data: {
      model: 'ep-m-20260106154051-f4szt',
      messages: [
        { role: 'system', content: '你是一位专业、温暖的幼儿园教师，根据《3-6岁儿童学习与发展指南》撰写评语。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    },
  })

  console.log('=== AI润色响应开始 ===')
  console.log('状态码:', response.statusCode)
  
  const data = response.data
  console.log('响应数据类型:', typeof data)
  console.log('响应数据keys:', data ? Object.keys(data) : 'null')
  
  // 检查错误
  if (data?.error) {
    console.error('API错误:', data.error)
    throw new Error(data.error.message || 'API调用失败')
  }
  
  const choices = data?.choices
  console.log('choices类型:', typeof choices)
  console.log('choices长度:', choices?.length)
  
  if (!choices || choices.length === 0) {
    throw new Error('AI未返回任何结果')
  }
  
  const firstChoice = choices[0]
  console.log('firstChoice类型:', typeof firstChoice)
  console.log('firstChoice keys:', firstChoice ? Object.keys(firstChoice) : 'null')
  
  // 打印所有属性
  for (const key of Object.keys(firstChoice || {})) {
    console.log(`firstChoice.${key}:`, JSON.stringify(firstChoice[key]))
  }
  
  // 获取内容 - 尝试所有可能位置
  let result = ''
  
  // 方式1: message.content
  if (firstChoice.message) {
    console.log('message keys:', Object.keys(firstChoice.message))
    console.log('message.content:', firstChoice.message.content)
    console.log('message.content类型:', typeof firstChoice.message.content)
    if (firstChoice.message.content) {
      result = String(firstChoice.message.content)
    }
  }
  
  // 方式2: delta.content (流式)
  if (!result && firstChoice.delta) {
    console.log('delta:', firstChoice.delta)
    if (firstChoice.delta.content) {
      result = String(firstChoice.delta.content)
    }
  }
  
  // 方式3: text
  if (!result && firstChoice.text) {
    result = String(firstChoice.text)
  }
  
  console.log('最终提取结果:', result)
  console.log('结果长度:', result?.length)
  console.log('=== AI润色响应结束 ===')
  
  if (!result || !result.trim()) {
    throw new Error('AI返回内容为空，请检查控制台详细日志')
  }
  
  return result.trim()
}

// 观察记录类型
interface ObservationRecord {
  id: string
  studentId: string
  studentName: string
  studentClass: string
  photos: string[]
  aiAnalysis: string
  teacherNote: string
  domain: string  // 观察领域：健康、语言、社会、科学、艺术
  createdAt: string
  createdBy: string
}

export default function GrowthPage() {
  useGlobalShare({ title: '金星幼儿园 - 成长档案', path: '/pages/growth/index' })
  const [activeTab, setActiveTab] = useState<'archive' | 'evaluation' | 'observation'>('evaluation')
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<EvaluationTemplate | null>(null)
  
  // 评价数据
  const [booleanValues, setBooleanValues] = useState<Record<string, boolean>>({})
  const [ratingValues, setRatingValues] = useState<Record<string, number>>({})
  const [textValues, setTextValues] = useState<Record<string, string>>({})
  
  const [isPolishing, setIsPolishing] = useState(false)
  const [polishingItemId, setPolishingItemId] = useState<string | null>(null)
  const [evaluations, setEvaluations] = useState<any[]>([])
  
  // 学生选择相关状态
  const [showStudentPicker, setShowStudentPicker] = useState(false)
  const [selectedClass, setSelectedClass] = useState<string>('全部')
  const [searchText, setSearchText] = useState('')
  
  // 年级筛选
  const [selectedGrade, setSelectedGrade] = useState<string>('全部')
  
  // 编辑学生资料状态
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  
  // 观察记录状态
  const [observations, setObservations] = useState<ObservationRecord[]>([])
  const [showObservationModal, setShowObservationModal] = useState(false)
  const [observationPhotos, setObservationPhotos] = useState<string[]>([])
  const [observationDomain, setObservationDomain] = useState('健康')
  const [observationNote, setObservationNote] = useState('')
  const [observationAiResult, setObservationAiResult] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // 最新评价展开状态
  const [isLatestEvalExpanded, setIsLatestEvalExpanded] = useState(false)
  
  // 权限控制：厨师只能查看
  const [canEdit, setCanEdit] = useState(true)

  useEffect(() => {
    // 检查权限
    const user = getCurrentUser()
    const isKitchen = user?.role?.toUpperCase() === 'KITCHEN'
    setCanEdit(!isKitchen)
    
    loadAllData()
  }, [])

  useDidShow(() => {
    loadAllData()
  })
  
  // 加载所有数据（本地 + 尝试云端同步）
  const loadAllData = async () => {
    // 先加载本地数据
    loadStudentsLocal()
    loadEvaluationsLocal()
    loadObservationsLocal()
    
    // 后台尝试从云端同步最新数据
    try {
      const result = await downloadStudentsFromCloud()
      if (result.success && result.data && result.data.length > 0) {
        setStudents(result.data)
        console.log('[成长档案] 云端学生数据已同步:', result.data.length, '条')
      }
    } catch (err) {
      console.log('[成长档案] 云端同步跳过:', err)
    }
  }

  const loadStudentsLocal = () => {
    const saved = Taro.getStorageSync('kt_students') || []
    setStudents(Array.isArray(saved) ? saved : [])
  }

  const loadEvaluationsLocal = () => {
    const saved = Taro.getStorageSync('kt_student_evaluations') || []
    setEvaluations(Array.isArray(saved) ? saved : [])
  }
  
  const loadObservationsLocal = () => {
    const saved = Taro.getStorageSync('kt_observations') || []
    setObservations(Array.isArray(saved) ? saved : [])
  }
  
  // 选择/拍摄照片
  const handleChoosePhoto = () => {
    Taro.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPhotos = [...observationPhotos, ...res.tempFilePaths].slice(0, 9)
        setObservationPhotos(newPhotos)
      }
    })
  }
  
  // 删除照片
  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...observationPhotos]
    newPhotos.splice(index, 1)
    setObservationPhotos(newPhotos)
  }
  
  // AI分析照片生成观察记录
  const analyzePhotosWithAI = async () => {
    if (observationPhotos.length === 0) {
      Taro.showToast({ title: '请先添加照片', icon: 'none' })
      return
    }
    if (!selectedStudent) {
      Taro.showToast({ title: '请先选择学生', icon: 'none' })
      return
    }
    
    setIsAnalyzing(true)
    try {
      const visionApiKey = DOUBAO_CONFIG.visionApiKey
      if (!visionApiKey) {
        throw new Error('视觉API Key未配置')
      }
      
      // 将图片转换为base64
      const imageContents: any[] = []
      for (const photo of observationPhotos.slice(0, 3)) { // 最多发送3张
        try {
          const fs = Taro.getFileSystemManager()
          const base64 = fs.readFileSync(photo, 'base64') as string
          imageContents.push({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`
            }
          })
        } catch (e) {
          console.error('读取图片失败:', e)
        }
      }
      
      const grade = selectedStudent.class || selectedStudent.className || '小班'
      const ageDesc = grade.includes('托') ? '2-3岁' : grade.includes('小') ? '3-4岁' : grade.includes('中') ? '4-5岁' : '5-6岁'
      
      const prompt = `你是一位专业的幼儿园教师，请根据照片对幼儿进行观察记录分析。

观察对象：${selectedStudent.name}（${grade}，${ageDesc}）
观察领域：${observationDomain}

请根据《3-6岁儿童学习与发展指南》中"${observationDomain}"领域的发展目标，分析照片中幼儿的表现，生成专业的观察记录。

要求：
1. 描述幼儿在照片中的行为表现
2. 分析该行为体现的发展水平
3. 给出具有针对性的教育建议
4. 语言温馨专业，符合幼儿发展特点
5. 控制在200-300字

请直接输出观察记录内容。`

      const response = await Taro.request({
        url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${visionApiKey}`,
        },
        data: {
          model: DOUBAO_CONFIG.visionModel,
          messages: [
            { 
              role: 'system', 
              content: '你是一位专业、温暖的幼儿园教师，熟悉《3-6岁儿童学习与发展指南》，擅长通过观察记录分析幼儿发展。' 
            },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: prompt },
                ...imageContents
              ]
            },
          ],
          temperature: 0.7,
          max_completion_tokens: 1000,
        },
      })
      
      const result = response.data?.choices?.[0]?.message?.content?.trim() || ''
      if (result) {
        setObservationAiResult(result)
        Taro.showToast({ title: 'AI分析完成', icon: 'success' })
      } else {
        throw new Error('AI返回结果为空')
      }
    } catch (error: any) {
      console.error('AI分析失败:', error)
      Taro.showToast({ 
        title: error.message || 'AI分析失败，请重试', 
        icon: 'none' 
      })
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  // 保存观察记录
  const saveObservation = () => {
    if (!selectedStudent) {
      Taro.showToast({ title: '请选择学生', icon: 'none' })
      return
    }
    if (observationPhotos.length === 0) {
      Taro.showToast({ title: '请添加照片', icon: 'none' })
      return
    }
    if (!observationAiResult && !observationNote) {
      Taro.showToast({ title: '请先进行AI分析或填写观察记录', icon: 'none' })
      return
    }
    
    const newRecord: ObservationRecord = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class || selectedStudent.className || '未分班',
      photos: observationPhotos,
      aiAnalysis: observationAiResult,
      teacherNote: observationNote,
      domain: observationDomain,
      createdAt: new Date().toISOString(),
      createdBy: '教师'
    }
    
    const updated = [newRecord, ...observations]
    setObservations(updated)
    Taro.setStorageSync('kt_observations', updated)
    
    // 重置状态
    setShowObservationModal(false)
    setObservationPhotos([])
    setObservationNote('')
    setObservationAiResult('')
    
    Taro.showToast({ title: '保存成功', icon: 'success' })
    
    // 自动同步到云端
    uploadObservation(newRecord).then(result => {
      if (result.success) {
        console.log('[成长档案] 观察记录已同步到云端')
      } else {
        console.error('[成长档案] 观察记录同步失败:', result.error)
      }
    })
  }
  
  // 删除观察记录
  const deleteObservation = (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条观察记录吗？',
      success: (res) => {
        if (res.confirm) {
          const updated = observations.filter(o => o.id !== id)
          setObservations(updated)
          Taro.setStorageSync('kt_observations', updated)
          Taro.showToast({ title: '已删除', icon: 'success' })
          
          // 同步删除到云端
          deleteObservationAndSync(id).then(result => {
            if (result.success) {
              console.log('[成长档案] 删除已同步到云端')
            }
          })
        }
      }
    })
  }
  
  // 筛选当前学生的观察记录
  const studentObservations = useMemo(() => {
    if (!selectedStudent) return observations
    return observations.filter(o => o.studentId === selectedStudent.id)
  }, [observations, selectedStudent])

  // 获取班级列表
  const classList = useMemo(() => {
    const classSet = new Set<string>()
    students.forEach(s => {
      const cls = s.class || s.className || '未分班'
      classSet.add(cls)
    })
    return ['全部', ...Array.from(classSet).sort((a, b) => a.localeCompare(b, 'zh-CN'))]
  }, [students])

  // 根据班级和搜索筛选学生
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const cls = s.class || s.className || '未分班'
      const matchClass = selectedClass === '全部' || cls === selectedClass
      const matchSearch = !searchText || s.name?.includes(searchText)
      return matchClass && matchSearch
    })
  }, [students, selectedClass, searchText])

  // 按班级分组
  const groupedStudents = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredStudents.forEach(s => {
      const cls = s.class || s.className || '未分班'
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(s)
    })
    return groups
  }, [filteredStudents])

  // 筛选模板
  const filteredTemplates = useMemo(() => {
    if (selectedGrade === '全部') return ALL_TEMPLATES
    return TEMPLATES_BY_GRADE[selectedGrade as keyof typeof TEMPLATES_BY_GRADE] || []
  }, [selectedGrade])

  // 该学生的历史评价
  const studentEvaluations = evaluations.filter(e => e.studentId === selectedStudent?.id)

  const completedEvaluations = useMemo(() => {
    return [...studentEvaluations]
      .filter(ev => ev.status === 'completed')
      .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime())
  }, [studentEvaluations])

  const latestCompletedEvaluation = completedEvaluations[0] || null

  const latestEvaluationTemplate = useMemo(() => {
    if (!latestCompletedEvaluation) return null
    return ALL_TEMPLATES.find(t => t.id === latestCompletedEvaluation.templateId) || null
  }, [latestCompletedEvaluation])

  const latestEvaluationTextItems = useMemo(() => {
    if (!latestCompletedEvaluation || !latestEvaluationTemplate) return []
    return latestEvaluationTemplate.items
      .filter(item => item.type === 'text')
      .map(item => ({
        id: item.id,
        name: item.name,
        value: latestCompletedEvaluation.data?.texts?.[item.id] || ''
      }))
      .filter(item => item.value && item.value.trim())
  }, [latestCompletedEvaluation, latestEvaluationTemplate])

  const latestEvaluationComment =
    latestEvaluationTextItems.find(item => item.name.includes('评语'))?.value || ''

  const latestEvaluationDetails = latestEvaluationTextItems.filter(
    item => !item.name.includes('评语')
  )

  const formatDate = (value: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })
  }

  // 计算完成进度
  const progress = useMemo(() => {
    if (!selectedTemplate) return 0
    let completed = 0
    let total = 0
    
    selectedTemplate.items.forEach(item => {
      if (item.type === 'boolean') {
        total++
        if (booleanValues[item.id] !== undefined) completed++
      } else if (item.type === 'rating') {
        total++
        if (ratingValues[item.id] > 0) completed++
      } else if (item.type === 'text') {
        total++
        if (textValues[item.id]?.trim()) completed++
      }
    })
    
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }, [selectedTemplate, booleanValues, ratingValues, textValues])

  // 选择学生
  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student)
    setShowStudentPicker(false)
    setSearchText('')
    setIsEditingProfile(false)
  }
  
  // 开始编辑学生资料
  const handleStartEditProfile = () => {
    if (!selectedStudent) return
    setEditForm({
      name: selectedStudent.name || '',
      gender: selectedStudent.gender || '男',
      class: selectedStudent.class || selectedStudent.className || '',
      birthDate: selectedStudent.birthDate || '',
      campus: selectedStudent.campus || '',
      bloodType: selectedStudent.bloodType || '',
      height: selectedStudent.height?.toString() || '',
      weight: selectedStudent.weight?.toString() || '',
      enrollDate: selectedStudent.enrollDate || '',
      parent_name: selectedStudent.parent_name || selectedStudent.parentName || '',
      parent_phone: selectedStudent.parent_phone || selectedStudent.parentPhone || '',
      parent_relation: selectedStudent.parent_relation || '',
      address: selectedStudent.address || '',
      allergies: (selectedStudent.allergies || []).join('、'),
      healthNotes: selectedStudent.healthNotes || '',
    })
    setIsEditingProfile(true)
  }
  
  // 保存学生资料
  const handleSaveProfile = () => {
    if (!selectedStudent) return
    
    const updatedStudent = {
      ...selectedStudent,
      name: editForm.name,
      gender: editForm.gender,
      class: editForm.class,
      className: editForm.class,
      birthDate: editForm.birthDate,
      campus: editForm.campus,
      bloodType: editForm.bloodType,
      height: editForm.height ? parseFloat(editForm.height) : undefined,
      weight: editForm.weight ? parseFloat(editForm.weight) : undefined,
      enrollDate: editForm.enrollDate,
      parent_name: editForm.parent_name,
      parentName: editForm.parent_name,
      parent_phone: editForm.parent_phone,
      parentPhone: editForm.parent_phone,
      parent_relation: editForm.parent_relation,
      address: editForm.address,
      allergies: editForm.allergies ? editForm.allergies.split(/[,，、\s]+/).filter((a: string) => a.trim()) : [],
      healthNotes: editForm.healthNotes,
      updatedAt: new Date().toISOString(),
    }
    
    // 更新本地存储
    const allStudents = Taro.getStorageSync('kt_students') || []
    const updated = allStudents.map((s: any) => s.id === selectedStudent.id ? updatedStudent : s)
    Taro.setStorageSync('kt_students', updated)
    
    // 更新状态
    setStudents(updated)
    setSelectedStudent(updatedStudent)
    setIsEditingProfile(false)
    
    Taro.showToast({ title: '保存成功', icon: 'success' })
    
    // 自动同步到云端
    uploadStudent(updatedStudent).then(result => {
      if (result.success) {
        console.log('[成长档案] 学生信息已同步到云端')
      } else {
        console.error('[成长档案] 学生信息同步失败:', result.error)
      }
    })
  }
  
  // 取消编辑
  const handleCancelEditProfile = () => {
    setIsEditingProfile(false)
    setEditForm({})
  }

  // 选择模板
  const handleSelectTemplate = (template: EvaluationTemplate) => {
    setSelectedTemplate(template)
    setBooleanValues({})
    setRatingValues({})
    setTextValues({})
  }

  // 设置布尔值（打钩）
  const handleToggleBoolean = (itemId: string) => {
    setBooleanValues(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // 设置评分
  const handleSetRating = (itemId: string, score: number) => {
    setRatingValues(prev => ({ ...prev, [itemId]: score }))
  }

  // 设置文本
  const handleSetText = (itemId: string, text: string) => {
    setTextValues(prev => ({ ...prev, [itemId]: text }))
  }

  // AI润色单个文本项
  const handlePolishItem = async (item: EvaluationItem) => {
    if (!selectedStudent || !selectedTemplate) return
    
    const originalText = textValues[item.id] || ''
    console.log('[润色] 开始润色, item:', item.id, '原文:', originalText)
    
    setPolishingItemId(item.id)
    try {
      const polished = await polishItemText(
        selectedStudent.name,
        selectedTemplate.grade,
        selectedTemplate.domain,
        item.name,
        originalText
      )
      console.log('[润色] 润色结果:', polished)
      
      // 使用函数式更新确保状态正确更新
      setTextValues(prev => {
        const newValues = { ...prev, [item.id]: polished }
        console.log('[润色] 更新后textValues:', newValues)
        return newValues
      })
      
      Taro.showToast({ title: '润色完成', icon: 'success' })
    } catch (error: any) {
      console.error('[润色] 错误:', error)
      Taro.showToast({ title: error.message || 'AI润色失败', icon: 'none' })
    } finally {
      setPolishingItemId(null)
    }
  }

  // AI润色总评语
  const handlePolishComment = async () => {
    if (!selectedStudent || !selectedTemplate) return
    
    // 找到最后一个text类型项作为总评语
    const commentItem = selectedTemplate.items.find(item => 
      item.type === 'text' && item.name.includes('评语')
    )
    if (!commentItem) return
    
    setIsPolishing(true)
    try {
      const evaluationData = {
        booleans: booleanValues,
        ratings: ratingValues,
        texts: textValues
      }
      
      const polished = await polishComment(
        selectedStudent.name,
        selectedTemplate.grade,
        selectedTemplate.domain,
        selectedTemplate.name,
        evaluationData,
        textValues[commentItem.id] || ''
      )
      setTextValues(prev => ({ ...prev, [commentItem.id]: polished }))
      Taro.showToast({ title: '润色完成', icon: 'success' })
    } catch (error: any) {
      Taro.showToast({ title: error.message || 'AI润色失败', icon: 'none' })
    } finally {
      setIsPolishing(false)
    }
  }

  // 保存评价
  const handleSave = (status: 'draft' | 'completed') => {
    if (!selectedStudent || !selectedTemplate) return

    const evalData = {
      booleans: booleanValues,
      ratings: ratingValues,
      texts: textValues
    }

    // 计算统计
    const checkedCount = Object.values(booleanValues).filter(v => v).length
    const totalBooleans = selectedTemplate.items.filter(i => i.type === 'boolean').length
    const ratingScores = Object.values(ratingValues)
    const avgRating = ratingScores.length > 0 
      ? ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length 
      : 0

    const evaluation = {
      id: `eval_${Date.now()}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class || selectedStudent.className,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      grade: selectedTemplate.grade,
      domain: selectedTemplate.domain,
      semester: selectedTemplate.semester,
      schoolYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      data: evalData,
      checkedCount,
      totalBooleans,
      averageRating: Math.round(avgRating * 10) / 10,
      evaluatedBy: '教师',
      evaluatedAt: new Date().toISOString(),
      status,
    }

    // 保存
    const updated = [...evaluations.filter(e => 
      !(e.studentId === selectedStudent.id && e.templateId === selectedTemplate.id && e.status === 'draft')
    ), evaluation]
    
    setEvaluations(updated)
    Taro.setStorageSync('kt_student_evaluations', updated)

    if (status === 'completed') {
      Taro.showToast({ title: '评价已保存', icon: 'success' })
      setSelectedTemplate(null)
      setBooleanValues({})
      setRatingValues({})
      setTextValues({})
      
      // 自动同步完成的评价到云端
      uploadEvaluation(evaluation).then(result => {
        if (result.success) {
          console.log('[成长档案] 评价已同步到云端')
        } else {
          console.error('[成长档案] 评价同步失败:', result.error)
        }
      })
    } else {
      Taro.showToast({ title: '草稿已保存', icon: 'success' })
    }
  }

  // 渲染评价项
  const renderEvalItem = (item: EvaluationItem, idx: number) => {
    if (item.type === 'boolean') {
      return (
        <View key={item.id} className='eval-item boolean'>
          <View 
            className={`checkbox-row ${booleanValues[item.id] ? 'checked' : ''}`}
            onClick={() => handleToggleBoolean(item.id)}
          >
            <View className='checkbox'>
              {booleanValues[item.id] && <Text className='check-icon'>✓</Text>}
            </View>
            <Text className='item-title'>{idx + 1}. {item.name}</Text>
          </View>
        </View>
      )
    }
    
    if (item.type === 'rating') {
      return (
        <View key={item.id} className='eval-item rating'>
          <Text className='item-title'>{idx + 1}. {item.name}</Text>
          <View className='score-btns'>
            {LEVELS.map(level => (
              <View
                key={level.value}
                className={`score-btn ${ratingValues[item.id] === level.value ? `selected ${level.color}` : ''}`}
                onClick={() => handleSetRating(item.id, level.value)}
              >
                {level.label}
              </View>
            ))}
          </View>
        </View>
      )
    }
    
    if (item.type === 'text') {
      const isComment = item.name.includes('评语')
      const currentValue = textValues[item.id] || ''
      const isPolishingThis = polishingItemId === item.id
      return (
        <View key={item.id} className='eval-item text'>
          <Text className='item-title'>{idx + 1}. {item.name}</Text>
          <Textarea
            className='text-input'
            value={currentValue}
            onInput={e => handleSetText(item.id, e.detail.value)}
            placeholder={isComment ? '输入评语后点击润色按钮优化...' : '请填写...'}
            maxlength={500}
          />
          {/* 单项AI润色按钮 */}
          <View 
            className={`item-polish-btn ${!currentValue.trim() || isPolishingThis ? 'disabled' : ''} ${isPolishingThis ? 'loading' : ''}`}
            onClick={() => currentValue.trim() && !isPolishingThis && handlePolishItem(item)}
          >
            <Text>{isPolishingThis ? '⏳ 润色中...' : '✨ 润色'}</Text>
          </View>
        </View>
      )
    }
    
    return null
  }

  return (
    <View className='growth-page'>
      <NavBar title='成长档案' />
      <NavBarPlaceholder />

      {/* 标签页 */}
      <View className='tabs'>
        <View 
          className={`tab ${activeTab === 'archive' ? 'active' : ''}`}
          onClick={() => setActiveTab('archive')}
        >
          📄 成长档案
        </View>
        <View 
          className={`tab ${activeTab === 'evaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluation')}
        >
          ✅ 发展评价
        </View>
        <View 
          className={`tab ${activeTab === 'observation' ? 'active' : ''}`}
          onClick={() => setActiveTab('observation')}
        >
          📷 观察记录
        </View>
      </View>

      {/* 学生选择器 */}
      <View className='student-selector' onClick={() => setShowStudentPicker(true)}>
        <View className='picker-box'>
          <Text className='label'>选择学生</Text>
          <Text className='value'>
            {selectedStudent 
              ? `${selectedStudent.name} - ${selectedStudent.class || selectedStudent.className}` 
              : '点击选择学生'}
          </Text>
          <Text className='arrow'>▼</Text>
        </View>
      </View>

      {/* 学生选择弹窗 */}
      {showStudentPicker && (
        <View className='student-picker-modal'>
          <View className='picker-overlay' onClick={() => setShowStudentPicker(false)} />
          <View className='picker-content'>
            <View className='picker-header'>
              <Text className='picker-title'>选择学生</Text>
              <Text className='picker-close' onClick={() => setShowStudentPicker(false)}>✕</Text>
            </View>
            
            <View className='search-box'>
              <Text className='search-icon'>🔍</Text>
              <Input
                className='search-input'
                placeholder='搜索学生姓名'
                value={searchText}
                onInput={e => setSearchText(e.detail.value)}
              />
              {searchText && (
                <Text className='clear-btn' onClick={() => setSearchText('')}>✕</Text>
              )}
            </View>
            
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
            
            <ScrollView className='student-list' scrollY>
              {selectedClass === '全部' ? (
                Object.entries(groupedStudents).map(([cls, stuList]) => (
                  <View key={cls} className='class-group'>
                    <View className='group-header'>
                      <Text className='group-name'>{cls}</Text>
                      <Text className='group-count'>{stuList.length}人</Text>
                    </View>
                    {stuList.map(student => (
                      <View
                        key={student.id}
                        className={`student-item ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                        onClick={() => handleSelectStudent(student)}
                      >
                        <View className='student-avatar'>
                          <Text>{student.gender === '女' ? '👧' : '👦'}</Text>
                        </View>
                        <Text className='student-name'>{student.name}</Text>
                        {selectedStudent?.id === student.id && (
                          <Text className='check-mark'>✓</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <View className='flat-list'>
                  {filteredStudents.map(student => (
                    <View
                      key={student.id}
                      className={`student-item ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                      onClick={() => handleSelectStudent(student)}
                    >
                      <View className='student-avatar'>
                        <Text>{student.gender === '女' ? '👧' : '👦'}</Text>
                      </View>
                      <Text className='student-name'>{student.name}</Text>
                      {selectedStudent?.id === student.id && (
                        <Text className='check-mark'>✓</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
              
              {filteredStudents.length === 0 && (
                <View className='empty-tip'>
                  <Text>暂无学生数据</Text>
                  <Text className='hint'>请先在「我的」页面同步数据</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {!selectedStudent ? (
        <View className='empty-state'>
          <Text className='icon'>👶</Text>
          <Text className='text'>请先选择一位学生</Text>
        </View>
      ) : activeTab === 'evaluation' ? (
        !selectedTemplate ? (
          <ScrollView className='template-scroll' scrollY>
            {/* 当前选中的学生信息 */}
            <View className='selected-student-card'>
              <View className='student-avatar large'>
                <Text>{selectedStudent.gender === '女' ? '👧' : '👦'}</Text>
              </View>
              <View className='student-info'>
                <Text className='name'>{selectedStudent.name}</Text>
                <Text className='class'>{selectedStudent.class || selectedStudent.className}</Text>
              </View>
              <View className='change-btn' onClick={() => setShowStudentPicker(true)}>
                <Text>换一个</Text>
              </View>
            </View>

            {/* 年级筛选 */}
            <View className='grade-filter'>
              <Text className='filter-label'>年级筛选：</Text>
              <ScrollView className='grade-tabs' scrollX>
                {['全部', '托班', '小班', '中班', '大班'].map(grade => (
                  <View
                    key={grade}
                    className={`grade-tab ${selectedGrade === grade ? 'active' : ''}`}
                    onClick={() => setSelectedGrade(grade)}
                  >
                    <Text>{grade}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* 评价模板列表 */}
            <View className='template-list'>
              <Text className='section-title'>📋 选择评价模板 ({filteredTemplates.length}个)</Text>
              {filteredTemplates.map(template => (
                <View 
                  key={template.id} 
                  className='template-card'
                  onClick={() => handleSelectTemplate(template)}
                >
                  <View className='template-header'>
                    <View className={`icon-box ${template.iconClass}`}>
                      <Text className='icon'>{template.icon}</Text>
                    </View>
                    <View className='info'>
                      <Text className='name'>{template.name}</Text>
                      <Text className='meta'>{template.grade} · {template.domain} · {template.semester}</Text>
                    </View>
                  </View>
                  <View className='template-stats'>
                    <Text className='item-count'>
                      {template.items.filter(i => i.type === 'boolean').length}项打钩 · 
                      {template.items.filter(i => i.type === 'rating').length}项评分 · 
                      {template.items.filter(i => i.type === 'text').length}项填写
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* 历史评价 */}
            {studentEvaluations.length > 0 && (
              <View className='history-list'>
                <Text className='section-title'>📝 历史评价记录</Text>
                {studentEvaluations.map(ev => (
                  <View key={ev.id} className='history-card'>
                    <View className='card-header'>
                      <Text className='template-name'>{ev.templateName}</Text>
                      <Text className='date'>{new Date(ev.evaluatedAt).toLocaleDateString()}</Text>
                    </View>
                    <View className='stats-row'>
                      <Text className='stat'>打钩: {ev.checkedCount}/{ev.totalBooleans}</Text>
                      {ev.averageRating > 0 && (
                        <Text className='stat'>评分: {ev.averageRating}/5</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (<>
          {/* 评价表单 */}
          <ScrollView className='evaluation-form' scrollY>
            <View className='form-header'>
              <View className='back-btn' onClick={() => setSelectedTemplate(null)}>
                ← 返回
              </View>
              <Text className='template-name'>{selectedTemplate.name}</Text>
            </View>

            <View className='current-student'>
              <Text>正在评价: </Text>
              <Text className='name'>{selectedStudent.name}</Text>
              <Text className='grade-tag'>{selectedTemplate.grade}</Text>
            </View>

            <View className='progress-bar'>
              <View className='progress' style={{ width: `${progress}%` }} />
            </View>
            <Text className='progress-text'>完成进度: {progress}%</Text>

            {/* 评价项目 */}
            <View className='eval-items'>
              {selectedTemplate.items.map((item, idx) => renderEvalItem(item, idx))}
            </View>

            {/* AI总评润色按钮 */}
            <View className='polish-section'>
              <View 
                className={`polish-btn ${isPolishing ? 'loading' : ''}`}
                onClick={handlePolishComment}
              >
                <Text>{isPolishing ? '⏳ AI润色中...' : '✨ 一键AI润色总评'}</Text>
              </View>
              <Text className='polish-hint'>基于《3-6岁儿童学习与发展指南》智能生成评语</Text>
            </View>

            {/* 底部留白，避免被固定按钮遮挡 */}
            <View style={{ height: '160rpx' }} />
          </ScrollView>

          {/* 固定底部操作按钮 */}
          {canEdit && (
            <View className='fixed-actions'>
              <View className='btn draft' onClick={() => handleSave('draft')}>
                📝 保存草稿
              </View>
              <View 
                className='btn submit'
                onClick={() => handleSave('completed')}
              >
                ✅ 完成评价
              </View>
            </View>
          )}
        </>)
      ) : activeTab === 'archive' ? (
        /* 成长档案视图 */
        <ScrollView className='archive-scroll' scrollY>
          {/* 学生信息卡片 */}
          <View className='archive-card student-profile'>
            <View className='profile-header'>
              <View className='avatar-large'>
                <Text>{selectedStudent.gender === '女' ? '👧' : '👦'}</Text>
              </View>
              <View className='profile-info'>
                <Text className='name'>{selectedStudent.name}</Text>
                <Text className='meta'>{selectedStudent.class || selectedStudent.className} · {selectedStudent.gender}</Text>
                {selectedStudent.birthDate && (
                  <Text className='meta'>🎂 {selectedStudent.birthDate}</Text>
                )}
              </View>
              {canEdit && (
                <View className='edit-profile-btn' onClick={handleStartEditProfile}>
                  <Text>✏️ 编辑</Text>
                </View>
              )}
            </View>
          </View>

          {/* 基本信息 - 只读模式 */}
              <View className='archive-card'>
                <View className='card-header'>
                  <Text className='card-title'>📋 基本信息</Text>
                </View>
                <View className='info-grid'>
                  <View className='info-item'>
                    <Text className='label'>园区</Text>
                    <Text className='value'>{selectedStudent.campus || '未设置'}</Text>
                  </View>
                  <View className='info-item'>
                    <Text className='label'>血型</Text>
                    <Text className='value'>{selectedStudent.bloodType || '未知'}</Text>
                  </View>
                  <View className='info-item'>
                    <Text className='label'>入园日期</Text>
                    <Text className='value'>{selectedStudent.enrollDate || '未记录'}</Text>
                  </View>
                  <View className='info-item'>
                    <Text className='label'>家长</Text>
                    <Text className='value'>{selectedStudent.parent_name || selectedStudent.parentName || '未设置'}</Text>
                  </View>
                  <View className='info-item'>
                    <Text className='label'>联系电话</Text>
                    <Text className='value'>{selectedStudent.parent_phone || selectedStudent.parentPhone || '未设置'}</Text>
                  </View>
                  <View className='info-item'>
                    <Text className='label'>家庭地址</Text>
                    <Text className='value'>{selectedStudent.address || '未设置'}</Text>
                  </View>
                </View>
              </View>

              {/* 健康信息 - 只读模式 */}
              <View className='archive-card'>
                <View className='card-header'>
                  <Text className='card-title'>💪 健康信息</Text>
                </View>
                <View className='health-stats'>
                  <View className='stat-item'>
                    <Text className='stat-value'>{selectedStudent.height || '--'}</Text>
                    <Text className='stat-label'>身高(cm)</Text>
                  </View>
                  <View className='stat-item'>
                    <Text className='stat-value'>{selectedStudent.weight || '--'}</Text>
                    <Text className='stat-label'>体重(kg)</Text>
                  </View>
                </View>
                {selectedStudent.allergies && selectedStudent.allergies.length > 0 && (
                  <View className='allergy-section'>
                    <Text className='allergy-title'>⚠️ 过敏信息</Text>
                    <View className='allergy-tags'>
                      {selectedStudent.allergies.map((item: string, idx: number) => (
                        <Text key={idx} className='allergy-tag'>{item}</Text>
                      ))}
                    </View>
                  </View>
                )}
                {selectedStudent.healthNotes && (
                  <View className='health-notes'>
                    <Text className='notes-title'>📝 健康备注</Text>
                    <Text className='notes-content'>{selectedStudent.healthNotes}</Text>
                  </View>
                )}
              </View>

          {/* 发展评价统计 */}
          <View className='archive-card'>
            <View className='card-header'>
              <Text className='card-title'>📊 发展评价统计</Text>
            </View>
            {studentEvaluations.length > 0 ? (
              <>
                <View className='eval-summary'>
                  <View className='summary-item'>
                    <Text className='summary-value'>{studentEvaluations.length}</Text>
                    <Text className='summary-label'>评价次数</Text>
                  </View>
                  <View className='summary-item'>
                    <Text className='summary-value'>
                      {studentEvaluations.filter(e => e.status === 'completed').length}
                    </Text>
                    <Text className='summary-label'>已完成</Text>
                  </View>
                  <View className='summary-item'>
                    <Text className='summary-value'>
                      {(studentEvaluations.reduce((sum, e) => sum + (e.averageRating || 0), 0) / studentEvaluations.length || 0).toFixed(1)}
                    </Text>
                    <Text className='summary-label'>平均评分</Text>
                  </View>
                </View>
                
                <View className='eval-history'>
                  <Text className='history-title'>最近评价</Text>
                  {studentEvaluations.slice(0, 3).map(ev => (
                    <View key={ev.id} className='eval-item'>
                      <View className='eval-info'>
                        <Text className='eval-name'>{ev.templateName}</Text>
                        <Text className='eval-date'>{new Date(ev.evaluatedAt).toLocaleDateString()}</Text>
                      </View>
                      <View className='eval-score'>
                        <Text className={`score-badge ${ev.averageRating >= 4 ? 'good' : ev.averageRating >= 3 ? 'normal' : 'low'}`}>
                          {ev.averageRating?.toFixed(1) || '--'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View className='no-eval'>
                <Text className='no-eval-icon'>📝</Text>
                <Text className='no-eval-text'>暂无评价记录</Text>
                <Text className='no-eval-hint'>切换到"发展评价"标签开始评价</Text>
              </View>
            )}
          </View>

          {/* 最新评价内容展示 - 可展开 */}
          {latestCompletedEvaluation && (
            <View className={`archive-card expandable ${isLatestEvalExpanded ? 'expanded' : ''}`}>
              <View 
                className='card-header clickable'
                onClick={() => setIsLatestEvalExpanded(!isLatestEvalExpanded)}
              >
                <View className='header-left'>
                  <Text className='card-title'>📝 最新发展评价</Text>
                  <Text className='card-date'>{formatDate(latestCompletedEvaluation.evaluatedAt)}</Text>
                </View>
                <View className={`expand-icon ${isLatestEvalExpanded ? 'expanded' : ''}`}>
                  <Text>{isLatestEvalExpanded ? '▲' : '▼'}</Text>
                </View>
              </View>
              
              {/* 预览信息 - 始终显示 */}
              <View className='latest-eval-info'>
                <Text className='eval-template-name'>{latestCompletedEvaluation.templateName}</Text>
                <View className='eval-meta'>
                  <Text className='meta-item'>📚 {latestCompletedEvaluation.domain}</Text>
                  <Text className='meta-item'>🎓 {latestCompletedEvaluation.grade}</Text>
                  {latestCompletedEvaluation.averageRating > 0 && (
                    <Text className='meta-item'>⭐ {latestCompletedEvaluation.averageRating.toFixed(1)}/5</Text>
                  )}
                </View>
              </View>
              
              {/* 展开后显示的详细内容 */}
              {isLatestEvalExpanded && (
                <View className='expanded-content'>
                  {/* 教师综合评语 */}
                  {latestEvaluationComment && (
                    <View className='eval-comment-section'>
                      <Text className='comment-title'>💬 教师综合评语</Text>
                      <View className='comment-content'>
                        <Text className='comment-text'>{latestEvaluationComment}</Text>
                      </View>
                    </View>
                  )}
                  
                  {/* 其他评价详情 */}
                  {latestEvaluationDetails.length > 0 && (
                    <View className='eval-details-section'>
                      <Text className='details-title'>📋 评价详情</Text>
                      {latestEvaluationDetails.map(item => (
                        <View key={item.id} className='detail-item'>
                          <Text className='detail-label'>{item.name}</Text>
                          <Text className='detail-value'>{item.value}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
              
              {/* 收起时的提示 */}
              {!isLatestEvalExpanded && (latestEvaluationComment || latestEvaluationDetails.length > 0) && (
                <View className='expand-hint' onClick={() => setIsLatestEvalExpanded(true)}>
                  <Text>点击查看详情 ▼</Text>
                </View>
              )}
            </View>
          )}

          {/* 成长轨迹提示 */}
          <View className='archive-card tips-card'>
            <Text className='tips-title'>💡 成长档案说明</Text>
            <Text className='tips-text'>• 成长档案记录孩子的发展历程</Text>
            <Text className='tips-text'>• 包含健康信息、发展评价等数据</Text>
            <Text className='tips-text'>• 定期更新评价，形成完整档案</Text>
          </View>

          <View style={{ height: '120rpx' }} />
        </ScrollView>
      ) : activeTab === 'observation' ? (
        /* 观察记录视图 */
        <View className='observation-view'>
          <View className='observation-header'>
            <View className='student-brief'>
              <View className='avatar-small'>
                <Text>{selectedStudent.gender === '女' ? '👧' : '👦'}</Text>
              </View>
              <Text className='student-name'>{selectedStudent.name}</Text>
              <View className='change-btn' onClick={() => setShowStudentPicker(true)}>
                <Text>换一个</Text>
              </View>
            </View>
            {canEdit && (
              <View className='add-observation-btn' onClick={() => setShowObservationModal(true)}>
                <Text>📷 新增观察</Text>
              </View>
            )}
          </View>
          
          <ScrollView className='observation-scroll' scrollY>
            {studentObservations.length > 0 ? (
              studentObservations.map(obs => (
                <View key={obs.id} className='observation-card'>
                  <View className='card-header'>
                    <View className='domain-tag'>
                      <Text>{obs.domain}</Text>
                    </View>
                    <Text className='date'>{new Date(obs.createdAt).toLocaleDateString()}</Text>
                    {canEdit && (
                      <View className='delete-btn' onClick={() => deleteObservation(obs.id)}>
                        <Text>🗑️</Text>
                      </View>
                    )}
                  </View>
                  
                  {obs.photos.length > 0 && (
                    <View className='photo-list'>
                      {obs.photos.map((photo, idx) => (
                        <Image 
                          key={idx} 
                          src={photo} 
                          className='photo-item'
                          mode='aspectFill'
                          onClick={() => Taro.previewImage({ urls: obs.photos, current: photo })}
                        />
                      ))}
                    </View>
                  )}
                  
                  {obs.aiAnalysis && (
                    <View className='analysis-section'>
                      <Text className='analysis-label'>🤖 AI观察分析</Text>
                      <Text className='analysis-content'>{obs.aiAnalysis}</Text>
                    </View>
                  )}
                  
                  {obs.teacherNote && (
                    <View className='note-section'>
                      <Text className='note-label'>✍️ 教师记录</Text>
                      <Text className='note-content'>{obs.teacherNote}</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View className='empty-observation'>
                <Text className='icon'>📷</Text>
                <Text className='text'>暂无观察记录</Text>
                <Text className='hint'>点击"新增观察"拍摄照片记录孩子的成长</Text>
              </View>
            )}
            <View style={{ height: '120rpx' }} />
          </ScrollView>
        </View>
      ) : null}

      {/* 观察记录新增模态框 */}
      {showObservationModal && selectedStudent && (
        <View className='observation-modal'>
          <View className='modal-header'>
            <View className='back-btn' onClick={() => {
              setShowObservationModal(false)
              setObservationPhotos([])
              setObservationNote('')
              setObservationAiResult('')
            }}>
              <Text>✕</Text>
            </View>
            <Text className='modal-title'>新增观察记录</Text>
            <View className='save-btn' onClick={saveObservation}>
              <Text>保存</Text>
            </View>
          </View>
          
          <ScrollView className='modal-scroll' scrollY>
            {/* 学生信息 */}
            <View className='modal-section'>
              <Text className='section-title'>观察对象</Text>
              <View className='student-info-row'>
                <View className='avatar'>
                  <Text>{selectedStudent.gender === '女' ? '👧' : '👦'}</Text>
                </View>
                <View className='info'>
                  <Text className='name'>{selectedStudent.name}</Text>
                  <Text className='class'>{selectedStudent.class || selectedStudent.className}</Text>
                </View>
              </View>
            </View>
            
            {/* 观察领域选择 */}
            <View className='modal-section'>
              <Text className='section-title'>观察领域</Text>
              <View className='domain-options'>
                {['健康', '语言', '社会', '科学', '艺术'].map(domain => (
                  <View 
                    key={domain}
                    className={`domain-option ${observationDomain === domain ? 'active' : ''}`}
                    onClick={() => setObservationDomain(domain)}
                  >
                    <Text>{domain}</Text>
                  </View>
                ))}
              </View>
            </View>
            
            {/* 照片上传 */}
            <View className='modal-section'>
              <Text className='section-title'>观察照片 ({observationPhotos.length}/9)</Text>
              <View className='photo-upload'>
                {observationPhotos.map((photo, idx) => (
                  <View key={idx} className='photo-wrapper'>
                    <Image src={photo} className='photo-preview' mode='aspectFill' />
                    <View className='remove-btn' onClick={() => handleRemovePhoto(idx)}>
                      <Text>✕</Text>
                    </View>
                  </View>
                ))}
                {observationPhotos.length < 9 && (
                  <View className='add-photo-btn' onClick={handleChoosePhoto}>
                    <Text className='icon'>📷</Text>
                    <Text className='text'>添加照片</Text>
                  </View>
                )}
              </View>
            </View>
            
            {/* AI分析按钮 */}
            <View className='modal-section'>
              <View 
                className={`ai-analyze-btn ${isAnalyzing ? 'loading' : ''} ${observationPhotos.length === 0 ? 'disabled' : ''}`}
                onClick={analyzePhotosWithAI}
              >
                <Text>{isAnalyzing ? '🔄 AI分析中...' : '🤖 AI智能分析照片'}</Text>
              </View>
              <Text className='ai-hint'>AI将根据照片内容和《3-6岁儿童学习与发展指南》生成观察记录</Text>
            </View>
            
            {/* AI分析结果 */}
            {observationAiResult && (
              <View className='modal-section'>
                <Text className='section-title'>🤖 AI分析结果</Text>
                <View className='ai-result'>
                  <Text className='result-text'>{observationAiResult}</Text>
                </View>
              </View>
            )}
            
            {/* 教师备注 */}
            <View className='modal-section'>
              <Text className='section-title'>✍️ 教师补充记录（选填）</Text>
              <Textarea
                className='note-textarea'
                value={observationNote}
                onInput={e => setObservationNote(e.detail.value)}
                placeholder='可以补充AI分析未涵盖的观察细节...'
                maxlength={500}
              />
            </View>
            
            <View style={{ height: '120rpx' }} />
          </ScrollView>
        </View>
      )}

      {/* 编辑资料全屏模态框 */}
      {isEditingProfile && selectedStudent && (
        <View className='edit-profile-modal'>
          <View className='edit-modal-header'>
            <View className='back-btn' onClick={handleCancelEditProfile}>
              <Text>✕</Text>
            </View>
            <Text className='modal-title'>编辑学生资料</Text>
            <View className='save-btn' onClick={handleSaveProfile}>
              <Text>💾 保存</Text>
            </View>
          </View>
          
          <ScrollView className='edit-modal-scroll' scrollY>
            {/* 学生头像卡片 */}
            <View className='profile-avatar-card'>
              <View className='avatar-wrapper'>
                <View className={`avatar-circle ${editForm.gender === '女' ? 'female' : 'male'}`}>
                  <Text className='avatar-emoji'>{editForm.gender === '女' ? '👧' : '👦'}</Text>
                </View>
                <View className='avatar-name'>
                  <Text className='name'>{editForm.name || '未填写姓名'}</Text>
                  <Text className='class-info'>{editForm.class || '未分班'}</Text>
                </View>
              </View>
              <View className='gender-switch'>
                {['男', '女'].map(g => (
                  <View
                    key={g}
                    className={`gender-btn ${editForm.gender === g ? 'active' : ''}`}
                    onClick={() => setEditForm({...editForm, gender: g})}
                  >
                    <Text className='gender-icon'>{g === '男' ? '👦' : '👧'}</Text>
                    <Text className='gender-text'>{g}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 基本信息编辑 */}
            <View className='edit-section'>
              <View className='section-header'>
                <Text className='section-icon'>📋</Text>
                <Text className='section-title'>基本信息</Text>
              </View>
              <View className='form-group'>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>👤</Text>
                    <Input
                      className='form-input'
                      value={editForm.name}
                      onInput={e => setEditForm({...editForm, name: e.detail.value})}
                      placeholder='请输入姓名'
                    />
                  </View>
                  <Text className='form-hint'>学生的真实姓名</Text>
                </View>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>🏫</Text>
                    <Input
                      className='form-input'
                      value={editForm.class}
                      onInput={e => setEditForm({...editForm, class: e.detail.value})}
                      placeholder='如：大一班'
                    />
                  </View>
                  <Text className='form-hint'>所在班级名称</Text>
                </View>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>🎂</Text>
                    <Input
                      className='form-input'
                      value={editForm.birthDate}
                      onInput={e => setEditForm({...editForm, birthDate: e.detail.value})}
                      placeholder='如：2020-06-15'
                    />
                  </View>
                  <Text className='form-hint'>出生日期</Text>
                </View>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>🏠</Text>
                    <Input
                      className='form-input'
                      value={editForm.campus}
                      onInput={e => setEditForm({...editForm, campus: e.detail.value})}
                      placeholder='如：十七幼'
                    />
                  </View>
                  <Text className='form-hint'>所属园区</Text>
                </View>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>📅</Text>
                    <Input
                      className='form-input'
                      value={editForm.enrollDate}
                      onInput={e => setEditForm({...editForm, enrollDate: e.detail.value})}
                      placeholder='如：2023-09-01'
                    />
                  </View>
                  <Text className='form-hint'>入园日期</Text>
                </View>
              </View>
            </View>

            {/* 健康信息编辑 */}
            <View className='edit-section health-section'>
              <View className='section-header'>
                <Text className='section-icon'>💪</Text>
                <Text className='section-title'>健康信息</Text>
              </View>
              <View className='form-group'>
                <View className='stats-row'>
                  <View className='stat-input-card'>
                    <Text className='stat-icon'>📏</Text>
                    <Input
                      className='stat-input'
                      type='digit'
                      value={editForm.height}
                      onInput={e => setEditForm({...editForm, height: e.detail.value})}
                      placeholder='--'
                    />
                    <Text className='stat-unit'>cm</Text>
                    <Text className='stat-label'>身高</Text>
                  </View>
                  <View className='stat-input-card'>
                    <Text className='stat-icon'>⚖️</Text>
                    <Input
                      className='stat-input'
                      type='digit'
                      value={editForm.weight}
                      onInput={e => setEditForm({...editForm, weight: e.detail.value})}
                      placeholder='--'
                    />
                    <Text className='stat-unit'>kg</Text>
                    <Text className='stat-label'>体重</Text>
                  </View>
                </View>
                <View className='form-item'>
                  <Text className='form-label'>🩸 血型</Text>
                  <View className='blood-options'>
                    {['A', 'B', 'AB', 'O', '未知'].map(bt => (
                      <View
                        key={bt}
                        className={`blood-option ${editForm.bloodType === bt ? 'active' : ''}`}
                        onClick={() => setEditForm({...editForm, bloodType: bt})}
                      >
                        <Text>{bt}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View className='form-item'>
                  <View className='input-wrapper warning'>
                    <Text className='input-icon'>⚠️</Text>
                    <Input
                      className='form-input'
                      value={editForm.allergies}
                      onInput={e => setEditForm({...editForm, allergies: e.detail.value})}
                      placeholder='如：牛奶、花生、海鲜'
                    />
                  </View>
                  <Text className='form-hint'>过敏原信息（多项用顿号分隔）</Text>
                </View>
                <View className='form-item'>
                  <Text className='form-label'>📝 健康备注</Text>
                  <Textarea
                    className='form-textarea'
                    value={editForm.healthNotes}
                    onInput={e => setEditForm({...editForm, healthNotes: e.detail.value})}
                    placeholder='如：有轻微哮喘，需注意通风；定期复查视力...'
                    maxlength={200}
                  />
                </View>
              </View>
            </View>

            {/* 家长信息编辑 */}
            <View className='edit-section'>
              <View className='section-header'>
                <Text className='section-icon'>👨‍👩‍👧</Text>
                <Text className='section-title'>家长信息</Text>
              </View>
              <View className='form-group'>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>👤</Text>
                    <Input
                      className='form-input'
                      value={editForm.parent_name}
                      onInput={e => setEditForm({...editForm, parent_name: e.detail.value})}
                      placeholder='请输入家长姓名'
                    />
                  </View>
                  <Text className='form-hint'>主要联系人姓名</Text>
                </View>
                <View className='form-item'>
                  <Text className='form-label'>👪 与孩子关系</Text>
                  <View className='relation-options'>
                    {['父亲', '母亲', '爷爷', '奶奶', '外公', '外婆', '其他'].map(r => (
                      <View
                        key={r}
                        className={`relation-option ${editForm.parent_relation === r ? 'active' : ''}`}
                        onClick={() => setEditForm({...editForm, parent_relation: r})}
                      >
                        <Text>{r}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>📱</Text>
                    <Input
                      className='form-input'
                      type='number'
                      value={editForm.parent_phone}
                      onInput={e => setEditForm({...editForm, parent_phone: e.detail.value})}
                      placeholder='请输入手机号'
                    />
                  </View>
                  <Text className='form-hint'>紧急联系电话</Text>
                </View>
                <View className='form-item'>
                  <View className='input-wrapper'>
                    <Text className='input-icon'>🏡</Text>
                    <Input
                      className='form-input'
                      value={editForm.address}
                      onInput={e => setEditForm({...editForm, address: e.detail.value})}
                      placeholder='请输入家庭地址'
                    />
                  </View>
                  <Text className='form-hint'>家庭住址</Text>
                </View>
              </View>
            </View>
            
            <View style={{ height: '100rpx' }} />
          </ScrollView>
        </View>
      )}
    </View>
  )
}
