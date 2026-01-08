/**
 * 豆包大模型服务（Doubao by 火山引擎）
 * 使用 OpenAI 兼容接口
 */

import { WeeklyRecipeRecord, CampusGrade, DailyRecipe, MealDish, CAMPUS_CONFIG } from "../types";
import { calculateDishNutrition } from "./nutritionDatabase";

// 豆包 API 配置
const DOUBAO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DOUBAO_MODEL = "doubao-seed-1-6-251015";

// 获取 API Key
const getApiKey = (): string => {
  return process.env.DOUBAO_API_KEY || process.env.API_KEY || "";
};

// 定义标准空食谱作为回退和合并基础
const createEmptyDailyRecipe = (day: string): DailyRecipe => ({
  day,
  meals: {
    breakfast: { dishName: "待定", ingredients: [] },
    morningSnack: { dishName: "待定", ingredients: [] },
    lunch: {
      mainDish: { dishName: "待定", ingredients: [] },
      sideDish: { dishName: "待定", ingredients: [] },
      soup: { dishName: "待定", ingredients: [] },
      staple: { dishName: "待定", ingredients: [] },
    },
    milkSnack: { dishName: "纯牛奶", ingredients: [{ name: "牛奶", perPersonGrams: 250 }] },
    afternoonSnack: { dishName: "待定", ingredients: [] },
    dinner: { dishName: "待定", ingredients: [] },
  }
});

// 获取园区特色描述
const getCampusFeatures = (grade: CampusGrade): string => {
  const config = CAMPUS_CONFIG[grade];
  switch (grade) {
    case 'PHUI':
      return `【普惠园标准】
      - 营养均衡，满足幼儿基本营养需求
      - 食材选用经济实惠的常见食材
      - 午点以简单糕点+水果为主`;
    case 'HIGH_END':
      return `【高端园标准】
      - 早餐后增加水果加餐（如火龙果60g+葡萄50g）
      - 午点更加丰富，包含精致甜品（如火龙果西米露、银耳雪梨汤）
      - 食材选用品质更高的食材`;
    case 'JIU_YOU':
    case 'SHIQI_YOU':
      return `【${config.name}特色】
      - 早餐后有丰富水果加餐
      - 午点包含蛋挞、莲子雪梨汤等精致点心
      - 周五安排"欢乐自助餐"：西式牛排、意大利面、薯条、太阳蛋、南瓜沙等`;
    default:
      return '';
  }
};

/**
 * 调用豆包 API
 */
async function callDoubaoAPI(
  systemPrompt: string,
  userMessage: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json' | 'text';
  } = {}
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const { temperature = 0.7, maxTokens = 4096, responseFormat = 'text' } = options;

  const requestBody: any = {
    model: DOUBAO_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: [{ type: "text", text: userMessage }]
      }
    ],
    temperature,
    max_completion_tokens: maxTokens,
    reasoning_effort: "medium",
  };

  // 如果需要 JSON 格式响应
  if (responseFormat === 'json') {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(DOUBAO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("豆包 API 错误:", response.status, errorText);
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 生成周食谱
 */
const _internalGenerateWeeklyRecipe = async (grade: CampusGrade, headcount: number) => {
  const campusFeatures = getCampusFeatures(grade);
  
  const systemPrompt = `你是金星教育集团的高级营养师。请为【${CAMPUS_CONFIG[grade].name}】生成周一至周五的幼儿园全周食谱。
  
  ${campusFeatures}

  【核心要求】
  1. 必须严格返回 JSON 格式，结构如下：
  {
    "days": [
      {
        "day": "周一",
        "meals": {
          "breakfast": { "dishName": "菜名", "ingredients": [{"name": "食材", "perPersonGrams": 数字}] },
          "morningFruitSnack": { "dishName": "菜名", "ingredients": [...] },
          "morningSnack": { "dishName": "菜名", "ingredients": [...] },
          "lunch": {
            "mainDish": { "dishName": "菜名", "ingredients": [...] },
            "sideDish": { "dishName": "菜名", "ingredients": [...] },
            "soup": { "dishName": "菜名", "ingredients": [...] },
            "staple": { "dishName": "菜名", "ingredients": [...] }
          },
          "milkSnack": { "dishName": "纯牛奶", "ingredients": [{"name": "牛奶", "perPersonGrams": 250}] },
          "afternoonSnack": { "dishName": "菜名", "ingredients": [...] },
          "dinner": { "dishName": "菜名", "ingredients": [...] }
        }
      }
    ],
    "nutritionSummary": { "avgEnergy": 1350, "avgProtein": 45, "varietyCount": 30 }
  }
  
  2. 每道菜的 ingredients 必须包含该菜品的所有主要食材，每种食材包含 name 和 perPersonGrams。
  3. 五天的每一餐都要不同，不能重复同样的菜品。
  4. 为 ${headcount} 位幼儿进行规划。

  【营养标准】
  - 幼儿每日能量需求：1200-1400 kcal
  - 蛋白质：35-45g
  - 钙：600-800mg
  - 铁：9-12mg`;

  const userMessage = `请为 ${CAMPUS_CONFIG[grade].name} 生成本周（周一至周五）的详细食谱，包含每道菜的食材和克重。只返回 JSON，不要其他内容。`;

  const responseText = await callDoubaoAPI(systemPrompt, userMessage, {
    temperature: 0.8,
    maxTokens: 8192,
    responseFormat: 'json'
  });

  // 清理并解析 JSON
  let cleanJson = responseText.trim();
  // 移除可能的 markdown 代码块标记
  cleanJson = cleanJson.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  
  return JSON.parse(cleanJson);
};

// 计算每日营养汇总
function calculateDailyNutrition(meals: DailyRecipe['meals']): DailyRecipe['dailyNutrition'] {
  const allDishes: MealDish[] = [
    meals.breakfast,
    meals.morningFruitSnack,
    meals.morningSnack,
    meals.lunch?.mainDish,
    meals.lunch?.sideDish,
    meals.lunch?.soup,
    meals.lunch?.staple,
    meals.milkSnack,
    meals.afternoonSnack,
    meals.dinner
  ].filter(Boolean) as MealDish[];

  let totalEnergy = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0, totalCalcium = 0, totalIron = 0;

  for (const dish of allDishes) {
    if (dish?.ingredients) {
      const nutrition = calculateDishNutrition(dish.ingredients);
      totalEnergy += nutrition.energy;
      totalProtein += nutrition.protein;
      totalFat += nutrition.fat;
      totalCarbs += nutrition.carbs;
      totalCalcium += nutrition.calcium;
      totalIron += nutrition.iron;
    }
  }

  return {
    totalEnergy: Math.round(totalEnergy),
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalCalcium: Math.round(totalCalcium),
    totalIron: Math.round(totalIron * 10) / 10,
  };
}

/**
 * 生成周食谱（对外接口）
 */
export const generateWeeklyRecipe = async (grade: CampusGrade, headcount: number): Promise<WeeklyRecipeRecord> => {
  try {
    const data = await _internalGenerateWeeklyRecipe(grade, headcount);
    
    const record: WeeklyRecipeRecord = {
      id: Date.now().toString(),
      weekRange: "本周计划",
      grade,
      headcount,
      days: (data.days || []).map((dayData: any, idx: number) => {
        const base = createEmptyDailyRecipe(["周一", "周二", "周三", "周四", "周五"][idx] || "未知");
        const mergedMeals = {
          ...base.meals,
          ...(dayData.meals || {}),
          lunch: {
            ...base.meals.lunch,
            ...(dayData.meals?.lunch || {})
          }
        };
        
        return {
          ...base,
          ...dayData,
          meals: mergedMeals,
          dailyNutrition: calculateDailyNutrition(mergedMeals)
        };
      }),
      nutritionSummary: data.nutritionSummary || { avgEnergy: 1350, avgProtein: 50, varietyCount: 15 },
      status: 'DRAFT',
      createdAt: new Date().toISOString()
    };
    
    return record;
  } catch (error) {
    console.error("AI Generation failed, using fallback:", error);
    return getFallbackWeeklyRecipe(grade, headcount) as WeeklyRecipeRecord;
  }
};

/**
 * AI 助手对话
 * 优先查询内部知识库，如果有相关资料则基于资料回答
 */
export const chatWithAssistant = async (message: string): Promise<string> => {
  // 动态导入知识库服务（避免循环依赖）
  const { aiSearchKnowledge, generateAIContext, initializeKnowledgeBase } = await import('./knowledgeBaseService');
  
  // 确保知识库已初始化
  initializeKnowledgeBase();
  
  // 搜索内部知识库
  const searchResult = aiSearchKnowledge(message);
  
  // 构建系统提示
  let systemPrompt = `你是金星教育集团的"金星AI助手"。你的职责是：
1. **优先依据学校内部资料**回答问题（如退费准则、备课模板、工作规范等）
2. 提供幼儿教育相关的专业建议
3. 帮助老师和家长解决日常问题
4. 保持友好、专业、有耐心的态度

【重要原则】
- 如果内部知识库有相关资料，必须以资料为准回答
- 如果是模板类请求，根据模板格式帮助用户生成内容
- 如果内部没有相关资料，可以根据通用知识回答，但要提醒用户确认学校具体规定
- 回答要简洁实用，直接解决用户问题`;

  // 构建用户消息
  let userMessage = message;
  
  if (searchResult.found) {
    // 有内部资料，构建上下文
    const context = generateAIContext(message);
    userMessage = context;
    systemPrompt += `\n\n【本次回答须参考的内部资料】
已为您找到 ${searchResult.documents.length} 份相关内部文档，请务必基于这些资料回答。`;
  } else {
    // 没有内部资料
    userMessage = `用户问题：${message}

注意：内部知识库中未找到直接相关的资料。请根据你的专业知识回答，但建议用户向园方确认具体规定。`;
  }

  try {
    const response = await callDoubaoAPI(systemPrompt, userMessage, {
      temperature: 0.7,
      maxTokens: 2048
    });
    
    // 如果没找到内部资料，添加提示
    if (!searchResult.found) {
      return response + '\n\n💡 *提示：此回答基于通用知识，具体政策请以学校规定为准。如有疑问，可咨询园长办公室。*';
    }
    
    return response;
  } catch (error) {
    console.error("Chat failed:", error);
    return '抱歉，我现在无法回答，请稍后再试。';
  }
};

/**
 * 生成幼儿日报
 */
export const generateDailyReport = async (name: string, points: string): Promise<string> => {
  const systemPrompt = `你是一位资深幼儿园教师，请为幼儿生成温馨、专业的每日报告。
报告要：
1. 语言温馨，让家长放心
2. 突出孩子的进步和亮点
3. 给出适当的家庭配合建议
4. 控制在 200 字以内`;

  try {
    return await callDoubaoAPI(systemPrompt, `为幼儿 ${name} 生成今日报告，要点：${points}`, {
      temperature: 0.8,
      maxTokens: 1024
    });
  } catch (error) {
    console.error("Report generation failed:", error);
    return '报告生成失败，请稍后重试。';
  }
};

// ========== 回退食谱 ==========
function getFallbackWeeklyRecipe(grade: CampusGrade, headcount: number): Partial<WeeklyRecipeRecord> {
  const dish = (name: string, ingredients: Array<{name: string, perPersonGrams: number}>) => ({
    dishName: name,
    ingredients
  });

  // 普惠园基础食谱
  const phuiDays: DailyRecipe[] = [
    {
      day: "周一",
      meals: {
        breakfast: dish("高粱窝窝头+洋葱木耳炒蛋+红枣小米粥", [
          { name: "面粉", perPersonGrams: 28 }, { name: "高粱面", perPersonGrams: 3 },
          { name: "鸡蛋", perPersonGrams: 30 }, { name: "洋葱", perPersonGrams: 60 }, { name: "木耳", perPersonGrams: 2 },
          { name: "红枣", perPersonGrams: 2 }, { name: "小米", perPersonGrams: 15 }
        ]),
        morningSnack: dish("时令水果", [{ name: "苹果", perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish("鱼香肉丝", [
            { name: "里脊肉", perPersonGrams: 30 }, { name: "胡萝卜", perPersonGrams: 45 },
            { name: "木耳", perPersonGrams: 1 }, { name: "青椒", perPersonGrams: 15 }, { name: "番茄酱", perPersonGrams: 3 }
          ]),
          sideDish: dish("海米冬瓜", [
            { name: "海米", perPersonGrams: 2 }, { name: "冬瓜", perPersonGrams: 80 }
          ]),
          soup: dish("西红柿蛋花汤", [
            { name: "西红柿", perPersonGrams: 15 }, { name: "鸡蛋", perPersonGrams: 10 }, { name: "小白菜", perPersonGrams: 10 }
          ]),
          staple: dish("金银饭", [{ name: "大米", perPersonGrams: 55 }, { name: "小米", perPersonGrams: 5 }])
        },
        milkSnack: dish("纯牛奶", [{ name: "牛奶", perPersonGrams: 250 }]),
        afternoonSnack: dish("南瓜甜甜圈+坚果+火龙果", [
          { name: "面粉", perPersonGrams: 20 }, { name: "南瓜", perPersonGrams: 10 },
          { name: "葡萄干", perPersonGrams: 2 }, { name: "火龙果", perPersonGrams: 80 }
        ]),
        dinner: dish("油菜烧豆腐", [
          { name: "油菜", perPersonGrams: 40 }, { name: "豆腐", perPersonGrams: 30 }
        ])
      }
    },
    {
      day: "周二",
      meals: {
        breakfast: dish("千层饼+五香鹌鹑蛋+西红柿疙瘩汤", [
          { name: "面粉", perPersonGrams: 28 }, { name: "鹌鹑蛋", perPersonGrams: 30 },
          { name: "西红柿", perPersonGrams: 15 }, { name: "生菜", perPersonGrams: 5 }
        ]),
        morningSnack: dish("时令水果", [{ name: "香蕉", perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish("蒜蓉粉丝虾", [
            { name: "大虾", perPersonGrams: 45 }, { name: "粉丝", perPersonGrams: 5 },
            { name: "大蒜", perPersonGrams: 3 }
          ]),
          sideDish: dish("醋溜土豆丝", [
            { name: "土豆", perPersonGrams: 50 }, { name: "青椒", perPersonGrams: 10 }
          ]),
          soup: dish("红豆薏仁汤", [
            { name: "红豆", perPersonGrams: 8 }, { name: "薏仁", perPersonGrams: 6 }
          ]),
          staple: dish("香米饭", [{ name: "大米", perPersonGrams: 60 }])
        },
        milkSnack: dish("纯牛奶", [{ name: "牛奶", perPersonGrams: 250 }]),
        afternoonSnack: dish("蝴蝶卷+苹果", [
          { name: "面粉", perPersonGrams: 23 }, { name: "苹果", perPersonGrams: 80 }
        ]),
        dinner: dish("肉沫炒包菜丝", [
          { name: "后腿肉", perPersonGrams: 20 }, { name: "包菜", perPersonGrams: 65 }
        ])
      }
    },
    {
      day: "周三",
      meals: {
        breakfast: dish("肉蓉卷+营养豆浆", [
          { name: "面粉", perPersonGrams: 28 }, { name: "后腿肉", perPersonGrams: 10 },
          { name: "黄豆", perPersonGrams: 15 }
        ]),
        morningSnack: dish("时令水果", [{ name: "橙子", perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish("蒸卤面", [
            { name: "面条", perPersonGrams: 85 }, { name: "后腿肉", perPersonGrams: 30 },
            { name: "黄豆芽", perPersonGrams: 45 }
          ]),
          sideDish: dish("蚝油生菜", [
            { name: "生菜", perPersonGrams: 70 }
          ]),
          soup: dish("凤凰玉米羹", [
            { name: "玉米糁", perPersonGrams: 15 }, { name: "鸡蛋", perPersonGrams: 10 }
          ]),
          staple: dish("卤鸡肝", [{ name: "鸡肝", perPersonGrams: 35 }])
        },
        milkSnack: dish("纯牛奶", [{ name: "牛奶", perPersonGrams: 250 }]),
        afternoonSnack: dish("红豆包+西瓜", [
          { name: "面粉", perPersonGrams: 25 }, { name: "红豆", perPersonGrams: 15 },
          { name: "西瓜", perPersonGrams: 120 }
        ]),
        dinner: dish("时蔬炒蛋", [
          { name: "鸡蛋", perPersonGrams: 40 }, { name: "胡萝卜", perPersonGrams: 15 }
        ])
      }
    },
    {
      day: "周四",
      meals: {
        breakfast: dish("红糖枣糕+燕麦粥", [
          { name: "面粉", perPersonGrams: 28 }, { name: "红枣", perPersonGrams: 2 },
          { name: "燕麦", perPersonGrams: 10 }
        ]),
        morningSnack: dish("时令水果", [{ name: "葡萄", perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish("排骨炖胡萝卜", [
            { name: "排骨", perPersonGrams: 90 }, { name: "胡萝卜", perPersonGrams: 45 }
          ]),
          sideDish: dish("茄子烧豆角丝", [
            { name: "茄子", perPersonGrams: 45 }, { name: "长豆角", perPersonGrams: 25 }
          ]),
          soup: dish("芹菜炒豆干", [
            { name: "芹菜", perPersonGrams: 50 }, { name: "香干", perPersonGrams: 10 }
          ]),
          staple: dish("刀切馒头", [{ name: "面粉", perPersonGrams: 60 }])
        },
        milkSnack: dish("纯牛奶", [{ name: "牛奶", perPersonGrams: 250 }]),
        afternoonSnack: dish("火龙果奶香包+香蕉", [
          { name: "面粉", perPersonGrams: 20 }, { name: "香蕉", perPersonGrams: 110 }
        ]),
        dinner: dish("时蔬汤", [
          { name: "西红柿", perPersonGrams: 20 }, { name: "青菜", perPersonGrams: 20 }
        ])
      }
    },
    {
      day: "周五",
      meals: {
        breakfast: dish("奶香馍头+炒合菜", [
          { name: "面粉", perPersonGrams: 28 }, { name: "牛奶", perPersonGrams: 5 },
          { name: "绿豆芽", perPersonGrams: 65 }
        ]),
        morningSnack: dish("时令水果", [{ name: "火龙果", perPersonGrams: 80 }]),
        lunch: {
          mainDish: dish("西葫芦炒肉丝", [
            { name: "西葫芦", perPersonGrams: 75 }, { name: "五花肉", perPersonGrams: 30 }
          ]),
          sideDish: dish("素三鲜", [
            { name: "胡萝卜", perPersonGrams: 45 }, { name: "鸡蛋", perPersonGrams: 30 }
          ]),
          soup: dish("绿豆汤", [{ name: "绿豆", perPersonGrams: 15 }]),
          staple: dish("素三鲜包子", [{ name: "面粉", perPersonGrams: 60 }])
        },
        milkSnack: dish("纯牛奶", [{ name: "牛奶", perPersonGrams: 250 }]),
        afternoonSnack: dish("蒸玉米+油桃", [
          { name: "鲜玉米", perPersonGrams: 140 }, { name: "油桃", perPersonGrams: 80 }
        ]),
        dinner: dish("时蔬面", [
          { name: "面条", perPersonGrams: 60 }, { name: "青菜", perPersonGrams: 30 }
        ])
      }
    }
  ];

  // 添加营养计算
  const daysWithNutrition = phuiDays.map(day => ({
    ...day,
    dailyNutrition: calculateDailyNutrition(day.meals)
  }));

  const avgEnergy = Math.round(daysWithNutrition.reduce((sum, d) => sum + (d.dailyNutrition?.totalEnergy || 0), 0) / 5);
  const avgProtein = Math.round(daysWithNutrition.reduce((sum, d) => sum + (d.dailyNutrition?.totalProtein || 0), 0) / 5 * 10) / 10;

  return {
    id: 'fallback-' + Date.now(),
    days: daysWithNutrition,
    grade,
    headcount,
    status: 'DRAFT',
    nutritionSummary: { avgEnergy, avgProtein, varietyCount: 35 },
    createdAt: new Date().toISOString(),
    weekRange: `${CAMPUS_CONFIG[grade].name} - 本周计划`
  };
}

