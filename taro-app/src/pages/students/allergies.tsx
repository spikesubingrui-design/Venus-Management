import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './allergies.scss'

interface Student {
  id: string
  name: string
  class: string
  allergies?: string[]
  dietaryRestrictions?: string
}

export default function Allergies() {
  useGlobalShare({ title: '金星幼儿园 - 过敏管理', path: '/pages/students/allergies' })
  const [students, setStudents] = useState<Student[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedClass, setSelectedClass] = useState('全部')

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = () => {
    const data = Taro.getStorageSync('kt_students') || []
    setStudents(Array.isArray(data) ? data : [])
  }

  // 获取班级列表
  const classList = useMemo(() => {
    const classes = new Set(students.map(s => s.class || '未分班'))
    return ['全部', ...Array.from(classes).sort((a, b) => a.localeCompare(b, 'zh-CN'))]
  }, [students])

  // 筛选有过敏信息的学生
  const allergicStudents = useMemo(() => {
    return students.filter(s => {
      const hasAllergies = s.allergies && s.allergies.length > 0
      const hasDietaryRestrictions = s.dietaryRestrictions && s.dietaryRestrictions.trim()
      return hasAllergies || hasDietaryRestrictions
    })
  }, [students])

  // 根据搜索和班级筛选
  const filteredStudents = useMemo(() => {
    return allergicStudents.filter(s => {
      const matchClass = selectedClass === '全部' || s.class === selectedClass
      const matchSearch = !searchText || 
        s.name.includes(searchText) || 
        (s.allergies || []).some(a => a.includes(searchText))
      return matchClass && matchSearch
    })
  }, [allergicStudents, selectedClass, searchText])

  // 统计过敏原
  const allergenStats = useMemo(() => {
    const stats: Record<string, number> = {}
    allergicStudents.forEach(s => {
      (s.allergies || []).forEach(allergen => {
        stats[allergen] = (stats[allergen] || 0) + 1
      })
    })
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [allergicStudents])

  // 按班级分组
  const groupedByClass = useMemo(() => {
    const groups: Record<string, Student[]> = {}
    filteredStudents.forEach(s => {
      const cls = s.class || '未分班'
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(s)
    })
    return groups
  }, [filteredStudents])

  return (
    <View className='allergies-page'>
      <NavBar title='过敏信息' />
      <NavBarPlaceholder />
      
      {/* 顶部统计 */}
      <View className='stats-header'>
        <View className='stat-card total'>
          <Text className='stat-number'>{students.length}</Text>
          <Text className='stat-label'>总学生数</Text>
        </View>
        <View className='stat-card allergic'>
          <Text className='stat-number'>{allergicStudents.length}</Text>
          <Text className='stat-label'>有过敏史</Text>
        </View>
        <View className='stat-card rate'>
          <Text className='stat-number'>
            {students.length > 0 ? Math.round(allergicStudents.length / students.length * 100) : 0}%
          </Text>
          <Text className='stat-label'>过敏比例</Text>
        </View>
      </View>

      {/* 常见过敏原 */}
      {allergenStats.length > 0 && (
        <View className='allergen-section'>
          <Text className='section-title'>⚠️ 常见过敏原统计</Text>
          <View className='allergen-tags'>
            {allergenStats.map(([allergen, count]) => (
              <View 
                key={allergen} 
                className='allergen-tag'
                onClick={() => setSearchText(allergen)}
              >
                <Text className='allergen-name'>{allergen}</Text>
                <Text className='allergen-count'>{count}人</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 搜索和筛选 */}
      <View className='filter-bar'>
        <View className='search-box'>
          <Text className='search-icon'>🔍</Text>
          <Input
            className='search-input'
            placeholder='搜索学生姓名或过敏原'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
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
      </View>

      {/* 学生列表 */}
      <ScrollView className='student-list' scrollY>
        {filteredStudents.length === 0 ? (
          <View className='empty-state'>
            <Text className='empty-icon'>✅</Text>
            <Text className='empty-text'>
              {searchText || selectedClass !== '全部' 
                ? '没有匹配的记录' 
                : '暂无过敏信息记录'}
            </Text>
          </View>
        ) : (
          Object.entries(groupedByClass).map(([className, classStudents]) => (
            <View key={className} className='class-group'>
              <View className='class-header'>
                <Text className='class-name'>{className}</Text>
                <Text className='class-count'>{classStudents.length}人</Text>
              </View>
              
              {classStudents.map(student => (
                <View key={student.id} className='student-card'>
                  <View className='student-info'>
                    <Text className='student-name'>{student.name}</Text>
                  </View>
                  
                  <View className='allergy-info'>
                    {student.allergies && student.allergies.length > 0 && (
                      <View className='allergy-row'>
                        <Text className='allergy-label'>🚨 过敏原:</Text>
                        <View className='allergy-items'>
                          {student.allergies.map((allergen, idx) => (
                            <Text key={idx} className='allergy-item'>{allergen}</Text>
                          ))}
                        </View>
                      </View>
                    )}
                    
                    {student.dietaryRestrictions && (
                      <View className='dietary-row'>
                        <Text className='dietary-label'>🍽️ 饮食禁忌:</Text>
                        <Text className='dietary-text'>{student.dietaryRestrictions}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* 厨房提醒 */}
      <View className='kitchen-reminder'>
        <Text className='reminder-icon'>👨‍🍳</Text>
        <Text className='reminder-text'>
          制作食物时请特别注意以上过敏信息，确保食品安全
        </Text>
      </View>
    </View>
  )
}
