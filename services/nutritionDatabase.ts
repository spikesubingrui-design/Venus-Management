/**
 * 金星幼儿园食材营养数据库
 * 营养数据来源：中国食物成分表（第6版）
 * 所有数值为每100g可食部分含量
 */

import { NutritionPer100g } from '../types';

// 常见食材营养数据库
export const NUTRITION_DATABASE: Record<string, NutritionPer100g> = {
  // ========== 谷物类 ==========
  '大米': { energy: 346, protein: 7.4, fat: 0.8, carbs: 77.2, fiber: 0.7, calcium: 13, iron: 2.3, vitaminA: 0, vitaminC: 0 },
  '小米': { energy: 358, protein: 9.0, fat: 3.1, carbs: 73.5, fiber: 1.6, calcium: 41, iron: 5.1, vitaminA: 17, vitaminC: 0 },
  '面粉': { energy: 366, protein: 11.2, fat: 1.5, carbs: 75.2, fiber: 2.1, calcium: 31, iron: 3.5, vitaminA: 0, vitaminC: 0 },
  '面条': { energy: 301, protein: 8.3, fat: 0.7, carbs: 64.3, fiber: 1.5, calcium: 16, iron: 2.0, vitaminA: 0, vitaminC: 0 },
  '燕麦': { energy: 377, protein: 15.0, fat: 6.7, carbs: 66.9, fiber: 5.3, calcium: 54, iron: 4.7, vitaminA: 0, vitaminC: 0 },
  '糙米': { energy: 348, protein: 7.7, fat: 2.7, carbs: 73.0, fiber: 3.4, calcium: 23, iron: 1.8, vitaminA: 0, vitaminC: 0 },
  '黑米': { energy: 333, protein: 9.4, fat: 2.5, carbs: 72.2, fiber: 3.9, calcium: 12, iron: 1.6, vitaminA: 0, vitaminC: 0 },
  '高粱面': { energy: 351, protein: 10.4, fat: 3.1, carbs: 70.4, fiber: 4.3, calcium: 22, iron: 6.3, vitaminA: 0, vitaminC: 0 },
  '玉米': { energy: 112, protein: 4.0, fat: 1.2, carbs: 22.8, fiber: 2.9, calcium: 3, iron: 1.1, vitaminA: 63, vitaminC: 16 },
  '玉米糁': { energy: 335, protein: 8.1, fat: 0.8, carbs: 78.0, fiber: 5.6, calcium: 10, iron: 1.8, vitaminA: 7, vitaminC: 0 },
  '意大利面': { energy: 350, protein: 12.0, fat: 1.5, carbs: 72.0, fiber: 3.0, calcium: 21, iron: 1.5, vitaminA: 0, vitaminC: 0 },
  
  // ========== 豆类 ==========
  '黄豆': { energy: 390, protein: 35.0, fat: 16.0, carbs: 25.3, fiber: 15.5, calcium: 191, iron: 8.2, vitaminA: 37, vitaminC: 0 },
  '红豆': { energy: 324, protein: 20.2, fat: 0.6, carbs: 63.4, fiber: 7.7, calcium: 74, iron: 7.4, vitaminA: 13, vitaminC: 0 },
  '绿豆': { energy: 329, protein: 21.6, fat: 0.8, carbs: 62.0, fiber: 6.4, calcium: 81, iron: 6.5, vitaminA: 22, vitaminC: 0 },
  '黑豆': { energy: 381, protein: 36.0, fat: 15.9, carbs: 23.3, fiber: 10.2, calcium: 224, iron: 7.0, vitaminA: 5, vitaminC: 0 },
  '豆腐': { energy: 81, protein: 8.1, fat: 3.7, carbs: 4.2, fiber: 0.4, calcium: 164, iron: 1.9, vitaminA: 0, vitaminC: 0 },
  '薏仁': { energy: 357, protein: 12.8, fat: 3.3, carbs: 71.1, fiber: 2.0, calcium: 42, iron: 3.6, vitaminA: 0, vitaminC: 0 },
  '香干': { energy: 147, protein: 16.2, fat: 7.6, carbs: 4.9, fiber: 0.8, calcium: 308, iron: 4.7, vitaminA: 0, vitaminC: 0 },
  
  // ========== 肉类 ==========
  '五花肉': { energy: 395, protein: 14.0, fat: 37.0, carbs: 0.7, fiber: 0, calcium: 6, iron: 1.0, vitaminA: 18, vitaminC: 0 },
  '猪里脊': { energy: 143, protein: 20.2, fat: 6.2, carbs: 1.5, fiber: 0, calcium: 6, iron: 1.5, vitaminA: 10, vitaminC: 0 },
  '猪肉丝': { energy: 155, protein: 19.0, fat: 8.5, carbs: 0.5, fiber: 0, calcium: 8, iron: 1.4, vitaminA: 12, vitaminC: 0 },
  '猪肉末': { energy: 163, protein: 17.9, fat: 10.2, carbs: 0.4, fiber: 0, calcium: 9, iron: 1.6, vitaminA: 14, vitaminC: 0 },
  '后腿肉': { energy: 190, protein: 19.0, fat: 12.3, carbs: 0.8, fiber: 0, calcium: 7, iron: 1.5, vitaminA: 11, vitaminC: 0 },
  '瘦肉末': { energy: 143, protein: 20.3, fat: 6.2, carbs: 1.5, fiber: 0, calcium: 6, iron: 3.0, vitaminA: 44, vitaminC: 0 },
  '排骨': { energy: 278, protein: 17.0, fat: 23.1, carbs: 0.4, fiber: 0, calcium: 12, iron: 1.0, vitaminA: 8, vitaminC: 0 },
  '牛肉': { energy: 125, protein: 19.9, fat: 4.2, carbs: 2.0, fiber: 0, calcium: 9, iron: 2.8, vitaminA: 6, vitaminC: 0 },
  '牛肉片': { energy: 125, protein: 19.9, fat: 4.2, carbs: 2.0, fiber: 0, calcium: 9, iron: 2.8, vitaminA: 6, vitaminC: 0 },
  '鸡腿': { energy: 181, protein: 16.0, fat: 13.0, carbs: 0.0, fiber: 0, calcium: 9, iron: 1.1, vitaminA: 48, vitaminC: 0 },
  '鸡翅中': { energy: 194, protein: 17.4, fat: 13.8, carbs: 0.4, fiber: 0, calcium: 10, iron: 1.0, vitaminA: 57, vitaminC: 0 },
  '鸡肝': { energy: 121, protein: 16.6, fat: 4.8, carbs: 2.8, fiber: 0, calcium: 7, iron: 12.0, vitaminA: 10414, vitaminC: 18 },
  
  // ========== 蛋奶类 ==========
  '鸡蛋': { energy: 144, protein: 13.3, fat: 8.8, carbs: 2.8, fiber: 0, calcium: 56, iron: 2.0, vitaminA: 234, vitaminC: 0 },
  '鹌鹑蛋': { energy: 160, protein: 12.8, fat: 11.1, carbs: 2.1, fiber: 0, calcium: 47, iron: 3.2, vitaminA: 337, vitaminC: 0 },
  '牛奶': { energy: 54, protein: 3.0, fat: 3.2, carbs: 3.4, fiber: 0, calcium: 104, iron: 0.3, vitaminA: 24, vitaminC: 1 },
  '酸奶': { energy: 72, protein: 2.5, fat: 2.7, carbs: 9.3, fiber: 0, calcium: 118, iron: 0.4, vitaminA: 26, vitaminC: 1 },
  '皮蛋': { energy: 171, protein: 14.2, fat: 10.7, carbs: 4.5, fiber: 0, calcium: 63, iron: 3.3, vitaminA: 192, vitaminC: 0 },
  
  // ========== 水产类 ==========
  '虾仁': { energy: 93, protein: 20.4, fat: 0.7, carbs: 0.5, fiber: 0, calcium: 62, iron: 1.5, vitaminA: 15, vitaminC: 0 },
  '大虾': { energy: 87, protein: 18.6, fat: 0.8, carbs: 1.1, fiber: 0, calcium: 62, iron: 1.5, vitaminA: 15, vitaminC: 0 },
  '巴沙鱼': { energy: 95, protein: 17.0, fat: 2.5, carbs: 0, fiber: 0, calcium: 15, iron: 0.5, vitaminA: 10, vitaminC: 0 },
  '海米': { energy: 198, protein: 43.7, fat: 1.7, carbs: 4.0, fiber: 0, calcium: 991, iron: 6.7, vitaminA: 21, vitaminC: 0 },
  '虾皮': { energy: 153, protein: 30.7, fat: 2.2, carbs: 2.5, fiber: 0, calcium: 991, iron: 6.7, vitaminA: 21, vitaminC: 0 },
  '紫菜': { energy: 207, protein: 26.7, fat: 1.1, carbs: 44.1, fiber: 21.6, calcium: 264, iron: 54.9, vitaminA: 228, vitaminC: 2 },
  '海带': { energy: 12, protein: 1.2, fat: 0.1, carbs: 2.1, fiber: 0.5, calcium: 46, iron: 0.9, vitaminA: 0, vitaminC: 0 },
  
  // ========== 蔬菜类 ==========
  '土豆': { energy: 81, protein: 2.0, fat: 0.2, carbs: 17.8, fiber: 0.7, calcium: 8, iron: 0.8, vitaminA: 5, vitaminC: 27 },
  '胡萝卜': { energy: 37, protein: 1.0, fat: 0.2, carbs: 8.8, fiber: 1.1, calcium: 32, iron: 1.0, vitaminA: 688, vitaminC: 13 },
  '西红柿': { energy: 19, protein: 0.9, fat: 0.2, carbs: 4.0, fiber: 0.5, calcium: 10, iron: 0.4, vitaminA: 92, vitaminC: 19 },
  '番茄': { energy: 19, protein: 0.9, fat: 0.2, carbs: 4.0, fiber: 0.5, calcium: 10, iron: 0.4, vitaminA: 92, vitaminC: 19 },
  '青椒': { energy: 22, protein: 1.0, fat: 0.2, carbs: 5.4, fiber: 1.4, calcium: 14, iron: 0.8, vitaminA: 57, vitaminC: 72 },
  '西兰花': { energy: 33, protein: 4.1, fat: 0.6, carbs: 4.3, fiber: 1.6, calcium: 67, iron: 1.0, vitaminA: 1202, vitaminC: 51 },
  '菠菜': { energy: 24, protein: 2.6, fat: 0.3, carbs: 4.5, fiber: 1.7, calcium: 66, iron: 2.9, vitaminA: 487, vitaminC: 32 },
  '生菜': { energy: 13, protein: 1.3, fat: 0.3, carbs: 2.1, fiber: 0.7, calcium: 34, iron: 1.2, vitaminA: 298, vitaminC: 13 },
  '油菜': { energy: 23, protein: 1.8, fat: 0.5, carbs: 3.8, fiber: 1.1, calcium: 108, iron: 1.4, vitaminA: 280, vitaminC: 36 },
  '小白菜': { energy: 15, protein: 1.5, fat: 0.3, carbs: 2.7, fiber: 0.6, calcium: 90, iron: 1.9, vitaminA: 280, vitaminC: 28 },
  '芹菜': { energy: 14, protein: 0.8, fat: 0.1, carbs: 3.4, fiber: 1.2, calcium: 48, iron: 0.8, vitaminA: 60, vitaminC: 12 },
  '包菜': { energy: 22, protein: 1.5, fat: 0.2, carbs: 4.6, fiber: 1.0, calcium: 49, iron: 0.6, vitaminA: 12, vitaminC: 40 },
  '洋葱': { energy: 39, protein: 1.1, fat: 0.2, carbs: 9.0, fiber: 0.9, calcium: 24, iron: 0.6, vitaminA: 3, vitaminC: 8 },
  '冬瓜': { energy: 11, protein: 0.4, fat: 0.2, carbs: 2.6, fiber: 0.7, calcium: 19, iron: 0.2, vitaminA: 0, vitaminC: 18 },
  '茄子': { energy: 21, protein: 1.1, fat: 0.2, carbs: 4.9, fiber: 1.3, calcium: 24, iron: 0.5, vitaminA: 8, vitaminC: 5 },
  '西葫芦': { energy: 19, protein: 0.8, fat: 0.2, carbs: 3.8, fiber: 0.6, calcium: 22, iron: 0.4, vitaminA: 53, vitaminC: 7 },
  '黄瓜': { energy: 15, protein: 0.8, fat: 0.2, carbs: 2.9, fiber: 0.5, calcium: 24, iron: 0.5, vitaminA: 15, vitaminC: 9 },
  '南瓜': { energy: 22, protein: 0.7, fat: 0.1, carbs: 5.3, fiber: 0.8, calcium: 16, iron: 0.4, vitaminA: 148, vitaminC: 8 },
  '山药': { energy: 56, protein: 1.9, fat: 0.2, carbs: 12.4, fiber: 0.8, calcium: 16, iron: 0.3, vitaminA: 3, vitaminC: 5 },
  '绿豆芽': { energy: 18, protein: 2.1, fat: 0.1, carbs: 4.0, fiber: 0.8, calcium: 9, iron: 0.6, vitaminA: 3, vitaminC: 6 },
  '黄豆芽': { energy: 47, protein: 4.5, fat: 1.6, carbs: 6.6, fiber: 1.5, calcium: 21, iron: 0.9, vitaminA: 0, vitaminC: 8 },
  '长豆角': { energy: 30, protein: 2.5, fat: 0.2, carbs: 6.7, fiber: 2.1, calcium: 42, iron: 1.0, vitaminA: 57, vitaminC: 14 },
  '韭菜': { energy: 26, protein: 2.4, fat: 0.4, carbs: 4.6, fiber: 1.4, calcium: 42, iron: 1.6, vitaminA: 235, vitaminC: 24 },
  '秋葵': { energy: 37, protein: 2.0, fat: 0.1, carbs: 7.5, fiber: 3.2, calcium: 81, iron: 0.6, vitaminA: 36, vitaminC: 21 },
  '荷兰豆': { energy: 30, protein: 3.0, fat: 0.2, carbs: 5.2, fiber: 2.6, calcium: 43, iron: 1.7, vitaminA: 106, vitaminC: 60 },
  '木耳': { energy: 21, protein: 1.5, fat: 0.2, carbs: 6.5, fiber: 2.6, calcium: 34, iron: 5.5, vitaminA: 17, vitaminC: 0 },
  '香菇': { energy: 26, protein: 2.2, fat: 0.3, carbs: 5.2, fiber: 3.3, calcium: 2, iron: 0.3, vitaminA: 0, vitaminC: 1 },
  '金针菇': { energy: 32, protein: 2.4, fat: 0.4, carbs: 6.0, fiber: 2.7, calcium: 14, iron: 1.1, vitaminA: 0, vitaminC: 2 },
  '青菜': { energy: 15, protein: 1.5, fat: 0.3, carbs: 2.7, fiber: 0.6, calcium: 90, iron: 1.9, vitaminA: 280, vitaminC: 28 },
  
  // ========== 水果类 ==========
  '苹果': { energy: 52, protein: 0.2, fat: 0.2, carbs: 13.5, fiber: 1.2, calcium: 4, iron: 0.6, vitaminA: 3, vitaminC: 4 },
  '香蕉': { energy: 91, protein: 1.4, fat: 0.2, carbs: 22.0, fiber: 1.2, calcium: 7, iron: 0.4, vitaminA: 10, vitaminC: 8 },
  '橙子': { energy: 47, protein: 0.8, fat: 0.2, carbs: 11.1, fiber: 0.6, calcium: 20, iron: 0.4, vitaminA: 27, vitaminC: 33 },
  '火龙果': { energy: 51, protein: 1.1, fat: 0.2, carbs: 13.3, fiber: 1.6, calcium: 6, iron: 0.3, vitaminA: 0, vitaminC: 3 },
  '葡萄': { energy: 43, protein: 0.5, fat: 0.2, carbs: 10.3, fiber: 0.4, calcium: 5, iron: 0.4, vitaminA: 8, vitaminC: 25 },
  '提子': { energy: 45, protein: 0.5, fat: 0.2, carbs: 10.8, fiber: 0.4, calcium: 5, iron: 0.4, vitaminA: 8, vitaminC: 25 },
  '西瓜': { energy: 25, protein: 0.5, fat: 0.1, carbs: 5.8, fiber: 0.3, calcium: 8, iron: 0.3, vitaminA: 75, vitaminC: 6 },
  '哈密瓜': { energy: 34, protein: 0.5, fat: 0.1, carbs: 7.9, fiber: 0.4, calcium: 14, iron: 0.3, vitaminA: 153, vitaminC: 12 },
  '油桃': { energy: 44, protein: 1.3, fat: 0.1, carbs: 10.8, fiber: 1.4, calcium: 6, iron: 0.4, vitaminA: 24, vitaminC: 9 },
  '酥梨': { energy: 44, protein: 0.2, fat: 0.1, carbs: 11.1, fiber: 1.6, calcium: 6, iron: 0.5, vitaminA: 2, vitaminC: 6 },
  '雪梨': { energy: 44, protein: 0.2, fat: 0.1, carbs: 11.1, fiber: 1.6, calcium: 6, iron: 0.5, vitaminA: 2, vitaminC: 6 },
  '红枣': { energy: 264, protein: 3.2, fat: 0.5, carbs: 67.8, fiber: 6.2, calcium: 54, iron: 2.3, vitaminA: 2, vitaminC: 14 },
  
  // ========== 调味品及其他 ==========
  '番茄酱': { energy: 83, protein: 4.9, fat: 0.2, carbs: 16.9, fiber: 1.9, calcium: 26, iron: 1.3, vitaminA: 105, vitaminC: 22 },
  '蚝油': { energy: 80, protein: 2.2, fat: 0.2, carbs: 17.0, fiber: 0, calcium: 40, iron: 1.0, vitaminA: 0, vitaminC: 0 },
  '生抽': { energy: 63, protein: 10.3, fat: 0.0, carbs: 4.9, fiber: 0, calcium: 22, iron: 5.8, vitaminA: 0, vitaminC: 0 },
  '葱': { energy: 30, protein: 1.7, fat: 0.3, carbs: 6.5, fiber: 1.3, calcium: 29, iron: 0.7, vitaminA: 20, vitaminC: 17 },
  '姜': { energy: 41, protein: 1.3, fat: 0.6, carbs: 9.0, fiber: 2.7, calcium: 27, iron: 1.4, vitaminA: 0, vitaminC: 4 },
  '蒜': { energy: 126, protein: 4.5, fat: 0.2, carbs: 27.6, fiber: 1.1, calcium: 39, iron: 1.2, vitaminA: 5, vitaminC: 7 },
  '白糖': { energy: 400, protein: 0, fat: 0, carbs: 99.9, fiber: 0, calcium: 1, iron: 0.2, vitaminA: 0, vitaminC: 0 },
  '红糖': { energy: 389, protein: 0.7, fat: 0, carbs: 96.6, fiber: 0, calcium: 157, iron: 2.2, vitaminA: 0, vitaminC: 0 },
  '花生': { energy: 563, protein: 24.8, fat: 44.3, carbs: 21.7, fiber: 5.5, calcium: 39, iron: 1.5, vitaminA: 0, vitaminC: 0 },
  '核桃': { energy: 627, protein: 14.9, fat: 58.8, carbs: 19.1, fiber: 9.5, calcium: 56, iron: 2.7, vitaminA: 5, vitaminC: 1 },
  '粉条': { energy: 337, protein: 0.5, fat: 0.1, carbs: 84.2, fiber: 0.6, calcium: 35, iron: 5.2, vitaminA: 0, vitaminC: 0 },
  '西米': { energy: 358, protein: 0.2, fat: 0.2, carbs: 88.6, fiber: 0.3, calcium: 7, iron: 0.4, vitaminA: 0, vitaminC: 0 },
  '银耳': { energy: 200, protein: 10.0, fat: 1.4, carbs: 67.3, fiber: 30.4, calcium: 36, iron: 4.1, vitaminA: 0, vitaminC: 0 },
  '莲子': { energy: 350, protein: 17.2, fat: 2.0, carbs: 67.2, fiber: 3.0, calcium: 97, iron: 3.6, vitaminA: 0, vitaminC: 0 },
  '薯条': { energy: 298, protein: 4.3, fat: 15.0, carbs: 37.3, fiber: 3.8, calcium: 19, iron: 1.0, vitaminA: 0, vitaminC: 10 },
  '枸杞': { energy: 258, protein: 13.9, fat: 1.5, carbs: 64.1, fiber: 16.9, calcium: 60, iron: 5.4, vitaminA: 1625, vitaminC: 48 },
  '黑芝麻糊': { energy: 421, protein: 6.0, fat: 14.0, carbs: 68.0, fiber: 4.0, calcium: 200, iron: 8.0, vitaminA: 0, vitaminC: 0 },
  '小汤圆': { energy: 226, protein: 3.2, fat: 1.5, carbs: 50.0, fiber: 0.5, calcium: 10, iron: 0.8, vitaminA: 0, vitaminC: 0 },
  '蛋糕': { energy: 348, protein: 7.4, fat: 15.2, carbs: 46.5, fiber: 0.4, calcium: 50, iron: 1.5, vitaminA: 130, vitaminC: 0 },
};

// 食材别名映射
export const INGREDIENT_ALIASES: Record<string, string> = {
  '五花肉': '五花肉',
  '猪肉': '后腿肉',
  '肉末': '猪肉末',
  '肉沫': '猪肉末',
  '姜丝': '姜',
  '蒜末': '蒜',
  '蒜蓉': '蒜',
  '蒜片': '蒜',
  '大蒜': '蒜',
  '小葱': '葱',
  '大葱': '葱',
  '香葱': '葱',
  '番茄': '西红柿',
  '圣女果': '西红柿',
  '胡萝卜丁': '胡萝卜',
  '青豆': '绿豆',
  '彩椒': '青椒',
  '米饭': '大米',
  '香米': '大米',
  '白米': '大米',
  '青菜': '小白菜',
  '鲜玉米': '玉米',
  '嫩豆腐': '豆腐',
  '筒骨': '排骨',
  '口菇': '香菇',
};

/**
 * 获取食材营养数据
 * @param ingredientName 食材名称
 * @returns 营养数据或默认值
 */
export function getNutrition(ingredientName: string): NutritionPer100g {
  // 先检查原始名称
  if (NUTRITION_DATABASE[ingredientName]) {
    return NUTRITION_DATABASE[ingredientName];
  }
  
  // 检查别名
  const alias = INGREDIENT_ALIASES[ingredientName];
  if (alias && NUTRITION_DATABASE[alias]) {
    return NUTRITION_DATABASE[alias];
  }
  
  // 模糊匹配
  for (const key of Object.keys(NUTRITION_DATABASE)) {
    if (ingredientName.includes(key) || key.includes(ingredientName)) {
      return NUTRITION_DATABASE[key];
    }
  }
  
  // 返回默认值
  return { energy: 50, protein: 2, fat: 1, carbs: 10, fiber: 1, calcium: 20, iron: 0.5, vitaminA: 10, vitaminC: 5 };
}

/**
 * 计算菜品的营养成分
 * @param ingredients 食材列表
 * @returns 营养数据汇总
 */
export function calculateDishNutrition(ingredients: { name: string; perPersonGrams: number }[]): NutritionPer100g {
  const result: NutritionPer100g = {
    energy: 0, protein: 0, fat: 0, carbs: 0, fiber: 0,
    calcium: 0, iron: 0, vitaminA: 0, vitaminC: 0
  };
  
  for (const ing of ingredients) {
    const nutrition = getNutrition(ing.name);
    const ratio = ing.perPersonGrams / 100;
    
    result.energy += nutrition.energy * ratio;
    result.protein += nutrition.protein * ratio;
    result.fat += nutrition.fat * ratio;
    result.carbs += nutrition.carbs * ratio;
    result.fiber += nutrition.fiber * ratio;
    result.calcium += nutrition.calcium * ratio;
    result.iron += nutrition.iron * ratio;
    result.vitaminA += nutrition.vitaminA * ratio;
    result.vitaminC += nutrition.vitaminC * ratio;
  }
  
  // 四舍五入到小数点后一位
  for (const key of Object.keys(result) as (keyof NutritionPer100g)[]) {
    result[key] = Math.round(result[key] * 10) / 10;
  }
  
  return result;
}

/**
 * 幼儿每日营养推荐摄入量 (3-6岁)
 * 参考：中国居民膳食营养素参考摄入量（2023版）
 */
export const DAILY_RECOMMENDED_INTAKE = {
  energy: { min: 1200, max: 1400, unit: 'kcal', label: '能量' },
  protein: { min: 35, max: 45, unit: 'g', label: '蛋白质' },
  fat: { min: 35, max: 55, unit: 'g', label: '脂肪' },
  carbs: { min: 150, max: 200, unit: 'g', label: '碳水化合物' },
  calcium: { min: 600, max: 800, unit: 'mg', label: '钙' },
  iron: { min: 9, max: 12, unit: 'mg', label: '铁' },
  vitaminA: { min: 310, max: 500, unit: 'μg', label: '维生素A' },
  vitaminC: { min: 40, max: 60, unit: 'mg', label: '维生素C' },
};

/**
 * 营养补充建议食材库
 * 根据《中国学龄前儿童膳食指南》和《托幼机构儿童营养膳食标准》
 * 每种营养素对应的高含量、适合幼儿的食材
 */
export interface NutritionSuggestion {
  name: string;           // 食材名称
  amount: number;         // 建议添加量(g)
  benefit: string;        // 营养说明
  addTo: string;          // 建议添加到哪餐
  nutritionPer100g: number; // 每100g该营养素含量
}

export const NUTRITION_SUPPLEMENTS: Record<string, NutritionSuggestion[]> = {
  // 能量不足时的补充建议
  energy: [
    { name: '燕麦', amount: 20, benefit: '富含碳水化合物和膳食纤维，能量密度高', addTo: '早餐粥', nutritionPer100g: 377 },
    { name: '花生', amount: 10, benefit: '优质植物脂肪，能量丰富', addTo: '午点', nutritionPer100g: 563 },
    { name: '核桃', amount: 10, benefit: '富含不饱和脂肪酸，促进大脑发育', addTo: '午点', nutritionPer100g: 627 },
    { name: '香蕉', amount: 50, benefit: '天然糖分，快速补充能量', addTo: '加餐水果', nutritionPer100g: 91 },
    { name: '红薯', amount: 50, benefit: '优质碳水，富含膳食纤维', addTo: '午餐主食', nutritionPer100g: 99 },
  ],
  
  // 蛋白质不足时的补充建议
  protein: [
    { name: '鸡蛋', amount: 50, benefit: '完全蛋白质，氨基酸比例最佳', addTo: '早餐', nutritionPer100g: 13.3 },
    { name: '牛奶', amount: 100, benefit: '优质蛋白+钙，双重补充', addTo: '加餐', nutritionPer100g: 3.0 },
    { name: '豆腐', amount: 50, benefit: '优质植物蛋白，易消化', addTo: '午餐副菜', nutritionPer100g: 8.1 },
    { name: '鸡胸肉', amount: 30, benefit: '高蛋白低脂肪，易吸收', addTo: '午餐主菜', nutritionPer100g: 19.4 },
    { name: '虾仁', amount: 30, benefit: '优质蛋白，富含锌', addTo: '午餐主菜', nutritionPer100g: 20.4 },
    { name: '鹌鹑蛋', amount: 30, benefit: '营养密度高，蛋白质丰富', addTo: '早餐', nutritionPer100g: 12.8 },
  ],
  
  // 脂肪不足时的补充建议
  fat: [
    { name: '核桃', amount: 15, benefit: 'DHA前体，促进大脑发育', addTo: '午点', nutritionPer100g: 58.8 },
    { name: '花生', amount: 15, benefit: '单不饱和脂肪酸，有益心血管', addTo: '午点', nutritionPer100g: 44.3 },
    { name: '芝麻', amount: 10, benefit: '富含亚油酸，促进生长', addTo: '早餐糕点', nutritionPer100g: 46.1 },
    { name: '牛油果', amount: 30, benefit: '优质脂肪，富含维生素E', addTo: '加餐', nutritionPer100g: 15.3 },
    { name: '奶酪', amount: 20, benefit: '乳脂+钙，营养浓缩', addTo: '午点', nutritionPer100g: 23.5 },
  ],
  
  // 碳水化合物不足时的补充建议
  carbs: [
    { name: '大米', amount: 30, benefit: '主食基础，易消化吸收', addTo: '午餐主食', nutritionPer100g: 77.2 },
    { name: '红薯', amount: 50, benefit: '复合碳水，血糖平稳', addTo: '午餐/午点', nutritionPer100g: 23.1 },
    { name: '玉米', amount: 50, benefit: '粗粮碳水，富含膳食纤维', addTo: '午点', nutritionPer100g: 22.8 },
    { name: '南瓜', amount: 50, benefit: '天然甜味，富含β胡萝卜素', addTo: '早餐粥', nutritionPer100g: 5.3 },
    { name: '面条', amount: 40, benefit: '易消化，适合幼儿', addTo: '晚餐', nutritionPer100g: 64.3 },
  ],
  
  // 钙不足时的补充建议（重点）
  calcium: [
    { name: '牛奶', amount: 150, benefit: '钙吸收率最高的天然来源', addTo: '加餐', nutritionPer100g: 104 },
    { name: '酸奶', amount: 100, benefit: '发酵奶，钙+益生菌', addTo: '午点', nutritionPer100g: 118 },
    { name: '奶酪', amount: 20, benefit: '浓缩乳钙，含量极高', addTo: '午点', nutritionPer100g: 590 },
    { name: '豆腐', amount: 50, benefit: '植物钙源，易吸收', addTo: '午餐', nutritionPer100g: 164 },
    { name: '虾皮', amount: 5, benefit: '钙密度最高，少量即可', addTo: '蛋羹/汤', nutritionPer100g: 991 },
    { name: '芝麻酱', amount: 10, benefit: '钙含量极高，可拌菜', addTo: '午餐副菜', nutritionPer100g: 870 },
    { name: '小白菜', amount: 50, benefit: '蔬菜中钙含量较高', addTo: '午餐副菜', nutritionPer100g: 90 },
  ],
  
  // 铁不足时的补充建议
  iron: [
    { name: '猪肝', amount: 25, benefit: '血红素铁，吸收率最高', addTo: '午餐（每周1-2次）', nutritionPer100g: 22.6 },
    { name: '鸡肝', amount: 30, benefit: '富含铁和维生素A', addTo: '午餐', nutritionPer100g: 12.0 },
    { name: '牛肉', amount: 30, benefit: '血红素铁+优质蛋白', addTo: '午餐主菜', nutritionPer100g: 2.8 },
    { name: '鸭血', amount: 30, benefit: '铁含量极高，易吸收', addTo: '午餐汤', nutritionPer100g: 30.5 },
    { name: '黑木耳', amount: 10, benefit: '植物铁王，配VC更好吸收', addTo: '午餐副菜', nutritionPer100g: 97.4 },
    { name: '菠菜', amount: 50, benefit: '富含铁和叶酸', addTo: '午餐副菜', nutritionPer100g: 2.9 },
    { name: '红枣', amount: 10, benefit: '补铁养血，适合煮粥', addTo: '早餐粥', nutritionPer100g: 2.3 },
  ],
  
  // 维生素A不足时的补充建议
  vitaminA: [
    { name: '胡萝卜', amount: 50, benefit: 'β胡萝卜素最丰富', addTo: '午餐', nutritionPer100g: 688 },
    { name: '鸡肝', amount: 25, benefit: '维生素A含量极高', addTo: '午餐', nutritionPer100g: 10414 },
    { name: '南瓜', amount: 50, benefit: '富含胡萝卜素，味甜', addTo: '早餐/午点', nutritionPer100g: 148 },
    { name: '菠菜', amount: 50, benefit: '深绿叶菜，VA丰富', addTo: '午餐副菜', nutritionPer100g: 487 },
    { name: '芒果', amount: 50, benefit: '水果中VA含量最高', addTo: '加餐水果', nutritionPer100g: 150 },
    { name: '鸡蛋黄', amount: 15, benefit: '蛋黄富含VA和卵磷脂', addTo: '早餐', nutritionPer100g: 438 },
  ],
  
  // 维生素C不足时的补充建议
  vitaminC: [
    { name: '橙子', amount: 80, benefit: 'VC含量高，促进铁吸收', addTo: '加餐水果', nutritionPer100g: 33 },
    { name: '猕猴桃', amount: 50, benefit: 'VC之王，营养密度高', addTo: '加餐水果', nutritionPer100g: 62 },
    { name: '草莓', amount: 50, benefit: 'VC丰富，口感好', addTo: '加餐水果', nutritionPer100g: 47 },
    { name: '西兰花', amount: 50, benefit: '蔬菜VC冠军，抗氧化', addTo: '午餐副菜', nutritionPer100g: 51 },
    { name: '青椒', amount: 30, benefit: 'VC含量高，可炒菜', addTo: '午餐', nutritionPer100g: 72 },
    { name: '番茄', amount: 50, benefit: 'VC+番茄红素，双重抗氧化', addTo: '午餐', nutritionPer100g: 19 },
    { name: '柚子', amount: 80, benefit: 'VC丰富，清热润肺', addTo: '加餐水果', nutritionPer100g: 23 },
  ],
};

/**
 * 根据当前营养状态获取补充建议
 * @param currentNutrition 当前营养数据
 * @returns 需要补充的营养素及对应建议
 */
export function getNutritionSuggestions(currentNutrition: {
  totalEnergy?: number;
  totalProtein?: number;
  totalFat?: number;
  totalCarbs?: number;
  totalCalcium?: number;
  totalIron?: number;
}): { nutrient: string; label: string; current: number; recommended: number; suggestions: NutritionSuggestion[] }[] {
  const results: { nutrient: string; label: string; current: number; recommended: number; suggestions: NutritionSuggestion[] }[] = [];
  
  const checks = [
    { key: 'energy', value: currentNutrition.totalEnergy, rec: DAILY_RECOMMENDED_INTAKE.energy },
    { key: 'protein', value: currentNutrition.totalProtein, rec: DAILY_RECOMMENDED_INTAKE.protein },
    { key: 'fat', value: currentNutrition.totalFat, rec: DAILY_RECOMMENDED_INTAKE.fat },
    { key: 'carbs', value: currentNutrition.totalCarbs, rec: DAILY_RECOMMENDED_INTAKE.carbs },
    { key: 'calcium', value: currentNutrition.totalCalcium, rec: DAILY_RECOMMENDED_INTAKE.calcium },
    { key: 'iron', value: currentNutrition.totalIron, rec: DAILY_RECOMMENDED_INTAKE.iron },
  ];
  
  for (const check of checks) {
    if (check.value !== undefined && check.value < check.rec.min * 0.9) {
      // 营养素低于推荐值90%时给出建议
      results.push({
        nutrient: check.key,
        label: check.rec.label,
        current: check.value,
        recommended: check.rec.min,
        suggestions: NUTRITION_SUPPLEMENTS[check.key] || []
      });
    }
  }
  
  return results;
}

