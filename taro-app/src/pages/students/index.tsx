import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { getNavParams } from '../../utils/nav'
import { uploadStudent, downloadStudentsFromCloud } from '../../services/cloudSyncService'
import { 
  filterStudentsByPermission, 
  getAccessibleClasses, 
  getCurrentUser, 
  isAdmin,
  getPermissionHint 
} from '../../services/permissionService'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './index.scss'

interface Student {
  id: string
  name: string
  gender: '男' | '女'
  birthDate: string
  class: string
  campus: string
  avatar?: string
  status?: string
  
  // 健康信息
  height?: number
  weight?: number
  bloodType?: 'A' | 'B' | 'AB' | 'O' | '未知'
  allergies?: string[]
  healthNotes?: string
  
  // 家长信息
  parent_name: string
  parent_phone: string
  parent_relation: '父亲' | '母亲' | '爷爷' | '奶奶' | '外公' | '外婆' | '其他'
  
  // 紧急联系人
  emergency_contact?: string
  emergency_phone?: string
  emergency_relation?: string
  
  // 家庭信息
  address?: string
  idNumber?: string
  
  // 入园信息
  enrollDate: string
  studentNumber?: string
  
  // 特殊需求
  dietaryRestrictions?: string
  specialNeeds?: string
  
  // 收费相关
  classType?: 'standard' | 'excellence' | 'music'
  
  // 兼容旧字段
  className?: string
  parentName?: string
  parentPhone?: string
}

// 园区列表
const CAMPUS_LIST = ['十七幼', '九幼', '十二幼', '十幼', '八幼', '七幼', '创越', '新市花园', '高新', '南江']

// 血型选项
const BLOOD_TYPES = ['A', 'B', 'AB', 'O', '未知'] as const

// 家长关系选项
const PARENT_RELATIONS = ['父亲', '母亲', '爷爷', '奶奶', '外公', '外婆', '其他'] as const

// 班型选项
const CLASS_TYPES = [
  { value: 'standard', label: '标准班' },
  { value: 'excellence', label: '优苗班' },
  { value: 'music', label: '音乐班' },
] as const

export default function Students() {
  useGlobalShare({ title: '金星幼儿园 - 学生管理', path: '/pages/students/index' })
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedClass, setSelectedClass] = useState('全部')
  
  // 从URL参数或导航参数读取班级筛选
  useEffect(() => {
    // 先尝试从router.params读取（navigateTo跳转）
    let classParam = router.params.class
    if (classParam) {
      setSelectedClass(decodeURIComponent(classParam))
      return
    }
    // 再尝试从本地存储读取（switchTab跳转）
    const navParams = getNavParams('/pages/students/index')
    if (navParams?.class) {
      setSelectedClass(navParams.class)
    }
  }, [router.params.class])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formStep, setFormStep] = useState(1) // 分步表单
  const [newStudent, setNewStudent] = useState({
    // 基本信息
    name: '',
    gender: '男' as '男' | '女',
    birthDate: '',
    class: '',
    campus: '十七幼',
    
    // 健康信息
    bloodType: '未知' as 'A' | 'B' | 'AB' | 'O' | '未知',
    allergies: '',
    dietaryRestrictions: '',
    
    // 家长信息
    parent_name: '',
    parent_phone: '',
    parent_relation: '父亲' as '父亲' | '母亲' | '爷爷' | '奶奶' | '外公' | '外婆' | '其他',
    
    // 紧急联系人
    emergency_contact: '',
    emergency_phone: '',
    emergency_relation: '',
    
    // 入园信息
    enrollDate: new Date().toISOString().split('T')[0],
    studentNumber: '',
    
    // 班型
    classType: 'standard' as 'standard' | 'excellence' | 'music',
    
    // 其他
    address: '',
    specialNeeds: '',
  })

  // 权限相关状态
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [canEdit, setCanEdit] = useState(false) // 是否可以编辑（非厨师）
  const [accessibleClasses, setAccessibleClasses] = useState<string[]>([])
  const [permissionHint, setPermissionHint] = useState('')
  
  useEffect(() => {
    loadStudents()
    checkPermissions()
  }, [])

  useDidShow(() => {
    loadStudents()
    checkPermissions()
    // 检查是否有从首页传来的班级筛选参数
    const navParams = getNavParams('/pages/students/index')
    if (navParams?.class) {
      setSelectedClass(navParams.class)
    }
  })
  
  // 检查用户权限
  const checkPermissions = () => {
    const user = getCurrentUser()
    setUserIsAdmin(isAdmin(user))
    setAccessibleClasses(getAccessibleClasses(user))
    setPermissionHint(getPermissionHint(user))
    // 厨师不能编辑学生信息
    const isKitchen = user?.role?.toUpperCase() === 'KITCHEN'
    setCanEdit(!isKitchen)
  }

  const loadStudents = async () => {
    // 先加载本地数据
    const localData = Taro.getStorageSync('kt_students') || []
    console.log('[Students] 本地数据:', localData.length, '条')
    
    // 应用权限过滤
    const filteredData = filterStudentsByPermission(localData)
    setStudents(filteredData)
    console.log('[Students] 权限过滤后:', filteredData.length, '条')
    
    // 尝试从云端同步最新数据
    try {
      const result = await downloadStudentsFromCloud()
      if (result.success && result.data && result.data.length > 0) {
        // 同样应用权限过滤
        const filteredCloudData = filterStudentsByPermission(result.data)
        setStudents(filteredCloudData)
        console.log('[Students] 云端数据已同步:', filteredCloudData.length, '条 (原', result.data.length, '条)')
      }
    } catch (err) {
      console.log('[Students] 云端同步跳过:', err)
    }
  }

  // 获取学生字段（兼容不同字段名）
  const getStudentClass = (s: Student) => s.class || s.className || '未分班'
  const getParentName = (s: Student) => s.parent_name || s.parentName || ''
  const getParentPhone = (s: Student) => s.parent_phone || s.parentPhone || ''

  // 动态获取班级列表（基于权限过滤）
  const classList = useMemo(() => {
    // 如果是管理员，显示所有有学生的班级
    if (userIsAdmin) {
      const classSet = new Set<string>()
      students.forEach(s => {
        const cls = getStudentClass(s)
        if (cls && cls !== '未分班') {
          classSet.add(cls)
        }
      })
      const sorted = Array.from(classSet).sort((a, b) => a.localeCompare(b, 'zh-CN'))
      return ['全部', ...sorted]
    }
    
    // 普通用户只显示有权限的班级
    if (accessibleClasses.length === 0) {
      return ['全部']
    }
    return ['全部', ...accessibleClasses]
  }, [students, userIsAdmin, accessibleClasses])

  // 过滤学生
  const filteredStudents = students.filter(s => {
    const parentName = getParentName(s)
    const phone = getParentPhone(s)
    const matchSearch = !searchText || 
      s.name?.includes(searchText) || 
      parentName.includes(searchText) ||
      phone.includes(searchText)
    const studentClass = getStudentClass(s)
    const matchClass = selectedClass === '全部' || studentClass === selectedClass
    return matchSearch && matchClass
  })

  // 按班级分组
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const cls = getStudentClass(student)
    if (!acc[cls]) acc[cls] = []
    acc[cls].push(student)
    return acc
  }, {} as Record<string, Student[]>)

  // 班级排序
  const sortedGroups = Object.entries(groupedStudents).sort((a, b) => 
    a[0].localeCompare(b[0], 'zh-CN')
  )

  // 查看/编辑详情
  const viewDetail = (student: Student) => {
    Taro.navigateTo({
      url: `/pages/students/detail?id=${student.id}`
    })
  }

  // 考勤
  const goAttendance = (e: any, student: Student) => {
    e.stopPropagation()
    Taro.navigateTo({
      url: `/pages/students/attendance?id=${student.id}&name=${student.name}&class=${getStudentClass(student)}`
    })
  }

  // 重置表单
  const resetForm = () => {
    setNewStudent({
      name: '',
      gender: '男',
      birthDate: '',
      class: '',
      campus: '十七幼',
      bloodType: '未知',
      allergies: '',
      dietaryRestrictions: '',
      parent_name: '',
      parent_phone: '',
      parent_relation: '父亲',
      emergency_contact: '',
      emergency_phone: '',
      emergency_relation: '',
      enrollDate: new Date().toISOString().split('T')[0],
      studentNumber: '',
      classType: 'standard',
      address: '',
      specialNeeds: '',
    })
    setFormStep(1)
  }

  // 验证当前步骤
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!newStudent.name.trim()) {
        Taro.showToast({ title: '请输入学生姓名', icon: 'none' })
        return false
      }
      if (!newStudent.birthDate) {
        Taro.showToast({ title: '请选择出生日期', icon: 'none' })
        return false
      }
      if (!newStudent.class) {
        Taro.showToast({ title: '请选择班级', icon: 'none' })
        return false
      }
    }
    if (step === 2) {
      if (!newStudent.parent_name.trim()) {
        Taro.showToast({ title: '请输入家长姓名', icon: 'none' })
        return false
      }
      if (!newStudent.parent_phone.trim()) {
        Taro.showToast({ title: '请输入家长电话', icon: 'none' })
        return false
      }
      if (!/^1\d{10}$/.test(newStudent.parent_phone)) {
        Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return false
      }
    }
    return true
  }

  // 下一步
  const nextStep = () => {
    if (validateStep(formStep)) {
      setFormStep(formStep + 1)
    }
  }

  // 上一步
  const prevStep = () => {
    setFormStep(formStep - 1)
  }

  // 计算年龄
  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  // 添加学生
  const handleAddStudent = () => {
    if (!validateStep(formStep)) return

    const allergiesArray = newStudent.allergies 
      ? newStudent.allergies.split(/[,，、\s]+/).filter(a => a.trim())
      : []

    const student: Student = {
      id: `stu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newStudent.name.trim(),
      gender: newStudent.gender,
      birthDate: newStudent.birthDate,
      class: newStudent.class,
      campus: newStudent.campus,
      status: 'present',
      
      // 健康信息
      bloodType: newStudent.bloodType,
      allergies: allergiesArray,
      dietaryRestrictions: newStudent.dietaryRestrictions || undefined,
      
      // 家长信息
      parent_name: newStudent.parent_name.trim(),
      parent_phone: newStudent.parent_phone.trim(),
      parent_relation: newStudent.parent_relation,
      
      // 紧急联系人
      emergency_contact: newStudent.emergency_contact || undefined,
      emergency_phone: newStudent.emergency_phone || undefined,
      emergency_relation: newStudent.emergency_relation || undefined,
      
      // 入园信息
      enrollDate: newStudent.enrollDate,
      studentNumber: newStudent.studentNumber || undefined,
      
      // 班型
      classType: newStudent.classType,
      
      // 其他
      address: newStudent.address || undefined,
      specialNeeds: newStudent.specialNeeds || undefined,
      
      // 兼容旧字段
      className: newStudent.class,
      parentName: newStudent.parent_name.trim(),
      parentPhone: newStudent.parent_phone.trim(),
    }

    const updated = [...students, student]
    Taro.setStorageSync('kt_students', updated)
    setStudents(updated)
    setIsAddModalOpen(false)
    resetForm()

    Taro.showToast({ title: '添加成功', icon: 'success' })
    
    // 自动同步到云端
    uploadStudent(student).then(result => {
      if (result.success) {
        console.log('[Students] 新学生已同步到云端:', student.name)
      } else {
        console.error('[Students] 同步失败:', result.error)
      }
    })
  }

  return (
    <View className='students-page'>
      <NavBar title='学生管理' />
      <NavBarPlaceholder />
      
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input'>
          <Text className='icon'>🔍</Text>
          <Input
            placeholder='搜索姓名/家长/电话'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
          />
        </View>
        {canEdit && (
          <View className='add-btn' onClick={() => setIsAddModalOpen(true)}>
            <Text>+</Text>
          </View>
        )}
      </View>

      {/* 班级筛选 - 动态从数据中获取 */}
      <ScrollView className='class-filter' scrollX>
        {classList.map(cls => (
          <View
            key={cls}
            className={`filter-item ${selectedClass === cls ? 'active' : ''}`}
            onClick={() => setSelectedClass(cls)}
          >
            <Text>{cls}</Text>
            {cls !== '全部' && (
              <Text className='count'>
                {students.filter(s => getStudentClass(s) === cls).length}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      {/* 统计 + 权限提示 */}
      <View className='stats-bar'>
        <Text>共 {filteredStudents.length} 名学生</Text>
        <Text className='permission-hint'>{permissionHint}</Text>
      </View>

      {/* 学生列表 */}
      <ScrollView className='student-list' scrollY>
        {selectedClass === '全部' ? (
          // 分组显示
          sortedGroups.map(([cls, stuList]) => (
            <View key={cls} className='class-group'>
              <View className='class-header'>
                <Text className='class-name'>{cls}</Text>
                <Text className='count'>{stuList.length}人</Text>
              </View>
              {stuList.map(student => (
                <View key={student.id} className='student-card' onClick={() => viewDetail(student)}>
                  <View className='avatar'>
                    <Text>{student.gender === '女' ? '👧' : '👦'}</Text>
                  </View>
                  <View className='info'>
                    <Text className='name'>{student.name}</Text>
                    <Text className='meta'>{getParentPhone(student) || '未填电话'}</Text>
                  </View>
                  <View className='arrow'>
                    <Text>›</Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        ) : (
          // 平铺显示
          <View className='flat-list'>
            {filteredStudents.map(student => (
              <View key={student.id} className='student-card' onClick={() => viewDetail(student)}>
                <View className='avatar'>
                  <Text>{student.gender === '女' ? '👧' : '👦'}</Text>
                </View>
                <View className='info'>
                  <Text className='name'>{student.name}</Text>
                  <Text className='meta'>
                    {getParentName(student) || '未填家长'} · {getParentPhone(student) || '未填电话'}
                  </Text>
                </View>
                <View className='actions'>
                  <View className='action-btn' onClick={(e) => goAttendance(e, student)}>
                    <Text>📋</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {filteredStudents.length === 0 && (
          <View className='empty'>
            <Text className='icon'>📭</Text>
            <Text>暂无学生数据</Text>
            <Text className='hint'>请在「我的」页面同步云端数据</Text>
          </View>
        )}
      </ScrollView>

      {/* 添加学生弹窗 - 分步表单 */}
      {isAddModalOpen && (
        <View className='modal-overlay' onClick={() => { setIsAddModalOpen(false); resetForm() }}>
          <View className='modal-content large' onClick={(e) => e.stopPropagation()}>
            {/* 步骤指示器 */}
            <View className='step-indicator'>
              <View className={`step ${formStep >= 1 ? 'active' : ''}`}>
                <Text className='num'>1</Text>
                <Text className='label'>基本信息</Text>
              </View>
              <View className='line' />
              <View className={`step ${formStep >= 2 ? 'active' : ''}`}>
                <Text className='num'>2</Text>
                <Text className='label'>家长信息</Text>
              </View>
              <View className='line' />
              <View className={`step ${formStep >= 3 ? 'active' : ''}`}>
                <Text className='num'>3</Text>
                <Text className='label'>其他信息</Text>
              </View>
            </View>

            <ScrollView className='form-scroll' scrollY>
              {/* 第1步：基本信息 */}
              {formStep === 1 && (
                <View className='form-section'>
                  <Text className='section-title'>基本信息</Text>
                  
                  <View className='form-item'>
                    <Text className='label'>姓名 <Text className='required'>*</Text></Text>
                    <Input
                      placeholder='请输入学生姓名'
                      value={newStudent.name}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, name: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>性别 <Text className='required'>*</Text></Text>
                    <View className='option-group'>
                      {['男', '女'].map(g => (
                        <View
                          key={g}
                          className={`option-btn ${newStudent.gender === g ? 'active' : ''}`}
                          onClick={() => setNewStudent(prev => ({ ...prev, gender: g as '男' | '女' }))}
                        >
                          <Text>{g === '男' ? '👦' : '👧'} {g}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>出生日期 <Text className='required'>*</Text></Text>
                    <Picker 
                      mode='date' 
                      value={newStudent.birthDate}
                      start='2015-01-01'
                      end={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, birthDate: e.detail.value }))}
                    >
                      <View className='picker-value'>
                        {newStudent.birthDate || '请选择出生日期'}
                        {newStudent.birthDate && <Text className='age-hint'>（{calculateAge(newStudent.birthDate)}岁）</Text>}
                      </View>
                    </Picker>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>园区 <Text className='required'>*</Text></Text>
                    <View className='option-group wrap'>
                      {CAMPUS_LIST.map(c => (
                        <View
                          key={c}
                          className={`option-btn small ${newStudent.campus === c ? 'active' : ''}`}
                          onClick={() => setNewStudent(prev => ({ ...prev, campus: c }))}
                        >
                          <Text>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>班级 <Text className='required'>*</Text></Text>
                    <View className='option-group wrap'>
                      {classList.filter(c => c !== '全部').length > 0 ? (
                        classList.filter(c => c !== '全部').map(c => (
                          <View
                            key={c}
                            className={`option-btn small ${newStudent.class === c ? 'active' : ''}`}
                            onClick={() => setNewStudent(prev => ({ ...prev, class: c }))}
                          >
                            <Text>{c}</Text>
                          </View>
                        ))
                      ) : (
                        <Input
                          placeholder='请输入班级名称（如：大一班）'
                          value={newStudent.class}
                          onInput={(e) => setNewStudent(prev => ({ ...prev, class: e.detail.value }))}
                        />
                      )}
                    </View>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>班型</Text>
                    <View className='option-group'>
                      {CLASS_TYPES.map(t => (
                        <View
                          key={t.value}
                          className={`option-btn ${newStudent.classType === t.value ? 'active' : ''}`}
                          onClick={() => setNewStudent(prev => ({ ...prev, classType: t.value }))}
                        >
                          <Text>{t.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* 第2步：家长信息 */}
              {formStep === 2 && (
                <View className='form-section'>
                  <Text className='section-title'>家长信息</Text>
                  
                  <View className='form-item'>
                    <Text className='label'>监护人姓名 <Text className='required'>*</Text></Text>
                    <Input
                      placeholder='请输入家长姓名'
                      value={newStudent.parent_name}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, parent_name: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>与幼儿关系 <Text className='required'>*</Text></Text>
                    <View className='option-group wrap'>
                      {PARENT_RELATIONS.map(r => (
                        <View
                          key={r}
                          className={`option-btn small ${newStudent.parent_relation === r ? 'active' : ''}`}
                          onClick={() => setNewStudent(prev => ({ ...prev, parent_relation: r }))}
                        >
                          <Text>{r}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>联系电话 <Text className='required'>*</Text></Text>
                    <Input
                      type='number'
                      maxlength={11}
                      placeholder='请输入11位手机号'
                      value={newStudent.parent_phone}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, parent_phone: e.detail.value }))}
                    />
                  </View>

                  <View className='form-divider'>
                    <Text>紧急联系人（选填）</Text>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>紧急联系人</Text>
                    <Input
                      placeholder='请输入紧急联系人姓名'
                      value={newStudent.emergency_contact}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, emergency_contact: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>紧急联系电话</Text>
                    <Input
                      type='number'
                      maxlength={11}
                      placeholder='请输入紧急联系电话'
                      value={newStudent.emergency_phone}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, emergency_phone: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>与幼儿关系</Text>
                    <Input
                      placeholder='如：叔叔、姑姑等'
                      value={newStudent.emergency_relation}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, emergency_relation: e.detail.value }))}
                    />
                  </View>
                </View>
              )}

              {/* 第3步：其他信息 */}
              {formStep === 3 && (
                <View className='form-section'>
                  <Text className='section-title'>入园与健康信息</Text>
                  
                  <View className='form-item'>
                    <Text className='label'>入园日期</Text>
                    <Picker 
                      mode='date' 
                      value={newStudent.enrollDate}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, enrollDate: e.detail.value }))}
                    >
                      <View className='picker-value'>
                        {newStudent.enrollDate || '请选择入园日期'}
                      </View>
                    </Picker>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>学号</Text>
                    <Input
                      placeholder='选填，如无可留空'
                      value={newStudent.studentNumber}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, studentNumber: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>血型</Text>
                    <View className='option-group'>
                      {BLOOD_TYPES.map(b => (
                        <View
                          key={b}
                          className={`option-btn small ${newStudent.bloodType === b ? 'active' : ''}`}
                          onClick={() => setNewStudent(prev => ({ ...prev, bloodType: b }))}
                        >
                          <Text>{b}型</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='form-item'>
                    <Text className='label'>过敏史</Text>
                    <Input
                      placeholder='如有多项用逗号分隔，如：花生、牛奶'
                      value={newStudent.allergies}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, allergies: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>饮食禁忌</Text>
                    <Input
                      placeholder='如：不吃猪肉、素食等'
                      value={newStudent.dietaryRestrictions}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, dietaryRestrictions: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>家庭住址</Text>
                    <Input
                      placeholder='选填'
                      value={newStudent.address}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, address: e.detail.value }))}
                    />
                  </View>

                  <View className='form-item'>
                    <Text className='label'>特殊需求</Text>
                    <Input
                      placeholder='如有特殊情况请说明'
                      value={newStudent.specialNeeds}
                      onInput={(e) => setNewStudent(prev => ({ ...prev, specialNeeds: e.detail.value }))}
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* 底部按钮 */}
            <View className='modal-actions'>
              {formStep > 1 ? (
                <View className='btn cancel' onClick={prevStep}>
                  <Text>上一步</Text>
                </View>
              ) : (
                <View className='btn cancel' onClick={() => { setIsAddModalOpen(false); resetForm() }}>
                  <Text>取消</Text>
                </View>
              )}
              
              {formStep < 3 ? (
                <View className='btn confirm' onClick={nextStep}>
                  <Text>下一步</Text>
                </View>
              ) : (
                <View className='btn confirm' onClick={handleAddStudent}>
                  <Text>确认添加</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
