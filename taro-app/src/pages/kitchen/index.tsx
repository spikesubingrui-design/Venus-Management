import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { downloadFromAliyun, uploadToAliyun, STORAGE_KEYS } from '../../services/aliyunOssService'
import { queueMenuUpdateNotice } from '../../services/notificationService'
import { getCurrentUser } from '../../services/permissionService'
import NavBar, { NavBarPlaceholder } from '../../components/NavBar'
import './index.scss'

// 《3-6岁儿童学习与发展指南》营养标准
const NUTRITION_STANDARDS = {
  energy: { min: 1200, max: 1400, unit: 'kcal', label: '能量' },
  protein: { min: 40, max: 55, unit: 'g', label: '蛋白质' },
  fat: { min: 40, max: 50, unit: 'g', label: '脂肪' },
  carbohydrate: { min: 150, max: 200, unit: 'g', label: '碳水化合物' },
  calcium: { min: 600, max: 800, unit: 'mg', label: '钙' },
  iron: { min: 10, max: 12, unit: 'mg', label: '铁' },
  zinc: { min: 8, max: 10, unit: 'mg', label: '锌' },
  vitaminA: { min: 400, max: 500, unit: 'μg', label: '维生素A' },
  vitaminC: { min: 50, max: 70, unit: 'mg', label: '维生素C' },
  vitaminD: { min: 10, max: 15, unit: 'μg', label: '维生素D' },
}

// 与网站完全一致的类型定义
interface DishIngredient {
  name: string
  perPersonGrams: number
}

interface MealDish {
  dishName: string
  ingredients: DishIngredient[]
}

// 早餐结构：主食+配菜+粥/汤
interface BreakfastMeal {
  staple: MealDish      // 主食（馒头、饼等）
  sideDish: MealDish    // 配菜（炒蛋、炒菜等）
  porridge: MealDish    // 粥/汤/豆浆
}

// 点心结构：糕点+水果
interface SnackMeal {
  pastry: MealDish      // 糕点/点心
  fruit: MealDish       // 水果
}

interface DailyRecipe {
  day: string
  meals: {
    breakfast: BreakfastMeal    // 早餐拆分成三部分
    morningFruitSnack?: MealDish
    morningSnack: MealDish
    lunch: {
      mainDish: MealDish
      sideDish: MealDish
      soup: MealDish
      staple: MealDish
    }
    milkSnack: MealDish
    afternoonSnack: SnackMeal   // 下午点心拆分
    dinner: MealDish
  }
}

interface WeeklyRecipeRecord {
  id: string
  weekRange: string
  startDate?: string  // 新增：开始日期
  endDate?: string    // 新增：结束日期
  grade: string
  headcount: number
  days: DailyRecipe[]
  createdAt: string
  status: 'DRAFT' | 'CONFIRMED'
  nutritionSummary?: {
    avgEnergy: number
    avgProtein: number
    varietyCount: number
  }
}

// 园区类型
type CampusGrade = 'PHUI' | 'HIGH_END' | 'JIU_YOU' | 'SHIQI_YOU'

// 园区配置
const CAMPUS_CONFIG: Record<string, { name: string }> = {
  'PHUI': { name: '普惠园' },
  'HIGH_END': { name: '高端园' },
  'JIU_YOU': { name: '九幼' },
  'SHIQI_YOU': { name: '十七幼' }
}

// 获取园区特色描述
const getCampusFeatures = (grade: CampusGrade): string => {
  switch (grade) {
    case 'PHUI':
      return `【普惠园标准】营养均衡，食材经济实惠`
    case 'HIGH_END':
      return `【高端园标准】早餐后水果加餐，午点精致甜品`
    case 'JIU_YOU':
    case 'SHIQI_YOU':
      return `【${CAMPUS_CONFIG[grade].name}特色】丰富水果加餐，周五自助餐`
    default:
      return ''
  }
}

// AI生成结构化食谱
const generateAIRecipeStructured = async (grade: CampusGrade, headcount: number, startDate: string, endDate: string): Promise<WeeklyRecipeRecord> => {
  const apiKey = process.env.TARO_APP_DOUBAO_API_KEY || ''
  if (!apiKey) {
    throw new Error('API Key未配置')
  }

  const campusFeatures = getCampusFeatures(grade)
  
  const systemPrompt = `幼儿园营养师，为【${CAMPUS_CONFIG[grade].name}】生成周一至周五食谱。${campusFeatures}
返回JSON格式：
{
  "days":[{
    "day":"周一",
    "meals":{
      "breakfast":{
        "staple":{"dishName":"主食名","ingredients":[{"name":"食材","perPersonGrams":数字}]},
        "sideDish":{"dishName":"配菜名","ingredients":[]},
        "porridge":{"dishName":"粥/汤名","ingredients":[]}
      },
      "morningSnack":{"dishName":"上午点心","ingredients":[]},
      "lunch":{
        "mainDish":{"dishName":"主菜","ingredients":[]},
        "sideDish":{"dishName":"副菜","ingredients":[]},
        "soup":{"dishName":"汤品","ingredients":[]},
        "staple":{"dishName":"主食","ingredients":[]}
      },
      "milkSnack":{"dishName":"纯牛奶","ingredients":[{"name":"牛奶","perPersonGrams":250}]},
      "afternoonSnack":{
        "pastry":{"dishName":"糕点名","ingredients":[]},
        "fruit":{"dishName":"水果名","ingredients":[]}
      },
      "dinner":{"dishName":"晚餐","ingredients":[]}
    }
  }],
  "nutritionSummary":{"avgEnergy":1350,"avgProtein":45,"varietyCount":30}
}
要求：早餐分三部分(主食+配菜+粥)，下午点心分两部分(糕点+水果)，每道菜含食材和克重，五天不重复。`

  const userMessage = `生成${CAMPUS_CONFIG[grade].name}本周食谱(${headcount}人)，只返回JSON。`

  const response = await Taro.request({
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    data: {
      model: 'doubao-seed-1-6-251015',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.6,
      max_completion_tokens: 4096,
      response_format: { type: 'json_object' }
    },
  })

  const responseText = response.data?.choices?.[0]?.message?.content?.trim() || ''
  let cleanJson = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const data = JSON.parse(cleanJson)
  
  const weekdays = ['周一', '周二', '周三', '周四', '周五']
  const record: WeeklyRecipeRecord = {
    id: Date.now().toString(),
    weekRange: `${startDate} ~ ${endDate}`,
    startDate,
    endDate,
    grade,
    headcount,
    days: (data.days || []).map((dayData: any, idx: number) => {
      const base = createEmptyDailyRecipe(weekdays[idx] || '未知')
      return {
        ...base,
        ...dayData,
        meals: {
          ...base.meals,
          ...(dayData.meals || {}),
          lunch: {
            ...base.meals.lunch,
            ...(dayData.meals?.lunch || {})
          }
        }
      }
    }),
    nutritionSummary: data.nutritionSummary || { avgEnergy: 1350, avgProtein: 50, varietyCount: 15 },
    status: 'DRAFT',
    createdAt: new Date().toISOString()
  }
  
  return record
}

// 创建空的每日食谱模板
const createEmptyDailyRecipe = (day: string): DailyRecipe => ({
  day,
  meals: {
    breakfast: {
      staple: { dishName: '待定', ingredients: [] },
      sideDish: { dishName: '待定', ingredients: [] },
      porridge: { dishName: '待定', ingredients: [] },
    },
    morningSnack: { dishName: '待定', ingredients: [] },
    lunch: {
      mainDish: { dishName: '待定', ingredients: [] },
      sideDish: { dishName: '待定', ingredients: [] },
      soup: { dishName: '待定', ingredients: [] },
      staple: { dishName: '待定', ingredients: [] },
    },
    milkSnack: { dishName: '纯牛奶', ingredients: [{ name: '牛奶', perPersonGrams: 250 }] },
    afternoonSnack: {
      pastry: { dishName: '待定', ingredients: [] },
      fruit: { dishName: '待定', ingredients: [] },
    },
    dinner: { dishName: '待定', ingredients: [] },
  }
})

// 回退食谱
const getFallbackRecipe = (grade: CampusGrade, headcount: number, startDate: string, endDate: string): WeeklyRecipeRecord => {
  const dish = (name: string, ingredients: DishIngredient[]) => ({ dishName: name, ingredients })
  
  const days: DailyRecipe[] = [
    {
      day: '周一',
      meals: {
        breakfast: {
          staple: dish('高粱窝窝头', [{ name: '面粉', perPersonGrams: 28 }, { name: '高粱面', perPersonGrams: 3 }]),
          sideDish: dish('洋葱木耳炒蛋', [{ name: '鸡蛋', perPersonGrams: 30 }, { name: '洋葱', perPersonGrams: 20 }, { name: '木耳', perPersonGrams: 10 }]),
          porridge: dish('红枣小米粥', [{ name: '小米', perPersonGrams: 20 }, { name: '红枣', perPersonGrams: 10 }])
        },
        morningSnack: dish('时令水果', [{ name: '苹果', perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish('鱼香肉丝', [{ name: '里脊肉', perPersonGrams: 30 }, { name: '胡萝卜', perPersonGrams: 45 }]),
          sideDish: dish('海米冬瓜', [{ name: '海米', perPersonGrams: 2 }, { name: '冬瓜', perPersonGrams: 80 }]),
          soup: dish('西红柿蛋花汤', [{ name: '西红柿', perPersonGrams: 15 }, { name: '鸡蛋', perPersonGrams: 10 }]),
          staple: dish('金银饭', [{ name: '大米', perPersonGrams: 55 }, { name: '小米', perPersonGrams: 5 }])
        },
        milkSnack: dish('纯牛奶', [{ name: '牛奶', perPersonGrams: 250 }]),
        afternoonSnack: {
          pastry: dish('南瓜甜甜圈', [{ name: '面粉', perPersonGrams: 20 }, { name: '南瓜', perPersonGrams: 15 }]),
          fruit: dish('火龙果', [{ name: '火龙果', perPersonGrams: 80 }])
        },
        dinner: dish('油菜烧豆腐', [{ name: '油菜', perPersonGrams: 40 }, { name: '豆腐', perPersonGrams: 30 }])
      }
    },
    {
      day: '周二',
      meals: {
        breakfast: {
          staple: dish('千层饼', [{ name: '面粉', perPersonGrams: 28 }]),
          sideDish: dish('五香鹌鹑蛋', [{ name: '鹌鹑蛋', perPersonGrams: 30 }]),
          porridge: dish('西红柿疙瘩汤', [{ name: '面粉', perPersonGrams: 15 }, { name: '西红柿', perPersonGrams: 20 }])
        },
        morningSnack: dish('时令水果', [{ name: '香蕉', perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish('蒜蓉粉丝虾', [{ name: '大虾', perPersonGrams: 45 }, { name: '粉丝', perPersonGrams: 5 }]),
          sideDish: dish('醋溜土豆丝', [{ name: '土豆', perPersonGrams: 50 }]),
          soup: dish('红豆薏仁汤', [{ name: '红豆', perPersonGrams: 8 }, { name: '薏仁', perPersonGrams: 6 }]),
          staple: dish('香米饭', [{ name: '大米', perPersonGrams: 60 }])
        },
        milkSnack: dish('纯牛奶', [{ name: '牛奶', perPersonGrams: 250 }]),
        afternoonSnack: {
          pastry: dish('蝴蝶卷', [{ name: '面粉', perPersonGrams: 23 }]),
          fruit: dish('苹果', [{ name: '苹果', perPersonGrams: 80 }])
        },
        dinner: dish('肉沫炒包菜丝', [{ name: '后腿肉', perPersonGrams: 20 }, { name: '包菜', perPersonGrams: 65 }])
      }
    },
    {
      day: '周三',
      meals: {
        breakfast: {
          staple: dish('肉蓉卷', [{ name: '面粉', perPersonGrams: 28 }, { name: '肉蓉', perPersonGrams: 15 }]),
          sideDish: dish('凉拌黄瓜', [{ name: '黄瓜', perPersonGrams: 40 }]),
          porridge: dish('营养豆浆', [{ name: '黄豆', perPersonGrams: 15 }])
        },
        morningSnack: dish('时令水果', [{ name: '橙子', perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish('蒸卤面', [{ name: '面条', perPersonGrams: 85 }, { name: '后腿肉', perPersonGrams: 30 }]),
          sideDish: dish('蚝油生菜', [{ name: '生菜', perPersonGrams: 70 }]),
          soup: dish('凤凰玉米羹', [{ name: '玉米糁', perPersonGrams: 15 }, { name: '鸡蛋', perPersonGrams: 10 }]),
          staple: dish('卤鸡肝', [{ name: '鸡肝', perPersonGrams: 35 }])
        },
        milkSnack: dish('纯牛奶', [{ name: '牛奶', perPersonGrams: 250 }]),
        afternoonSnack: {
          pastry: dish('红豆包', [{ name: '面粉', perPersonGrams: 25 }, { name: '红豆', perPersonGrams: 10 }]),
          fruit: dish('西瓜', [{ name: '西瓜', perPersonGrams: 120 }])
        },
        dinner: dish('时蔬炒蛋', [{ name: '鸡蛋', perPersonGrams: 40 }, { name: '胡萝卜', perPersonGrams: 15 }])
      }
    },
    {
      day: '周四',
      meals: {
        breakfast: {
          staple: dish('红糖枣糕', [{ name: '面粉', perPersonGrams: 28 }, { name: '红枣', perPersonGrams: 8 }]),
          sideDish: dish('素炒胡萝卜丝', [{ name: '胡萝卜', perPersonGrams: 30 }]),
          porridge: dish('燕麦粥', [{ name: '燕麦', perPersonGrams: 10 }, { name: '大米', perPersonGrams: 15 }])
        },
        morningSnack: dish('时令水果', [{ name: '葡萄', perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish('排骨炖胡萝卜', [{ name: '排骨', perPersonGrams: 90 }, { name: '胡萝卜', perPersonGrams: 45 }]),
          sideDish: dish('茄子烧豆角丝', [{ name: '茄子', perPersonGrams: 45 }, { name: '豆角', perPersonGrams: 25 }]),
          soup: dish('芹菜炒豆干', [{ name: '芹菜', perPersonGrams: 50 }, { name: '香干', perPersonGrams: 10 }]),
          staple: dish('刀切馒头', [{ name: '面粉', perPersonGrams: 60 }])
        },
        milkSnack: dish('纯牛奶', [{ name: '牛奶', perPersonGrams: 250 }]),
        afternoonSnack: {
          pastry: dish('奶香包', [{ name: '面粉', perPersonGrams: 20 }, { name: '牛奶', perPersonGrams: 10 }]),
          fruit: dish('香蕉', [{ name: '香蕉', perPersonGrams: 110 }])
        },
        dinner: dish('时蔬汤', [{ name: '西红柿', perPersonGrams: 20 }, { name: '青菜', perPersonGrams: 20 }])
      }
    },
    {
      day: '周五',
      meals: {
        breakfast: {
          staple: dish('奶香馒头', [{ name: '面粉', perPersonGrams: 28 }]),
          sideDish: dish('炒合菜', [{ name: '绿豆芽', perPersonGrams: 40 }, { name: '韭菜', perPersonGrams: 25 }]),
          porridge: dish('紫米粥', [{ name: '紫米', perPersonGrams: 20 }])
        },
        morningSnack: dish('时令水果', [{ name: '火龙果', perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish('西葫芦炒肉丝', [{ name: '西葫芦', perPersonGrams: 75 }, { name: '五花肉', perPersonGrams: 30 }]),
          sideDish: dish('素三鲜', [{ name: '胡萝卜', perPersonGrams: 45 }, { name: '鸡蛋', perPersonGrams: 30 }]),
          soup: dish('绿豆汤', [{ name: '绿豆', perPersonGrams: 15 }]),
          staple: dish('素三鲜包子', [{ name: '面粉', perPersonGrams: 60 }])
        },
        milkSnack: dish('纯牛奶', [{ name: '牛奶', perPersonGrams: 250 }]),
        afternoonSnack: {
          pastry: dish('蒸玉米', [{ name: '鲜玉米', perPersonGrams: 140 }]),
          fruit: dish('油桃', [{ name: '油桃', perPersonGrams: 80 }])
        },
        dinner: dish('时蔬面', [{ name: '面条', perPersonGrams: 60 }, { name: '青菜', perPersonGrams: 30 }])
      }
    }
  ]
  
  return {
    id: 'ai-' + Date.now(),
    weekRange: `${startDate} ~ ${endDate}`,
    startDate,
    endDate,
    grade,
    headcount,
    days,
    nutritionSummary: { avgEnergy: 1350, avgProtein: 50, varietyCount: 35 },
    status: 'DRAFT',
    createdAt: new Date().toISOString()
  }
}

// 编辑类型
type EditType = 'dish' | 'ingredient' | 'addIngredient'

interface EditingState {
  dayIdx: number
  mealKey: string
  subKey?: string
  ingredientIdx?: number
  type: EditType
}

export default function Kitchen() {
  useGlobalShare({ title: '金星幼儿园 - 厨房管理', path: '/pages/kitchen/index' })
  const [history, setHistory] = useState<WeeklyRecipeRecord[]>([])
  const [currentRecord, setCurrentRecord] = useState<WeeklyRecipeRecord | null>(null)
  const [activeDayIdx, setActiveDayIdx] = useState(0)
  const [viewMode, setViewMode] = useState<'current' | 'history' | 'ai'>('current')
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  
  // AI食谱相关状态
  const [aiGrade, setAiGrade] = useState<CampusGrade>('SHIQI_YOU')
  const [aiHeadcount, setAiHeadcount] = useState(120)
  const [aiGeneratedRecord, setAiGeneratedRecord] = useState<WeeklyRecipeRecord | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiActiveDayIdx, setAiActiveDayIdx] = useState(0)
  
  // 日期范围
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false)
  const [editingState, setEditingState] = useState<EditingState | null>(null)
  const [editDishName, setEditDishName] = useState('')
  const [editIngredientName, setEditIngredientName] = useState('')
  const [editIngredientGrams, setEditIngredientGrams] = useState('')
  
  // 显示控制
  const [todayAttendance, setTodayAttendance] = useState(0)
  const [showWeeklyTotal, setShowWeeklyTotal] = useState(false)
  const [showDailyTotal, setShowDailyTotal] = useState(false)
  const [showNutritionGuide, setShowNutritionGuide] = useState(false)

  const weekdays = ['周一', '周二', '周三', '周四', '周五']
  
  // 初始化日期范围（本周一到周五）
  const initDateRange = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    
    setStartDate(monday.toISOString().split('T')[0])
    setEndDate(friday.toISOString().split('T')[0])
  }
  
  // 获取当天是星期几
  const getTodayWeekdayIdx = () => {
    const day = new Date().getDay()
    return day >= 1 && day <= 5 ? day - 1 : 0
  }
  
  // 获取当日出勤人数
  const loadTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0]
    const attendanceData = Taro.getStorageSync(`kt_attendance_${today}`) || {}
    const presentCount = Object.values(attendanceData).filter((r: any) => 
      r.status === 'present' || r.status === 'late'
    ).length
    setTodayAttendance(presentCount)
    if (presentCount > 0) {
      setAiHeadcount(presentCount)
    }
    return presentCount
  }
  
  // 计算当日所有食材总量
  const calculateDailyIngredients = useMemo(() => {
    const record = aiGeneratedRecord || currentRecord
    if (!record || !record.days) return []
    
    const dayIdx = aiGeneratedRecord ? aiActiveDayIdx : activeDayIdx
    const dayRecipe = record.days[dayIdx]
    if (!dayRecipe || !dayRecipe.meals) return []
    
    const headcount = todayAttendance > 0 ? todayAttendance : record.headcount
    const ingredientMap: Record<string, number> = {}
    
    const collectIngredients = (dish: MealDish | undefined) => {
      if (!dish?.ingredients) return
      dish.ingredients.forEach(ing => {
        const total = ing.perPersonGrams * headcount
        ingredientMap[ing.name] = (ingredientMap[ing.name] || 0) + total
      })
    }
    
    const { meals } = dayRecipe
    // 早餐（三部分）
    collectIngredients(meals.breakfast?.staple)
    collectIngredients(meals.breakfast?.sideDish)
    collectIngredients(meals.breakfast?.porridge)
    collectIngredients(meals.morningFruitSnack)
    collectIngredients(meals.morningSnack)
    // 午餐
    collectIngredients(meals.lunch?.mainDish)
    collectIngredients(meals.lunch?.sideDish)
    collectIngredients(meals.lunch?.soup)
    collectIngredients(meals.lunch?.staple)
    collectIngredients(meals.milkSnack)
    // 下午点心（两部分）
    collectIngredients(meals.afternoonSnack?.pastry)
    collectIngredients(meals.afternoonSnack?.fruit)
    collectIngredients(meals.dinner)
    
    return Object.entries(ingredientMap)
      .map(([name, grams]) => ({ name, grams: Math.round(grams), kg: (grams / 1000).toFixed(2) }))
      .sort((a, b) => b.grams - a.grams)
  }, [aiGeneratedRecord, currentRecord, aiActiveDayIdx, activeDayIdx, todayAttendance])
  
  // 计算一周所有食材总量
  const calculateWeeklyIngredients = useMemo(() => {
    const record = aiGeneratedRecord || currentRecord
    if (!record || !record.days) return []
    
    const headcount = todayAttendance > 0 ? todayAttendance : record.headcount
    const ingredientMap: Record<string, number> = {}
    
    const collectIngredients = (dish: MealDish | undefined) => {
      if (!dish?.ingredients) return
      dish.ingredients.forEach(ing => {
        const total = ing.perPersonGrams * headcount
        ingredientMap[ing.name] = (ingredientMap[ing.name] || 0) + total
      })
    }
    
    // 遍历所有天
    record.days.forEach(dayRecipe => {
      if (!dayRecipe?.meals) return
      const { meals } = dayRecipe
      // 早餐（三部分）
      collectIngredients(meals.breakfast?.staple)
      collectIngredients(meals.breakfast?.sideDish)
      collectIngredients(meals.breakfast?.porridge)
      collectIngredients(meals.morningFruitSnack)
      collectIngredients(meals.morningSnack)
      // 午餐
      collectIngredients(meals.lunch?.mainDish)
      collectIngredients(meals.lunch?.sideDish)
      collectIngredients(meals.lunch?.soup)
      collectIngredients(meals.lunch?.staple)
      collectIngredients(meals.milkSnack)
      // 下午点心（两部分）
      collectIngredients(meals.afternoonSnack?.pastry)
      collectIngredients(meals.afternoonSnack?.fruit)
      collectIngredients(meals.afternoonSnack)
      collectIngredients(meals.dinner)
    })
    
    return Object.entries(ingredientMap)
      .map(([name, grams]) => ({ name, grams: Math.round(grams), kg: (grams / 1000).toFixed(2) }))
      .sort((a, b) => b.grams - a.grams)
  }, [aiGeneratedRecord, currentRecord, todayAttendance])

  // AI生成食谱
  const handleGenerateRecipe = async () => {
    setIsGenerating(true)
    setAiGeneratedRecord(null)
    
    try {
      const result = await generateAIRecipeStructured(aiGrade, aiHeadcount, startDate, endDate)
      setAiGeneratedRecord(result)
      setAiActiveDayIdx(0)
      Taro.setStorageSync('kt_ai_generated_recipe', result)
      Taro.showToast({ title: '生成成功', icon: 'success' })
    } catch (err: any) {
      console.error('[Kitchen] AI生成失败，使用回退食谱:', err)
      const fallback = getFallbackRecipe(aiGrade, aiHeadcount, startDate, endDate)
      setAiGeneratedRecord(fallback)
      setAiActiveDayIdx(0)
      Taro.setStorageSync('kt_ai_generated_recipe', fallback)
      Taro.showToast({ title: '已生成参考食谱', icon: 'success' })
    } finally {
      setIsGenerating(false)
    }
  }
  
  // 上传食谱到云端
  const uploadMealPlansToCloud = async (records: WeeklyRecipeRecord[]) => {
    try {
      const result = await uploadToAliyun(STORAGE_KEYS.MEAL_PLANS, records, true)
      return result.success
    } catch (err: any) {
      console.error('[Kitchen] 上传异常:', err.message)
      return false
    }
  }

  // 应用AI生成的食谱
  const handleApplyAiRecipe = async () => {
    if (!aiGeneratedRecord) return
    
    Taro.showModal({
      title: '应用食谱',
      content: '确定要将AI生成的食谱设为当前食谱并上传云端吗？',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '正在保存...' })
          
          const confirmedRecord = { 
            ...aiGeneratedRecord, 
            status: 'CONFIRMED' as const,
          }
          
          const newHistory = [confirmedRecord, ...history]
          setHistory(newHistory)
          Taro.setStorageSync(STORAGE_KEYS.MEAL_PLANS, newHistory)
          
          const uploaded = await uploadMealPlansToCloud(newHistory)
          
          Taro.removeStorageSync('kt_ai_generated_recipe')
          setCurrentRecord(confirmedRecord)
          setAiGeneratedRecord(null)
          setViewMode('current')
          setActiveDayIdx(0)
          
          Taro.hideLoading()
          Taro.showToast({ 
            title: uploaded ? '已保存并上传云端' : '已保存本地', 
            icon: uploaded ? 'success' : 'none' 
          })

          // 食谱更新通知入队
          if (uploaded) {
            const user = getCurrentUser()
            queueMenuUpdateNotice({
              weekRange: confirmedRecord.weekRange || '本周',
              updatedBy: user?.name || '管理员'
            })
          }
        }
      }
    })
  }

  useEffect(() => {
    initDateRange()
    loadData()
    loadTodayAttendance()
    loadSavedAiRecipe()
    setActiveDayIdx(getTodayWeekdayIdx())
    setAiActiveDayIdx(getTodayWeekdayIdx())
  }, [])

  useDidShow(() => {
    loadData()
    loadTodayAttendance()
    loadSavedAiRecipe()
  })
  
  const loadSavedAiRecipe = () => {
    const savedAiRecipe = Taro.getStorageSync('kt_ai_generated_recipe')
    if (savedAiRecipe) {
      setAiGeneratedRecord(savedAiRecipe)
      if (savedAiRecipe.startDate) setStartDate(savedAiRecipe.startDate)
      if (savedAiRecipe.endDate) setEndDate(savedAiRecipe.endDate)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    
    // 先加载本地数据作为初始显示
    const localHistory =
      Taro.getStorageSync(STORAGE_KEYS.MEAL_PLANS) ||
      Taro.getStorageSync(STORAGE_KEYS.KITCHEN_HISTORY) ||
      []
    
    if (localHistory.length > 0) {
      setHistory(localHistory)
      const confirmed = localHistory.filter((r: WeeklyRecipeRecord) => r.status === 'CONFIRMED')
      if (confirmed.length > 0) {
        setCurrentRecord(confirmed[0])
      }
    }
    
    // 总是尝试从云端同步最新数据（后台静默同步）
    try {
      const result = await downloadFromAliyun<WeeklyRecipeRecord>(STORAGE_KEYS.MEAL_PLANS)
      console.log('[Kitchen] 云端同步结果:', result)
      
      if (result.success && result.data && result.data.length > 0) {
        const cloudData = result.data
        // 检查云端数据是否比本地新
        const cloudLatest = cloudData[0]
        const localLatest = localHistory[0]
        
        console.log('[Kitchen] 云端最新:', cloudLatest?.confirmedAt, '本地最新:', localLatest?.confirmedAt)
        
        // 如果云端有数据且比本地新，或者本地没有数据，则使用云端数据
        if (!localLatest || (cloudLatest && cloudLatest.confirmedAt && 
            (!localLatest.confirmedAt || new Date(cloudLatest.confirmedAt) > new Date(localLatest.confirmedAt)))) {
          Taro.setStorageSync(STORAGE_KEYS.MEAL_PLANS, cloudData)
          setHistory(cloudData)
          const confirmed = cloudData.filter(r => r.status === 'CONFIRMED')
          if (confirmed.length > 0) {
            setCurrentRecord(confirmed[0])
          }
          console.log('[Kitchen] ✅ 已从云端同步最新食谱，共', cloudData.length, '条')
        } else {
          console.log('[Kitchen] 本地数据较新或相同，保持本地数据')
        }
      } else {
        console.log('[Kitchen] 云端无数据或下载失败:', result.error)
      }
    } catch (err) {
      console.log('[Kitchen] 云端同步异常:', err)
    }
    
    setIsLoading(false)
  }
  
  // 获取菜品（支持嵌套结构：lunch, breakfast, afternoonSnack）
  const getDishFromMeals = (meals: DailyRecipe['meals'], mealKey: string, subKey?: string): MealDish | undefined => {
    if (subKey) {
      if (mealKey === 'lunch') {
        return (meals.lunch as any)?.[subKey]
      } else if (mealKey === 'breakfast') {
        return (meals.breakfast as any)?.[subKey]
      } else if (mealKey === 'afternoonSnack') {
        return (meals.afternoonSnack as any)?.[subKey]
      }
    }
    return meals[mealKey as keyof typeof meals] as MealDish
  }
  
  // 设置菜品（支持嵌套结构）
  const setDishInMeals = (meals: any, mealKey: string, subKey: string | undefined, dish: MealDish) => {
    if (subKey) {
      if (mealKey === 'lunch' || mealKey === 'breakfast' || mealKey === 'afternoonSnack') {
        meals[mealKey][subKey] = dish
      }
    } else {
      meals[mealKey] = dish
    }
  }
  
  // 打开编辑弹窗 - 编辑菜品名称
  const handleEditDish = (dayIdx: number, mealKey: string, subKey?: string) => {
    if (!aiGeneratedRecord) {
      Taro.showToast({ title: '请先生成AI食谱', icon: 'none' })
      return
    }
    const day = aiGeneratedRecord.days[dayIdx]
    if (!day) return
    
    const dish = getDishFromMeals(day.meals, mealKey, subKey)
    
    if (dish) {
      setEditingState({ dayIdx, mealKey, subKey, type: 'dish' })
      setEditDishName(dish.dishName || '')
      setIsEditing(true)
    }
  }
  
  // 打开编辑弹窗 - 编辑食材
  const handleEditIngredient = (dayIdx: number, mealKey: string, subKey: string | undefined, ingredientIdx: number) => {
    if (!aiGeneratedRecord) return
    const day = aiGeneratedRecord.days[dayIdx]
    if (!day) return
    
    const dish = getDishFromMeals(day.meals, mealKey, subKey)
    
    if (dish && dish.ingredients[ingredientIdx]) {
      const ing = dish.ingredients[ingredientIdx]
      setEditingState({ dayIdx, mealKey, subKey, ingredientIdx, type: 'ingredient' })
      setEditIngredientName(ing.name)
      setEditIngredientGrams(ing.perPersonGrams.toString())
      setIsEditing(true)
    }
  }
  
  // 打开添加食材弹窗
  const handleAddIngredient = (dayIdx: number, mealKey: string, subKey?: string) => {
    if (!aiGeneratedRecord) return
    setEditingState({ dayIdx, mealKey, subKey, type: 'addIngredient' })
    setEditIngredientName('')
    setEditIngredientGrams('')
    setIsEditing(true)
  }
  
  // 删除食材
  const handleDeleteIngredient = (dayIdx: number, mealKey: string, subKey: string | undefined, ingredientIdx: number) => {
    if (!aiGeneratedRecord) return
    
    Taro.showModal({
      title: '删除食材',
      content: '确定要删除这个食材吗？',
      success: (res) => {
        if (res.confirm) {
          const newRecord = JSON.parse(JSON.stringify(aiGeneratedRecord)) as WeeklyRecipeRecord
          const dish = getDishFromMeals(newRecord.days[dayIdx].meals, mealKey, subKey)
          
          if (dish && dish.ingredients) {
            dish.ingredients.splice(ingredientIdx, 1)
            setAiGeneratedRecord(newRecord)
            Taro.setStorageSync('kt_ai_generated_recipe', newRecord)
            Taro.showToast({ title: '已删除', icon: 'success' })
          }
        }
      }
    })
  }
  
  // 保存编辑
  const handleSaveEdit = () => {
    if (!aiGeneratedRecord || !editingState) return
    
    const newRecord = JSON.parse(JSON.stringify(aiGeneratedRecord)) as WeeklyRecipeRecord
    const { dayIdx, mealKey, subKey, ingredientIdx, type } = editingState
    
    const dish = getDishFromMeals(newRecord.days[dayIdx].meals, mealKey, subKey)
    
    if (!dish) return
    
    if (type === 'dish') {
      dish.dishName = editDishName
    } else if (type === 'ingredient' && ingredientIdx !== undefined) {
      if (!editIngredientName.trim() || !editIngredientGrams) {
        Taro.showToast({ title: '请填写完整', icon: 'none' })
        return
      }
      dish.ingredients[ingredientIdx] = {
        name: editIngredientName.trim(),
        perPersonGrams: parseFloat(editIngredientGrams) || 0
      }
    } else if (type === 'addIngredient') {
      if (!editIngredientName.trim() || !editIngredientGrams) {
        Taro.showToast({ title: '请填写完整', icon: 'none' })
        return
      }
      if (!dish.ingredients) dish.ingredients = []
      dish.ingredients.push({
        name: editIngredientName.trim(),
        perPersonGrams: parseFloat(editIngredientGrams) || 0
      })
    }
    
    setAiGeneratedRecord(newRecord)
    Taro.setStorageSync('kt_ai_generated_recipe', newRecord)
    setIsEditing(false)
    setEditingState(null)
    Taro.showToast({ title: '已保存', icon: 'success' })
  }
  
  // 更新日期范围到食谱
  const updateDateRange = () => {
    if (!aiGeneratedRecord) return
    const newRecord = {
      ...aiGeneratedRecord,
      weekRange: `${startDate} ~ ${endDate}`,
      startDate,
      endDate
    }
    setAiGeneratedRecord(newRecord)
    Taro.setStorageSync('kt_ai_generated_recipe', newRecord)
    Taro.showToast({ title: '日期已更新', icon: 'success' })
  }

  // 从云端同步食谱
  const handleSync = async () => {
    setIsSyncing(true)
    
    try {
      const cloudData =
        (await downloadFromAliyun<WeeklyRecipeRecord>(STORAGE_KEYS.MEAL_PLANS)) ||
        []
      const cloudFallback =
        cloudData.length === 0
          ? await downloadFromAliyun<WeeklyRecipeRecord>(STORAGE_KEYS.KITCHEN_HISTORY)
          : []
      const finalData = cloudData.length > 0 ? cloudData : cloudFallback
      
      if (finalData && finalData.length > 0) {
        Taro.setStorageSync(STORAGE_KEYS.MEAL_PLANS, finalData)
        setHistory(finalData)
        
        const confirmed = finalData.filter(r => r.status === 'CONFIRMED')
        if (confirmed.length > 0) {
          setCurrentRecord(confirmed[0])
        }
        
        Taro.showToast({ title: `已同步 ${finalData.length} 份食谱`, icon: 'success' })
      } else {
        Taro.showToast({ title: '云端暂无食谱数据', icon: 'none' })
      }
    } catch (err) {
      console.error('[Kitchen] 同步失败:', err)
      Taro.showToast({ title: '同步失败', icon: 'none' })
    } finally {
      setIsSyncing(false)
    }
  }

  // 渲染单个菜品（只读）
  const renderDish = (label: string, dish: MealDish | undefined, icon: string, colorClass: string) => {
    if (!dish || !dish.dishName || dish.dishName === '待定') return null
    
    return (
      <View className={`meal-card ${colorClass}`}>
        <View className='meal-header'>
          <Text className='icon'>{icon}</Text>
          <Text className='label'>{label}</Text>
        </View>
        
        <View className='dish-content'>
          <Text className='dish-name'>{dish.dishName}</Text>
          
          {dish.ingredients && dish.ingredients.length > 0 && (
            <View className='ingredients'>
              {dish.ingredients.map((ing, idx) => (
                <View key={idx} className='ingredient-tag'>
                  <Text className='ing-name'>{ing.name}</Text>
                  <Text className='ing-grams'>{ing.perPersonGrams}g/人</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    )
  }

  // 渲染午餐（只读）
  const renderLunch = (lunch: DailyRecipe['meals']['lunch'] | undefined) => {
    if (!lunch) return null
    
    const { mainDish, sideDish, soup, staple } = lunch
    const hasValidDish = [mainDish, sideDish, soup, staple].some(
      d => d && d.dishName && d.dishName !== '待定'
    )
    
    if (!hasValidDish) return null
    
    return (
      <View className='meal-card lunch-card'>
        <View className='meal-header'>
          <Text className='icon'>🍱</Text>
          <Text className='label'>午餐</Text>
        </View>
        
        <View className='lunch-grid'>
          {mainDish?.dishName && mainDish.dishName !== '待定' && (
            <View className='lunch-item main'>
              <Text className='item-label'>主菜</Text>
              <Text className='item-name'>{mainDish.dishName}</Text>
              <View className='item-ingredients'>
                {mainDish.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
          
          {sideDish?.dishName && sideDish.dishName !== '待定' && (
            <View className='lunch-item side'>
              <Text className='item-label'>副菜</Text>
              <Text className='item-name'>{sideDish.dishName}</Text>
              <View className='item-ingredients'>
                {sideDish.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
          
          {soup?.dishName && soup.dishName !== '待定' && (
            <View className='lunch-item soup'>
              <Text className='item-label'>汤品</Text>
              <Text className='item-name'>{soup.dishName}</Text>
              <View className='item-ingredients'>
                {soup.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
          
          {staple?.dishName && staple.dishName !== '待定' && (
            <View className='lunch-item staple'>
              <Text className='item-label'>主食</Text>
              <Text className='item-name'>{staple.dishName}</Text>
              <View className='item-ingredients'>
                {staple.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    )
  }

  // 渲染早餐（三部分：主食+配菜+粥）
  const renderBreakfast = (breakfast: BreakfastMeal | undefined) => {
    if (!breakfast) return null
    
    const { staple, sideDish, porridge } = breakfast
    const hasValidDish = [staple, sideDish, porridge].some(
      d => d && d.dishName && d.dishName !== '待定'
    )
    
    if (!hasValidDish) return null
    
    return (
      <View className='meal-card breakfast-card'>
        <View className='meal-header'>
          <Text className='icon'>🌅</Text>
          <Text className='label'>早餐</Text>
        </View>
        
        <View className='breakfast-grid'>
          {staple?.dishName && staple.dishName !== '待定' && (
            <View className='breakfast-item staple'>
              <Text className='item-label'>主食</Text>
              <Text className='item-name'>{staple.dishName}</Text>
              <View className='item-ingredients'>
                {staple.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
          
          {sideDish?.dishName && sideDish.dishName !== '待定' && (
            <View className='breakfast-item side'>
              <Text className='item-label'>配菜</Text>
              <Text className='item-name'>{sideDish.dishName}</Text>
              <View className='item-ingredients'>
                {sideDish.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
          
          {porridge?.dishName && porridge.dishName !== '待定' && (
            <View className='breakfast-item porridge'>
              <Text className='item-label'>粥/汤</Text>
              <Text className='item-name'>{porridge.dishName}</Text>
              <View className='item-ingredients'>
                {porridge.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    )
  }

  // 渲染下午点心（两部分：糕点+水果）
  const renderAfternoonSnack = (snack: SnackMeal | undefined) => {
    if (!snack) return null
    
    const { pastry, fruit } = snack
    const hasValidDish = [pastry, fruit].some(
      d => d && d.dishName && d.dishName !== '待定'
    )
    
    if (!hasValidDish) return null
    
    return (
      <View className='meal-card snack-card'>
        <View className='meal-header'>
          <Text className='icon'>🍪</Text>
          <Text className='label'>下午点心</Text>
        </View>
        
        <View className='snack-grid'>
          {pastry?.dishName && pastry.dishName !== '待定' && (
            <View className='snack-item pastry'>
              <Text className='item-label'>糕点</Text>
              <Text className='item-name'>{pastry.dishName}</Text>
              <View className='item-ingredients'>
                {pastry.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
          
          {fruit?.dishName && fruit.dishName !== '待定' && (
            <View className='snack-item fruit'>
              <Text className='item-label'>水果</Text>
              <Text className='item-name'>{fruit.dishName}</Text>
              <View className='item-ingredients'>
                {fruit.ingredients?.map((ing, i) => (
                  <Text key={i} className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    )
  }

  // 渲染当日食谱（只读）
  const renderDayMenu = (dayRecipe: DailyRecipe | undefined) => {
    if (!dayRecipe || !dayRecipe.meals) {
      return (
        <View className='no-data'>
          <Text className='icon'>📭</Text>
          <Text>暂无此日食谱</Text>
        </View>
      )
    }
    
    const { meals } = dayRecipe
    
    return (
      <View className='day-menu'>
        {renderBreakfast(meals.breakfast)}
        {renderDish('水果加餐', meals.morningFruitSnack, '🍎', 'fruit')}
        {renderDish('上午点心', meals.morningSnack, '🥐', 'morning-snack')}
        {renderLunch(meals.lunch)}
        {renderDish('牛奶加餐', meals.milkSnack, '🥛', 'milk')}
        {renderAfternoonSnack(meals.afternoonSnack)}
        {renderDish('晚餐', meals.dinner, '🍲', 'dinner')}
      </View>
    )
  }

  // 渲染可编辑的菜品
  const renderEditableDish = (label: string, dish: MealDish | undefined, icon: string, colorClass: string, mealKey: string, dayIdx: number, subKey?: string) => {
    if (!dish || !dish.dishName || dish.dishName === '待定') return null
    
    return (
      <View className={`meal-card ${colorClass} editable`}>
        <View className='meal-header'>
          <Text className='icon'>{icon}</Text>
          <Text className='label'>{label}</Text>
          <View className='edit-icon' onClick={(e) => { e.stopPropagation(); handleEditDish(dayIdx, mealKey, subKey) }}>
            <Text>✏️</Text>
          </View>
        </View>
        
        <View className='dish-content'>
          <Text className='dish-name'>{dish.dishName}</Text>
          
          {dish.ingredients && dish.ingredients.length > 0 && (
            <View className='ingredients editable-ingredients'>
              {dish.ingredients.map((ing, idx) => (
                <View key={idx} className='ingredient-tag editable'>
                  <View className='ing-main' onClick={(e) => { e.stopPropagation(); handleEditIngredient(dayIdx, mealKey, subKey, idx) }}>
                    <Text className='ing-name'>{ing.name}</Text>
                    <Text className='ing-grams'>{ing.perPersonGrams}g/人</Text>
                  </View>
                  <View className='ing-delete' onClick={(e) => { e.stopPropagation(); handleDeleteIngredient(dayIdx, mealKey, subKey, idx) }}>
                    <Text>✕</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          
          <View className='add-ingredient-btn' onClick={(e) => { e.stopPropagation(); handleAddIngredient(dayIdx, mealKey, subKey) }}>
            <Text>+ 添加食材</Text>
          </View>
        </View>
      </View>
    )
  }
  
  // 渲染可编辑的午餐
  const renderEditableLunch = (lunch: DailyRecipe['meals']['lunch'] | undefined, dayIdx: number) => {
    if (!lunch) return null
    
    const { mainDish, sideDish, soup, staple } = lunch
    const hasValidDish = [mainDish, sideDish, soup, staple].some(
      d => d && d.dishName && d.dishName !== '待定'
    )
    
    if (!hasValidDish) return null
    
    const renderLunchItem = (dish: MealDish | undefined, label: string, subKey: string, cls: string) => {
      if (!dish?.dishName || dish.dishName === '待定') return null
      return (
        <View className={`lunch-item ${cls}`}>
          <View className='item-header'>
            <Text className='item-label'>{label}</Text>
            <View className='edit-icon-small' onClick={(e) => { e.stopPropagation(); handleEditDish(dayIdx, 'lunch', subKey) }}>
              <Text>✏️</Text>
            </View>
          </View>
          <Text className='item-name'>{dish.dishName}</Text>
          <View className='item-ingredients editable'>
            {dish.ingredients?.map((ing, i) => (
              <View key={i} className='ing-row'>
                <View className='ing-info' onClick={(e) => { e.stopPropagation(); handleEditIngredient(dayIdx, 'lunch', subKey, i) }}>
                  <Text className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                </View>
                <View className='ing-delete-small' onClick={(e) => { e.stopPropagation(); handleDeleteIngredient(dayIdx, 'lunch', subKey, i) }}>
                  <Text>✕</Text>
                </View>
              </View>
            ))}
            <View className='add-ing-small' onClick={(e) => { e.stopPropagation(); handleAddIngredient(dayIdx, 'lunch', subKey) }}>
              <Text>+ 添加</Text>
            </View>
          </View>
        </View>
      )
    }
    
    return (
      <View className='meal-card lunch-card editable'>
        <View className='meal-header'>
          <Text className='icon'>🍱</Text>
          <Text className='label'>午餐</Text>
        </View>
        
        <View className='lunch-grid'>
          {renderLunchItem(mainDish, '主菜', 'mainDish', 'main')}
          {renderLunchItem(sideDish, '副菜', 'sideDish', 'side')}
          {renderLunchItem(soup, '汤品', 'soup', 'soup')}
          {renderLunchItem(staple, '主食', 'staple', 'staple')}
        </View>
      </View>
    )
  }
  
  // 渲染可编辑的早餐
  const renderEditableBreakfast = (breakfast: BreakfastMeal | undefined, dayIdx: number) => {
    if (!breakfast) return null
    
    const { staple, sideDish, porridge } = breakfast
    const hasValidDish = [staple, sideDish, porridge].some(
      d => d && d.dishName && d.dishName !== '待定'
    )
    
    if (!hasValidDish) return null
    
    const renderBreakfastItem = (dish: MealDish | undefined, label: string, subKey: string, cls: string) => {
      if (!dish?.dishName || dish.dishName === '待定') return null
      return (
        <View className={`breakfast-item ${cls}`}>
          <View className='item-header'>
            <Text className='item-label'>{label}</Text>
            <View className='edit-icon-small' onClick={(e) => { e.stopPropagation(); handleEditDish(dayIdx, 'breakfast', subKey) }}>
              <Text>✏️</Text>
            </View>
          </View>
          <Text className='item-name'>{dish.dishName}</Text>
          <View className='item-ingredients editable'>
            {dish.ingredients?.map((ing, i) => (
              <View key={i} className='ing-row'>
                <View className='ing-info' onClick={(e) => { e.stopPropagation(); handleEditIngredient(dayIdx, 'breakfast', subKey, i) }}>
                  <Text className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                </View>
                <View className='ing-delete-small' onClick={(e) => { e.stopPropagation(); handleDeleteIngredient(dayIdx, 'breakfast', subKey, i) }}>
                  <Text>✕</Text>
                </View>
              </View>
            ))}
            <View className='add-ing-small' onClick={(e) => { e.stopPropagation(); handleAddIngredient(dayIdx, 'breakfast', subKey) }}>
              <Text>+ 添加</Text>
            </View>
          </View>
        </View>
      )
    }
    
    return (
      <View className='meal-card breakfast-card editable'>
        <View className='meal-header'>
          <Text className='icon'>🌅</Text>
          <Text className='label'>早餐</Text>
        </View>
        
        <View className='breakfast-grid'>
          {renderBreakfastItem(staple, '主食', 'staple', 'staple')}
          {renderBreakfastItem(sideDish, '配菜', 'sideDish', 'side')}
          {renderBreakfastItem(porridge, '粥/汤', 'porridge', 'porridge')}
        </View>
      </View>
    )
  }
  
  // 渲染可编辑的下午点心
  const renderEditableAfternoonSnack = (snack: SnackMeal | undefined, dayIdx: number) => {
    if (!snack) return null
    
    const { pastry, fruit } = snack
    const hasValidDish = [pastry, fruit].some(
      d => d && d.dishName && d.dishName !== '待定'
    )
    
    if (!hasValidDish) return null
    
    const renderSnackItem = (dish: MealDish | undefined, label: string, subKey: string, cls: string) => {
      if (!dish?.dishName || dish.dishName === '待定') return null
      return (
        <View className={`snack-item ${cls}`}>
          <View className='item-header'>
            <Text className='item-label'>{label}</Text>
            <View className='edit-icon-small' onClick={(e) => { e.stopPropagation(); handleEditDish(dayIdx, 'afternoonSnack', subKey) }}>
              <Text>✏️</Text>
            </View>
          </View>
          <Text className='item-name'>{dish.dishName}</Text>
          <View className='item-ingredients editable'>
            {dish.ingredients?.map((ing, i) => (
              <View key={i} className='ing-row'>
                <View className='ing-info' onClick={(e) => { e.stopPropagation(); handleEditIngredient(dayIdx, 'afternoonSnack', subKey, i) }}>
                  <Text className='ing'>{ing.name} {ing.perPersonGrams}g/人</Text>
                </View>
                <View className='ing-delete-small' onClick={(e) => { e.stopPropagation(); handleDeleteIngredient(dayIdx, 'afternoonSnack', subKey, i) }}>
                  <Text>✕</Text>
                </View>
              </View>
            ))}
            <View className='add-ing-small' onClick={(e) => { e.stopPropagation(); handleAddIngredient(dayIdx, 'afternoonSnack', subKey) }}>
              <Text>+ 添加</Text>
            </View>
          </View>
        </View>
      )
    }
    
    return (
      <View className='meal-card snack-card editable'>
        <View className='meal-header'>
          <Text className='icon'>🍪</Text>
          <Text className='label'>下午点心</Text>
        </View>
        
        <View className='snack-grid'>
          {renderSnackItem(pastry, '糕点', 'pastry', 'pastry')}
          {renderSnackItem(fruit, '水果', 'fruit', 'fruit')}
        </View>
      </View>
    )
  }
  
  // 渲染可编辑的当日食谱
  const renderEditableDayMenu = (dayRecipe: DailyRecipe | undefined, dayIdx: number) => {
    if (!dayRecipe || !dayRecipe.meals) {
      return (
        <View className='no-data'>
          <Text className='icon'>📭</Text>
          <Text>暂无此日食谱</Text>
        </View>
      )
    }
    
    const { meals } = dayRecipe
    
    return (
      <View className='day-menu'>
        {renderEditableBreakfast(meals.breakfast, dayIdx)}
        {renderEditableDish('水果加餐', meals.morningFruitSnack, '🍎', 'fruit', 'morningFruitSnack', dayIdx)}
        {renderEditableDish('上午点心', meals.morningSnack, '🥐', 'morning-snack', 'morningSnack', dayIdx)}
        {renderEditableLunch(meals.lunch, dayIdx)}
        {renderEditableDish('牛奶加餐', meals.milkSnack, '🥛', 'milk', 'milkSnack', dayIdx)}
        {renderEditableAfternoonSnack(meals.afternoonSnack, dayIdx)}
        {renderEditableDish('晚餐', meals.dinner, '🍲', 'dinner', 'dinner', dayIdx)}
      </View>
    )
  }

  // 选择历史食谱
  const selectHistoryRecord = (record: WeeklyRecipeRecord) => {
    setCurrentRecord(record)
    setViewMode('current')
    setActiveDayIdx(0)
  }

  if (isLoading) {
    return (
      <View className='loading-page'>
        <Text className='loading-icon'>🍳</Text>
        <Text className='loading-text'>加载中...</Text>
      </View>
    )
  }

  return (
    <View className='kitchen-page'>
      <NavBar title='本周食谱' />
      <NavBarPlaceholder />
      
      {/* 顶部标题栏 */}
      <View className='header'>
        <View className='header-main'>
          <Text className='title'>🍳 食谱管理</Text>
          <View 
            className={`sync-btn ${isSyncing ? 'syncing' : ''}`} 
            onClick={!isSyncing ? handleSync : undefined}
          >
            <Text>{isSyncing ? '同步中...' : '🔄 同步'}</Text>
          </View>
        </View>
        
        {currentRecord && (
          <View className='header-info'>
            <Text className='campus'>{CAMPUS_CONFIG[currentRecord.grade]?.name || currentRecord.grade}</Text>
            <Text className='week-range'>{currentRecord.weekRange}</Text>
            <Text className='headcount'>{currentRecord.headcount}人用餐</Text>
          </View>
        )}
      </View>

      {/* 视图切换 */}
      <View className='view-tabs'>
        <View 
          className={`view-tab ${viewMode === 'current' ? 'active' : ''}`}
          onClick={() => setViewMode('current')}
        >
          <Text>📋 本周食谱</Text>
        </View>
        <View 
          className={`view-tab ${viewMode === 'history' ? 'active' : ''}`}
          onClick={() => setViewMode('history')}
        >
          <Text>📚 历史 ({history.filter(r => r.status === 'CONFIRMED').length})</Text>
        </View>
        <View 
          className={`view-tab ${viewMode === 'ai' ? 'active' : ''}`}
          onClick={() => setViewMode('ai')}
        >
          <Text>🤖 AI推荐</Text>
        </View>
      </View>

      {viewMode === 'ai' ? (
        <ScrollView className='ai-recipe-panel' scrollY>
          <View className='ai-header'>
            <Text className='ai-title'>🤖 AI智能食谱生成</Text>
            <Text className='ai-desc'>根据《3-6岁儿童学习与发展指南》营养标准</Text>
          </View>
          
          {/* 日期范围选择 */}
          <View className='date-range-section'>
            <Text className='section-title'>📅 食谱日期范围</Text>
            <View className='date-inputs'>
              <View className='date-item'>
                <Text className='date-label'>开始日期</Text>
                <Picker 
                  mode='date' 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.detail.value)}
                >
                  <View className='date-picker'>
                    <Text>{startDate || '选择日期'}</Text>
                  </View>
                </Picker>
              </View>
              <Text className='date-separator'>至</Text>
              <View className='date-item'>
                <Text className='date-label'>结束日期</Text>
                <Picker 
                  mode='date' 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.detail.value)}
                >
                  <View className='date-picker'>
                    <Text>{endDate || '选择日期'}</Text>
                  </View>
                </Picker>
              </View>
            </View>
            {aiGeneratedRecord && (
              <View className='update-date-btn' onClick={updateDateRange}>
                <Text>📆 更新日期到食谱</Text>
              </View>
            )}
          </View>
          
          {/* 当日出勤人数显示 */}
          {todayAttendance > 0 && (
            <View className='attendance-info'>
              <Text className='attendance-icon'>📊</Text>
              <Text className='attendance-text'>今日出勤：{todayAttendance}人</Text>
              <View className='use-attendance-btn' onClick={() => setAiHeadcount(todayAttendance)}>
                <Text>使用此人数</Text>
              </View>
            </View>
          )}
          
          {/* 园区选择 */}
          <View className='ai-input-section'>
            <Text className='input-label'>选择园区：</Text>
            <View className='grade-options'>
              {(['SHIQI_YOU', 'JIU_YOU', 'HIGH_END', 'PHUI'] as CampusGrade[]).map(g => (
                <View 
                  key={g}
                  className={`grade-option ${aiGrade === g ? 'active' : ''}`}
                  onClick={() => setAiGrade(g)}
                >
                  <Text>{CAMPUS_CONFIG[g].name}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* 人数输入 */}
          <View className='ai-input-section'>
            <Text className='input-label'>用餐人数：</Text>
            <View className='headcount-input'>
              <View className='headcount-btn' onClick={() => setAiHeadcount(Math.max(10, aiHeadcount - 10))}>
                <Text>-</Text>
              </View>
              <Input 
                className='headcount-value-input'
                type='number'
                value={aiHeadcount.toString()}
                onInput={(e) => setAiHeadcount(parseInt(e.detail.value) || 10)}
              />
              <Text className='headcount-unit'>人</Text>
              <View className='headcount-btn' onClick={() => setAiHeadcount(aiHeadcount + 10)}>
                <Text>+</Text>
              </View>
            </View>
          </View>
          
          {/* 营养标准指南按钮 */}
          <View className='nutrition-guide-toggle' onClick={() => setShowNutritionGuide(!showNutritionGuide)}>
            <Text className='toggle-icon'>📚</Text>
            <Text className='toggle-text'>《3-6岁儿童学习与发展指南》营养标准</Text>
            <Text className='toggle-arrow'>{showNutritionGuide ? '▲' : '▼'}</Text>
          </View>
          
          {showNutritionGuide && (
            <View className='nutrition-guide-card'>
              <Text className='guide-title'>📖 学龄前儿童每日营养需求</Text>
              <View className='guide-grid'>
                {Object.entries(NUTRITION_STANDARDS).map(([key, val]) => (
                  <View key={key} className='guide-item'>
                    <Text className='guide-label'>{val.label}</Text>
                    <Text className='guide-value'>{val.min}-{val.max}{val.unit}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          <View 
            className={`generate-btn ${isGenerating ? 'loading' : ''}`}
            onClick={!isGenerating ? handleGenerateRecipe : undefined}
          >
            <Text>{isGenerating ? '⏳ AI生成中...' : '✨ 生成本周食谱'}</Text>
          </View>
          
          {/* AI生成的食谱预览 */}
          {aiGeneratedRecord && (
            <View className='ai-preview'>
              <View className='preview-header'>
                <Text className='preview-title'>📋 生成结果预览（可编辑）</Text>
                <View className='apply-btn' onClick={handleApplyAiRecipe}>
                  <Text>✅ 应用食谱</Text>
                </View>
              </View>
              
              <View className='preview-info'>
                <Text className='info-item'>🏫 {CAMPUS_CONFIG[aiGeneratedRecord.grade]?.name}</Text>
                <Text className='info-item'>👥 {aiHeadcount}人</Text>
                <Text className='info-item'>📅 {aiGeneratedRecord.weekRange}</Text>
              </View>
              
              {/* 星期选择 */}
              <View className='day-tabs compact'>
                {weekdays.map((day, index) => (
                  <View
                    key={day}
                    className={`day-tab ${aiActiveDayIdx === index ? 'active' : ''}`}
                    onClick={() => setAiActiveDayIdx(index)}
                  >
                    <Text className='day-name'>{day}</Text>
                  </View>
                ))}
              </View>
              
              {/* 当日食谱（可编辑版本） */}
              {aiGeneratedRecord.days[aiActiveDayIdx] && (
                <View className='editable-day-menu'>
                  {renderEditableDayMenu(aiGeneratedRecord.days[aiActiveDayIdx], aiActiveDayIdx)}
                </View>
              )}
              
              {/* 当日食材总量 */}
              <View className='total-section'>
                <View className='total-toggle' onClick={() => setShowDailyTotal(!showDailyTotal)}>
                  <Text className='toggle-icon'>🥬</Text>
                  <Text className='toggle-text'>{weekdays[aiActiveDayIdx]}食材总量（{aiHeadcount}人份）</Text>
                  <Text className='toggle-arrow'>{showDailyTotal ? '▲' : '▼'}</Text>
                </View>
                
                {showDailyTotal && (
                  <View className='total-ingredients-card'>
                    <View className='ingredients-header'>
                      <Text className='header-title'>🍳 {weekdays[aiActiveDayIdx]}备料清单</Text>
                      <Text className='header-subtitle'>{aiHeadcount}人份</Text>
                    </View>
                    <View className='ingredients-grid'>
                      {calculateDailyIngredients.map((ing, idx) => (
                        <View key={idx} className='ingredient-item'>
                          <Text className='ing-name'>{ing.name}</Text>
                          <View className='ing-amounts'>
                            <Text className='ing-grams'>{ing.grams}g</Text>
                            {ing.grams >= 1000 && <Text className='ing-kg'>({ing.kg}kg)</Text>}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
              
              {/* 一周食材总量 */}
              <View className='total-section weekly'>
                <View className='total-toggle' onClick={() => setShowWeeklyTotal(!showWeeklyTotal)}>
                  <Text className='toggle-icon'>📦</Text>
                  <Text className='toggle-text'>一周食材总量（{aiHeadcount}人 × 5天）</Text>
                  <Text className='toggle-arrow'>{showWeeklyTotal ? '▲' : '▼'}</Text>
                </View>
                
                {showWeeklyTotal && (
                  <View className='total-ingredients-card weekly'>
                    <View className='ingredients-header'>
                      <Text className='header-title'>📦 一周采购清单</Text>
                      <Text className='header-subtitle'>{aiHeadcount}人 × 5天</Text>
                    </View>
                    <View className='ingredients-grid'>
                      {calculateWeeklyIngredients.map((ing, idx) => (
                        <View key={idx} className='ingredient-item'>
                          <Text className='ing-name'>{ing.name}</Text>
                          <View className='ing-amounts'>
                            <Text className='ing-grams'>{ing.grams}g</Text>
                            {ing.grams >= 1000 && <Text className='ing-kg'>({ing.kg}kg)</Text>}
                          </View>
                        </View>
                      ))}
                    </View>
                    <View className='weekly-summary'>
                      <Text className='summary-text'>共 {calculateWeeklyIngredients.length} 种食材</Text>
                      <Text className='summary-text'>
                        总重约 {(calculateWeeklyIngredients.reduce((sum, ing) => sum + ing.grams, 0) / 1000).toFixed(1)} kg
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
          
          <View className='ai-tips'>
            <Text className='tips-title'>💡 使用提示</Text>
            <Text className='tips-item'>• 可选择食谱的日期范围（从几号到几号）</Text>
            <Text className='tips-item'>• 点击菜品名称右侧的✏️可编辑菜名</Text>
            <Text className='tips-item'>• 点击食材可编辑名称和克数</Text>
            <Text className='tips-item'>• 点击"+ 添加食材"可新增食材</Text>
            <Text className='tips-item'>• 食材总量集中显示在食谱底部</Text>
            <Text className='tips-item'>• 展开"一周食材总量"可查看采购清单</Text>
          </View>
          
          <View style={{ height: '120rpx' }} />
        </ScrollView>
      ) : viewMode === 'current' ? (
        <>
          {currentRecord && currentRecord.days && currentRecord.days.length > 0 ? (
            <>
              {/* 星期选择 */}
              <View className='day-tabs'>
                {weekdays.map((day, index) => (
                  <View
                    key={day}
                    className={`day-tab ${activeDayIdx === index ? 'active' : ''}`}
                    onClick={() => setActiveDayIdx(index)}
                  >
                    <Text className='day-name'>{day}</Text>
                  </View>
                ))}
              </View>

              {/* 当日食谱内容 */}
              <ScrollView className='menu-content' scrollY>
                {renderDayMenu(currentRecord.days[activeDayIdx])}
                
                {/* 营养信息 */}
                {currentRecord.nutritionSummary && (
                  <View className='nutrition-card'>
                    <Text className='nutrition-title'>📊 营养概览</Text>
                    <View className='nutrition-items'>
                      <View className='nutrition-item'>
                        <Text className='value'>{currentRecord.nutritionSummary.avgEnergy}</Text>
                        <Text className='label'>平均能量(kcal)</Text>
                      </View>
                      <View className='nutrition-item'>
                        <Text className='value'>{currentRecord.nutritionSummary.avgProtein}</Text>
                        <Text className='label'>平均蛋白(g)</Text>
                      </View>
                      <View className='nutrition-item'>
                        <Text className='value'>{currentRecord.nutritionSummary.varietyCount}</Text>
                        <Text className='label'>食材种类</Text>
                      </View>
                    </View>
                  </View>
                )}
                
                <View style={{ height: '120rpx' }} />
              </ScrollView>
            </>
          ) : (
            <View className='empty-state'>
              <Text className='empty-icon'>📭</Text>
              <Text className='empty-title'>暂无食谱数据</Text>
              <Text className='empty-hint'>点击右上角"同步"从云端获取数据</Text>
              <View className='sync-btn-big' onClick={handleSync}>
                <Text>🔄 立即同步</Text>
              </View>
            </View>
          )}
        </>
      ) : (
        /* 历史食谱列表 */
        <ScrollView className='history-list' scrollY>
          {history.filter(r => r.status === 'CONFIRMED').length > 0 ? (
            history.filter(r => r.status === 'CONFIRMED').map(record => (
              <View 
                key={record.id} 
                className='history-card'
                onClick={() => selectHistoryRecord(record)}
              >
                <View className='history-header'>
                  <Text className='history-campus'>{CAMPUS_CONFIG[record.grade]?.name || record.grade}</Text>
                  <Text className='history-status'>已确认</Text>
                </View>
                <Text className='history-week'>{record.weekRange}</Text>
                <View className='history-meta'>
                  <Text className='meta-item'>👥 {record.headcount}人</Text>
                  <Text className='meta-item'>📅 {new Date(record.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>
            ))
          ) : (
            <View className='empty-state'>
              <Text className='empty-icon'>📚</Text>
              <Text className='empty-title'>暂无历史食谱</Text>
            </View>
          )}
          
          <View style={{ height: '120rpx' }} />
        </ScrollView>
      )}
      
      {/* 编辑弹窗 */}
      {isEditing && editingState && (
        <View className='edit-modal-overlay' onClick={() => setIsEditing(false)}>
          <View className='edit-modal' onClick={e => e.stopPropagation()}>
            {editingState.type === 'dish' ? (
              <>
                <Text className='modal-title'>✏️ 编辑菜品名称</Text>
                <Input
                  className='edit-input'
                  value={editDishName}
                  onInput={e => setEditDishName(e.detail.value)}
                  placeholder='请输入菜品名称'
                  focus
                />
              </>
            ) : (
              <>
                <Text className='modal-title'>
                  {editingState.type === 'addIngredient' ? '➕ 添加食材' : '✏️ 编辑食材'}
                </Text>
                <View className='edit-field'>
                  <Text className='field-label'>食材名称</Text>
                  <Input
                    className='edit-input'
                    value={editIngredientName}
                    onInput={e => setEditIngredientName(e.detail.value)}
                    placeholder='如：鸡蛋、西红柿'
                    focus={editingState.type === 'addIngredient'}
                  />
                </View>
                <View className='edit-field'>
                  <Text className='field-label'>每人克数</Text>
                  <View className='grams-input-wrap'>
                    <Input
                      className='edit-input grams'
                      type='digit'
                      value={editIngredientGrams}
                      onInput={e => setEditIngredientGrams(e.detail.value)}
                      placeholder='如：30'
                    />
                    <Text className='grams-unit'>g/人</Text>
                  </View>
                </View>
              </>
            )}
            <View className='modal-actions'>
              <View className='modal-btn cancel' onClick={() => setIsEditing(false)}>
                <Text>取消</Text>
              </View>
              <View className='modal-btn confirm' onClick={handleSaveEdit}>
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
