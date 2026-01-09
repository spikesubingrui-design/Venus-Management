
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, Sparkles, Loader2, CheckCircle2,
  History, Save, ChevronRight, Trash2, Calendar, Scale, 
  Apple, Flame, Beef, Wheat, Milk, Info, Plus, Lightbulb, AlertTriangle,
  BarChart3, Building2, Users, TrendingUp, Lock, Upload, Edit
} from 'lucide-react';
import { generateWeeklyRecipe } from '../services/geminiService';
import { WeeklyRecipeRecord, CampusGrade, DailyRecipe, MealDish, CAMPUS_CONFIG, User } from '../types';
import { DAILY_RECOMMENDED_INTAKE, getNutritionSuggestions, NutritionSuggestion } from '../services/nutritionDatabase';
import { hasPermission } from '../services/permissionService';
import { logOperation, STORAGE_KEYS, saveData, getData } from '../services/storageService';
import ConfirmUploadModal, { UploadSuccessToast } from '../components/ConfirmUploadModal';

// 各园区食谱缓存
interface CampusRecords {
  PHUI?: WeeklyRecipeRecord;
  HIGH_END?: WeeklyRecipeRecord;
  JIU_YOU?: WeeklyRecipeRecord;
  SHIQI_YOU?: WeeklyRecipeRecord;
}

interface KitchenViewProps {
  currentUser: User;
}

const KitchenView: React.FC<KitchenViewProps> = ({ currentUser }) => {
  // 权限检查
  const canCreate = hasPermission(currentUser.role, 'kitchen.create');
  const canEdit = hasPermission(currentUser.role, 'kitchen.edit');
  const canConfirm = hasPermission(currentUser.role, 'kitchen.confirm');
  const [loading, setLoading] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<WeeklyRecipeRecord | null>(null);
  const [history, setHistory] = useState<WeeklyRecipeRecord[]>([]);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'PLANNER' | 'HISTORY' | 'STATS'>('PLANNER');
  const [headcount, setHeadcount] = useState(128);
  const [grade, setGrade] = useState<CampusGrade>('PHUI');
  const [showNutrition, setShowNutrition] = useState(true);
  
  // 各园区食谱记录（用于总园统计）
  const [campusRecords, setCampusRecords] = useState<CampusRecords>({});
  
  // 确认上传弹窗状态
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'CONFIRM' | 'DELETE' | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 历史记录详情查看与编辑
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<WeeklyRecipeRecord | null>(null);
  const [historyDetailDayIdx, setHistoryDetailDayIdx] = useState(0);
  const [isEditingHistory, setIsEditingHistory] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('kt_kitchen_history_v2');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedStudents = localStorage.getItem('kt_students_local');
    if (savedStudents) {
      const count = JSON.parse(savedStudents).length;
      if (count > 0) setHeadcount(count);
    }
    
    // 加载各园区已保存的食谱
    const savedCampusRecords = localStorage.getItem('kt_campus_records');
    if (savedCampusRecords) setCampusRecords(JSON.parse(savedCampusRecords));
  }, []);
  
  // 保存当前食谱到对应园区
  useEffect(() => {
    if (currentRecord && currentRecord.status === 'CONFIRMED') {
      const updated = { ...campusRecords, [currentRecord.grade]: currentRecord };
      setCampusRecords(updated);
      localStorage.setItem('kt_campus_records', JSON.stringify(updated));
    }
  }, [currentRecord?.status]);

  const handleCreateNewWeek = async () => {
    setLoading(true);
    setActiveDayIdx(0);
    try {
      const record = await generateWeeklyRecipe(grade, headcount);
      setCurrentRecord(record);
      setViewMode('PLANNER');
    } catch (err) {
      console.error("KitchenView Error:", err);
      alert("生成失败，请检查网络或稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const updateDishName = (dayIdx: number, mealKey: string, subKey: string | null, value: string) => {
    if (!currentRecord?.days?.[dayIdx]) return;
    const newDays = [...currentRecord.days];
    const day = newDays[dayIdx];
    try {
      if (subKey) {
        (day.meals as any)[mealKey][subKey].dishName = value;
      } else {
        (day.meals as any)[mealKey].dishName = value;
      }
      setCurrentRecord({ ...currentRecord, days: newDays });
    } catch (e) { console.warn("Update dish name failed", e); }
  };

  const updateIngredientGrams = (dayIdx: number, mealKey: string, subKey: string | null, ingIdx: number, grams: number) => {
    if (!currentRecord?.days?.[dayIdx]) return;
    const newDays = [...currentRecord.days];
    try {
      let dish: any;
      if (subKey) {
        dish = (newDays[dayIdx].meals as any)[mealKey][subKey];
      } else {
        dish = (newDays[dayIdx].meals as any)[mealKey];
      }
      if (dish?.ingredients?.[ingIdx]) {
        dish.ingredients[ingIdx].perPersonGrams = grams;
        setCurrentRecord({ ...currentRecord, days: newDays });
      }
    } catch (e) { console.warn("Update grams failed", e); }
  };

  // 历史记录编辑功能
  const updateHistoryDishName = (dayIdx: number, mealKey: string, subKey: string | null, value: string) => {
    if (!selectedHistoryRecord?.days?.[dayIdx]) return;
    const newDays = [...selectedHistoryRecord.days];
    const day = newDays[dayIdx];
    try {
      if (subKey) {
        (day.meals as any)[mealKey][subKey].dishName = value;
      } else {
        (day.meals as any)[mealKey].dishName = value;
      }
      setSelectedHistoryRecord({ ...selectedHistoryRecord, days: newDays });
    } catch (e) { console.warn("Update history dish name failed", e); }
  };

  const updateHistoryIngredientGrams = (dayIdx: number, mealKey: string, subKey: string | null, ingIdx: number, grams: number) => {
    if (!selectedHistoryRecord?.days?.[dayIdx]) return;
    const newDays = [...selectedHistoryRecord.days];
    try {
      let dish: any;
      if (subKey) {
        dish = (newDays[dayIdx].meals as any)[mealKey][subKey];
      } else {
        dish = (newDays[dayIdx].meals as any)[mealKey];
      }
      if (dish?.ingredients?.[ingIdx]) {
        dish.ingredients[ingIdx].perPersonGrams = grams;
        setSelectedHistoryRecord({ ...selectedHistoryRecord, days: newDays });
      }
    } catch (e) { console.warn("Update history grams failed", e); }
  };

  // 保存历史记录编辑
  const saveHistoryEdit = () => {
    if (!selectedHistoryRecord) return;
    
    const updatedHistory = history.map(h => 
      h.id === selectedHistoryRecord.id ? selectedHistoryRecord : h
    );
    setHistory(updatedHistory);
    localStorage.setItem('kt_kitchen_history_v2', JSON.stringify(updatedHistory));
    setIsEditingHistory(false);
    alert('食谱修改已保存！');
  };

  // 点击确认按钮 - 显示确认弹窗
  const handleConfirmRecord = () => {
    if (!currentRecord) return;
    setPendingAction('CONFIRM');
    setShowConfirmModal(true);
  };
  
  // 实际执行确认上传
  const executeConfirmRecord = () => {
    if (!currentRecord) return;
    const confirmed: WeeklyRecipeRecord = { ...currentRecord, status: 'CONFIRMED', createdAt: new Date().toISOString() };
    const newHistory = [confirmed, ...history];
    setHistory(newHistory);
    localStorage.setItem('kt_kitchen_history_v2', JSON.stringify(newHistory));
    
    // 记录操作日志
    logOperation(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'CONFIRM',
      'kitchen',
      '周食谱',
      confirmed.id,
      `${CAMPUS_CONFIG[confirmed.grade].name} ${confirmed.weekRange}`,
      `确认并上传${CAMPUS_CONFIG[confirmed.grade].name}周食谱`,
      null,
      { grade: confirmed.grade, weekRange: confirmed.weekRange, headcount: confirmed.headcount }
    );
    
    setCurrentRecord(null);
    setShowConfirmModal(false);
    setPendingAction(null);
    setSuccessMessage('食谱已确认上传，数据已电子留存');
    setShowSuccessToast(true);
  };

  const getWeeklyProcurementSummary = () => {
    if (!currentRecord?.days) return [];
    const summaryMap = new Map<string, number>();
    
    currentRecord.days.forEach(day => {
      if (!day?.meals) return;
      const allDishes: (MealDish | undefined)[] = [
        day.meals.breakfast,
        day.meals.morningFruitSnack,
        day.meals.morningSnack,
        day.meals.lunch?.mainDish,
        day.meals.lunch?.sideDish,
        day.meals.lunch?.soup,
        day.meals.lunch?.staple,
        day.meals.milkSnack,
        day.meals.afternoonSnack,
        day.meals.dinner
      ];

      allDishes.forEach(dish => {
        dish?.ingredients?.forEach(ing => {
          if (!ing.name) return;
          const currentTotal = summaryMap.get(ing.name) || 0;
          const dailyTotalKg = (ing.perPersonGrams * currentRecord.headcount) / 1000;
          summaryMap.set(ing.name, currentTotal + dailyTotalKg);
        });
      });
    });

    return Array.from(summaryMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  };

  const renderDish = (label: string, dish: MealDish | undefined, mealKey: string, subKey: string | null, icon?: React.ReactNode) => {
    if (!dish || !dish.dishName || dish.dishName === '待定') return null;
    return (
      <div className="bg-slate-50 p-5 rounded-[2rem] border border-transparent hover:border-amber-200 transition-all">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <input 
              value={dish.dishName || ""}
              onChange={(e) => updateDishName(activeDayIdx, mealKey, subKey, e.target.value)}
              className="bg-transparent border-none text-slate-800 font-black focus:ring-0 p-0 text-sm w-full"
            />
          </div>
          {icon || <Utensils className="w-4 h-4 text-slate-300" />}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {(dish.ingredients || []).map((ing, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-600">{ing.name || "未知食材"}</span>
              <div className="flex items-center gap-1 border-l border-slate-100 pl-2">
                <input 
                  type="number"
                  value={ing.perPersonGrams || 0}
                  onChange={(e) => updateIngredientGrams(activeDayIdx, mealKey, subKey, idx, Number(e.target.value))}
                  className="w-8 bg-transparent text-xs font-black text-amber-600 outline-none text-right"
                />
                <span className="text-[10px] text-slate-400 font-bold">g</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 营养评估状态
  const getNutritionStatus = (value: number, min: number, max: number) => {
    if (value < min * 0.8) return { color: 'text-red-500', bg: 'bg-red-50', status: '偏低' };
    if (value > max * 1.2) return { color: 'text-orange-500', bg: 'bg-orange-50', status: '偏高' };
    return { color: 'text-emerald-600', bg: 'bg-emerald-50', status: '达标' };
  };

  const activeDay = currentRecord?.days?.[activeDayIdx];

  // 获取营养补充建议
  const nutritionSuggestions = useMemo(() => {
    if (!activeDay?.dailyNutrition) return [];
    return getNutritionSuggestions(activeDay.dailyNutrition);
  }, [activeDay?.dailyNutrition]);

  // 添加建议食材到食谱
  const addSuggestionToRecipe = (suggestion: NutritionSuggestion) => {
    if (!currentRecord || !activeDay) return;
    
    const newDays = [...currentRecord.days];
    const dayMeals = newDays[activeDayIdx].meals;
    
    // 根据建议的添加位置选择目标餐次
    let targetMealKey = 'morningSnack';
    if (suggestion.addTo.includes('早餐')) targetMealKey = 'breakfast';
    else if (suggestion.addTo.includes('午餐主菜')) targetMealKey = 'lunch';
    else if (suggestion.addTo.includes('午餐副菜')) targetMealKey = 'lunch';
    else if (suggestion.addTo.includes('午餐')) targetMealKey = 'lunch';
    else if (suggestion.addTo.includes('午点')) targetMealKey = 'afternoonSnack';
    else if (suggestion.addTo.includes('加餐')) targetMealKey = 'morningSnack';
    else if (suggestion.addTo.includes('晚餐')) targetMealKey = 'dinner';
    
    // 添加食材
    const newIngredient = { name: suggestion.name, perPersonGrams: suggestion.amount };
    
    if (targetMealKey === 'lunch') {
      // 添加到午餐副菜
      if (dayMeals.lunch?.sideDish) {
        dayMeals.lunch.sideDish.ingredients.push(newIngredient);
      }
    } else {
      const meal = (dayMeals as any)[targetMealKey];
      if (meal?.ingredients) {
        meal.ingredients.push(newIngredient);
      }
    }
    
    setCurrentRecord({ ...currentRecord, days: newDays });
    
    // 提示用户
    alert(`已将 ${suggestion.name} ${suggestion.amount}g 添加到${activeDay.day}的${suggestion.addTo}中`);
  };
  const isHighEndCampus = grade !== 'PHUI';
  const campusName = CAMPUS_CONFIG[grade]?.name || '普惠园';

  return (
    <div className="space-y-6 pb-24">
      {/* 顶部控制栏 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 font-brand">精细化配餐与采购</h1>
          <div className="flex items-center gap-4 mt-2">
            <button onClick={() => setViewMode('PLANNER')} className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${viewMode === 'PLANNER' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>配餐规划</button>
            <button onClick={() => setViewMode('HISTORY')} className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${viewMode === 'HISTORY' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>历史存档</button>
            <button onClick={() => setViewMode('STATS')} className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-1 ${viewMode === 'STATS' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>
              <BarChart3 className="w-3 h-3" />总园统计
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">幼儿人数: {headcount}</span>
            <select 
              value={grade} 
              onChange={(e) => setGrade(e.target.value as CampusGrade)} 
              className="text-xs font-bold text-amber-600 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="PHUI">普惠园</option>
              <option value="HIGH_END">高端园</option>
              <option value="JIU_YOU">九幼</option>
              <option value="SHIQI_YOU">十七幼</option>
            </select>
          </div>
          {canCreate ? (
            <button onClick={handleCreateNewWeek} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-[2rem] font-bold flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-amber-400" />}
              AI 生成{campusName}周食谱
            </button>
          ) : (
            <div className="bg-slate-200 text-slate-500 px-6 py-3 rounded-[2rem] font-bold flex items-center gap-3">
              <Lock className="w-5 h-5" />
              无编辑权限（仅可查看）
            </div>
          )}
        </div>
      </div>

      {/* 园区特色提示 */}
      {isHighEndCampus && (
        <div className="bg-gradient-to-r from-purple-50 to-amber-50 p-4 rounded-2xl border border-purple-100 flex items-center gap-3">
          <Info className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold text-purple-700">{campusName}特色：</span>
            <span className="text-purple-600 ml-2">
              {CAMPUS_CONFIG[grade]?.features.join(' · ')}
            </span>
          </div>
        </div>
      )}

      {viewMode === 'PLANNER' ? (
        currentRecord && activeDay ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in duration-500">
            {/* 左侧：食谱详情 */}
            <div className="xl:col-span-7 space-y-4">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                {/* 星期选择 */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex gap-2">
                    {currentRecord.days.map((d, i) => (
                      <button key={i} onClick={() => setActiveDayIdx(i)} className={`w-11 h-11 rounded-xl font-black text-sm transition-all ${activeDayIdx === i ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                        {d.day ? d.day.replace('周','') : i+1}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      grade === 'PHUI' ? 'bg-blue-50 text-blue-600' :
                      grade === 'HIGH_END' ? 'bg-purple-50 text-purple-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {campusName}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* 早餐 */}
                  {renderDish('元气早餐', activeDay.meals?.breakfast, 'breakfast', null, <Wheat className="w-4 h-4 text-amber-400" />)}
                  
                  {/* 早餐后水果加餐（高端园/九幼/十七幼） */}
                  {isHighEndCampus && activeDay.meals?.morningFruitSnack && (
                    renderDish('水果加餐', activeDay.meals?.morningFruitSnack, 'morningFruitSnack', null, <Apple className="w-4 h-4 text-red-400" />)
                  )}
                  
                  {/* 早点 */}
                  {renderDish('早点水果', activeDay.meals?.morningSnack, 'morningSnack', null, <Apple className="w-4 h-4 text-green-400" />)}
                  
                  {/* 午餐 */}
                  <div className="p-1 border-2 border-dashed border-slate-100 rounded-[2rem] space-y-2">
                    <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] py-2">正式午餐组合</p>
                    {renderDish('午餐-主菜', activeDay.meals?.lunch?.mainDish, 'lunch', 'mainDish', <Beef className="w-4 h-4 text-rose-400" />)}
                    {renderDish('午餐-副菜', activeDay.meals?.lunch?.sideDish, 'lunch', 'sideDish')}
                    {renderDish('午餐-汤品', activeDay.meals?.lunch?.soup, 'lunch', 'soup')}
                    {renderDish('午餐-主食', activeDay.meals?.lunch?.staple, 'lunch', 'staple', <Wheat className="w-4 h-4 text-amber-400" />)}
                  </div>

                  {/* 牛奶加餐 */}
                  {renderDish('牛奶加餐', activeDay.meals?.milkSnack, 'milkSnack', null, <Milk className="w-4 h-4 text-slate-400" />)}
                  
                  {/* 午后点心 */}
                  {renderDish('午后点心', activeDay.meals?.afternoonSnack, 'afternoonSnack', null)}
                  
                  {/* 晚餐 */}
                  {renderDish('营养晚餐', activeDay.meals?.dinner, 'dinner', null)}
                </div>
              </div>

              {/* 每日营养卡片 */}
              {showNutrition && activeDay.dailyNutrition && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-[2rem] border border-emerald-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-black text-emerald-800 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      {activeDay.day}营养分析
                    </h4>
                    <button onClick={() => setShowNutrition(false)} className="text-xs text-emerald-500 hover:underline">收起</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '能量', value: activeDay.dailyNutrition.totalEnergy, unit: 'kcal', rec: DAILY_RECOMMENDED_INTAKE.energy },
                      { label: '蛋白质', value: activeDay.dailyNutrition.totalProtein, unit: 'g', rec: DAILY_RECOMMENDED_INTAKE.protein },
                      { label: '碳水', value: activeDay.dailyNutrition.totalCarbs, unit: 'g', rec: DAILY_RECOMMENDED_INTAKE.carbs },
                      { label: '脂肪', value: activeDay.dailyNutrition.totalFat, unit: 'g', rec: DAILY_RECOMMENDED_INTAKE.fat },
                      { label: '钙', value: activeDay.dailyNutrition.totalCalcium, unit: 'mg', rec: DAILY_RECOMMENDED_INTAKE.calcium },
                      { label: '铁', value: activeDay.dailyNutrition.totalIron, unit: 'mg', rec: DAILY_RECOMMENDED_INTAKE.iron },
                    ].map((item, idx) => {
                      const status = getNutritionStatus(item.value, item.rec.min, item.rec.max);
                      return (
                        <div key={idx} className={`${status.bg} p-3 rounded-xl`}>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{item.label}</p>
                          <p className={`font-black text-lg ${status.color}`}>
                            {item.value}<span className="text-xs font-normal ml-1">{item.unit}</span>
                          </p>
                          <p className="text-[9px] text-slate-400">
                            推荐: {item.rec.min}-{item.rec.max} · <span className={status.color}>{status.status}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!showNutrition && (
                <button onClick={() => setShowNutrition(true)} className="w-full py-3 text-sm text-emerald-600 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-all">
                  📊 展开营养分析
                </button>
              )}

              {/* 营养补充建议卡片 */}
              {showNutrition && nutritionSuggestions.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-[2rem] border border-amber-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    <h4 className="font-black text-amber-800">营养补充建议</h4>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                      参照《中国学龄前儿童膳食指南》
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {nutritionSuggestions.map((item, idx) => (
                      <div key={idx} className="bg-white/80 p-4 rounded-2xl">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <span className="font-bold text-orange-700">{item.label}偏低</span>
                          <span className="text-xs text-slate-500">
                            当前 {item.current.toFixed(1)} / 推荐 {item.recommended}+
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.suggestions.slice(0, 4).map((suggestion, sIdx) => (
                            <div 
                              key={sIdx} 
                              className="flex items-center justify-between bg-amber-50 hover:bg-amber-100 p-3 rounded-xl transition-all group cursor-pointer"
                              onClick={() => addSuggestionToRecipe(suggestion)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-amber-900">{suggestion.name}</span>
                                  <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                                    {suggestion.amount}g
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {suggestion.benefit}
                                </p>
                                <p className="text-[9px] text-amber-600 mt-0.5">
                                  👉 {suggestion.addTo}
                                </p>
                              </div>
                              <button 
                                className="ml-2 w-8 h-8 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-amber-600 hover:text-white"
                                title="添加到食谱"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        
                        {item.suggestions.length > 4 && (
                          <p className="text-xs text-amber-600 mt-2 text-center">
                            还有 {item.suggestions.length - 4} 种可选食材...
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-[10px] text-amber-600 mt-4 text-center italic">
                    💡 点击食材卡片可一键添加到当天食谱
                  </p>
                </div>
              )}

              {/* 营养达标提示 */}
              {showNutrition && nutritionSuggestions.length === 0 && activeDay?.dailyNutrition && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-2xl border border-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-700">🎉 {activeDay.day}营养配比达标</p>
                    <p className="text-xs text-emerald-600">当天食谱已满足幼儿基本营养需求</p>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：采购汇总 */}
            <div className="xl:col-span-5">
              <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-2xl sticky top-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black font-brand text-amber-400">全周集采汇总</h3>
                    <p className="text-slate-400 text-xs mt-1">{campusName} · {headcount}人 · 实时计算</p>
                  </div>
                  <button onClick={handleConfirmRecord} className="bg-amber-600 text-white p-2.5 rounded-xl shadow-lg hover:bg-amber-700 transition-all active:scale-95">
                    <Save className="w-4 h-4" />
                  </button>
                </div>

                {/* 周营养汇总 */}
                {currentRecord.nutritionSummary && (
                  <div className="mb-6 p-4 bg-white/5 rounded-2xl grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[10px] text-white/50 uppercase">日均能量</p>
                      <p className="text-amber-400 font-black">{currentRecord.nutritionSummary.avgEnergy}<span className="text-xs text-white/40"> kcal</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-white/50 uppercase">日均蛋白</p>
                      <p className="text-amber-400 font-black">{currentRecord.nutritionSummary.avgProtein}<span className="text-xs text-white/40"> g</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-white/50 uppercase">食材种类</p>
                      <p className="text-amber-400 font-black">{currentRecord.nutritionSummary.varietyCount}<span className="text-xs text-white/40"> 种</span></p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {getWeeklyProcurementSummary().slice(0, 20).map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/5 px-2 rounded-lg transition-colors">
                      <div>
                        <p className="font-bold text-sm text-white">{item.name}</p>
                        <p className="text-[9px] text-white/30 uppercase tracking-widest">周采购量</p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-black text-lg">{item.total.toFixed(2)} <span className="text-xs text-white/40">kg</span></p>
                      </div>
                    </div>
                  ))}
                  {getWeeklyProcurementSummary().length > 20 && (
                    <p className="text-center text-white/30 text-xs py-2">还有 {getWeeklyProcurementSummary().length - 20} 种食材...</p>
                  )}
                  {getWeeklyProcurementSummary().length === 0 && (
                    <p className="text-slate-500 text-center py-10 italic">暂无汇总数据</p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                   <button onClick={handleConfirmRecord} className="w-full bg-amber-600 text-white font-black py-3 rounded-xl shadow-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2">
                     <CheckCircle2 className="w-5 h-5" /> 确认并发布食谱
                   </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
             <Scale className="w-16 h-16 text-slate-200 mx-auto mb-6" />
             <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">选择园区后点击生成</h2>
             <p className="text-slate-300 text-sm mt-2 max-w-md mx-auto">AI 将根据【{campusName}】标准自动规划全周食谱及营养配比</p>
             <div className="mt-6 flex justify-center gap-4 flex-wrap">
               {Object.entries(CAMPUS_CONFIG).map(([key, config]) => (
                 <button 
                   key={key}
                   onClick={() => setGrade(key as CampusGrade)}
                   className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                     grade === key 
                       ? 'bg-amber-600 text-white shadow-lg' 
                       : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                   }`}
                 >
                   {config.name}
                 </button>
               ))}
             </div>
          </div>
        )
      ) : viewMode === 'HISTORY' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {history.length === 0 ? (
            <div className="col-span-full py-32 text-center">
              <History className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold">暂无存档记录</p>
            </div>
          ) : (
            history.map((rec) => (
              <div 
                key={rec.id} 
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer"
                onClick={() => { setSelectedHistoryRecord(rec); setHistoryDetailDayIdx(0); }}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    rec.grade === 'PHUI' ? 'bg-blue-100 text-blue-700' :
                    rec.grade === 'HIGH_END' ? 'bg-purple-100 text-purple-700' :
                    rec.grade === 'JIU_YOU' ? 'bg-amber-100 text-amber-700' :
                    'bg-teal-100 text-teal-700'
                  }`}>
                    {CAMPUS_CONFIG[rec.grade]?.name || rec.grade}
                  </span>
                  <button onClick={(e) => {
                     e.stopPropagation();
                     const updated = history.filter(h => h.id !== rec.id);
                     setHistory(updated);
                     localStorage.setItem('kt_kitchen_history_v2', JSON.stringify(updated));
                  }} className="text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <h4 className="text-lg font-black text-slate-800 font-brand">{rec.weekRange || '周食谱存档'}</h4>
                <div className="mt-3 flex items-center gap-2 text-slate-400 text-xs font-bold">
                  <Calendar className="w-4 h-4" /> {new Date(rec.createdAt).toLocaleDateString()}
                </div>
                {rec.nutritionSummary && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-400">日均能量:</span>
                      <span className="font-bold text-slate-700 ml-1">{rec.nutritionSummary.avgEnergy} kcal</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-400">蛋白质:</span>
                      <span className="font-bold text-slate-700 ml-1">{rec.nutritionSummary.avgProtein} g</span>
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                   <div>
                      <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">覆盖人数</p>
                      <p className="text-lg font-black text-slate-700">{rec.headcount} 人</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-amber-600 group-hover:text-white transition-all">
                     <ChevronRight className="w-5 h-5" />
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* 总园统计视图 */
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* 统计概览 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(CAMPUS_CONFIG).map(([key, config]) => {
              const record = campusRecords[key as CampusGrade];
              const hasData = !!record;
              return (
                <div key={key} className={`p-6 rounded-[2rem] border transition-all ${
                  hasData 
                    ? 'bg-gradient-to-br from-white to-slate-50 border-slate-100 shadow-sm' 
                    : 'bg-slate-50 border-dashed border-slate-200'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      key === 'PHUI' ? 'bg-blue-100 text-blue-600' :
                      key === 'HIGH_END' ? 'bg-purple-100 text-purple-600' :
                      key === 'JIU_YOU' ? 'bg-amber-100 text-amber-600' :
                      'bg-teal-100 text-teal-600'
                    }`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">{config.name}</h3>
                      <p className="text-xs text-slate-400">
                        {hasData ? `${record.headcount}人 · 已生成` : '未生成食谱'}
                      </p>
                    </div>
                  </div>
                  
                  {hasData && record.nutritionSummary ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">日均能量</span>
                        <span className="font-bold text-slate-700">{record.nutritionSummary.avgEnergy} kcal</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">日均蛋白</span>
                        <span className="font-bold text-slate-700">{record.nutritionSummary.avgProtein} g</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">食材种类</span>
                        <span className="font-bold text-slate-700">{record.nutritionSummary.varietyCount} 种</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <button 
                        onClick={() => { setGrade(key as CampusGrade); setViewMode('PLANNER'); }}
                        className="text-sm text-amber-600 font-bold hover:underline"
                      >
                        点击生成 →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 汇总统计卡片 */}
          {Object.keys(campusRecords).length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 全园营养汇总 */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-[2rem] border border-purple-100">
                <h3 className="font-black text-purple-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> 全园营养数据汇总
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    const records = Object.values(campusRecords).filter(Boolean) as WeeklyRecipeRecord[];
                    if (records.length === 0) return null;
                    
                    const totalHeadcount = records.reduce((sum, r) => sum + r.headcount, 0);
                    const avgEnergy = Math.round(records.reduce((sum, r) => sum + (r.nutritionSummary?.avgEnergy || 0), 0) / records.length);
                    const avgProtein = Math.round(records.reduce((sum, r) => sum + (r.nutritionSummary?.avgProtein || 0), 0) / records.length * 10) / 10;
                    const totalVariety = new Set(records.flatMap(r => 
                      r.days.flatMap(d => {
                        const ings: string[] = [];
                        const addIngs = (dish: MealDish | undefined) => {
                          if (dish?.ingredients) ings.push(...dish.ingredients.map(i => i.name));
                        };
                        addIngs(d.meals.breakfast);
                        addIngs(d.meals.morningSnack);
                        addIngs(d.meals.lunch?.mainDish);
                        addIngs(d.meals.lunch?.sideDish);
                        addIngs(d.meals.lunch?.soup);
                        addIngs(d.meals.lunch?.staple);
                        addIngs(d.meals.afternoonSnack);
                        addIngs(d.meals.dinner);
                        return ings;
                      })
                    )).size;
                    
                    return (
                      <>
                        <div className="bg-white/60 p-4 rounded-2xl">
                          <p className="text-xs text-purple-600 font-bold">覆盖园区</p>
                          <p className="text-2xl font-black text-purple-800">{records.length}<span className="text-sm font-normal ml-1">个</span></p>
                        </div>
                        <div className="bg-white/60 p-4 rounded-2xl">
                          <p className="text-xs text-purple-600 font-bold">总用餐人数</p>
                          <p className="text-2xl font-black text-purple-800">{totalHeadcount}<span className="text-sm font-normal ml-1">人</span></p>
                        </div>
                        <div className="bg-white/60 p-4 rounded-2xl">
                          <p className="text-xs text-purple-600 font-bold">平均日能量</p>
                          <p className="text-2xl font-black text-purple-800">{avgEnergy}<span className="text-sm font-normal ml-1">kcal</span></p>
                        </div>
                        <div className="bg-white/60 p-4 rounded-2xl">
                          <p className="text-xs text-purple-600 font-bold">平均日蛋白</p>
                          <p className="text-2xl font-black text-purple-800">{avgProtein}<span className="text-sm font-normal ml-1">g</span></p>
                        </div>
                        <div className="bg-white/60 p-4 rounded-2xl col-span-2">
                          <p className="text-xs text-purple-600 font-bold">全园食材种类</p>
                          <p className="text-2xl font-black text-purple-800">{totalVariety}<span className="text-sm font-normal ml-1">种</span></p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 全园采购汇总 */}
              <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                <h3 className="font-black text-amber-400 mb-4 flex items-center gap-2">
                  <Scale className="w-5 h-5" /> 全园周采购汇总
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {(() => {
                    const records = Object.values(campusRecords).filter(Boolean) as WeeklyRecipeRecord[];
                    if (records.length === 0) return <p className="text-slate-500 text-center py-4">暂无数据</p>;
                    
                    // 汇总所有园区的食材
                    const totals: Record<string, number> = {};
                    
                    records.forEach(record => {
                      record.days.forEach(day => {
                        const addIngredients = (dish: MealDish | undefined) => {
                          if (!dish?.ingredients) return;
                          dish.ingredients.forEach(ing => {
                            const total = (ing.perPersonGrams * record.headcount) / 1000;
                            totals[ing.name] = (totals[ing.name] || 0) + total;
                          });
                        };
                        
                        addIngredients(day.meals.breakfast);
                        addIngredients(day.meals.morningFruitSnack);
                        addIngredients(day.meals.morningSnack);
                        addIngredients(day.meals.lunch?.mainDish);
                        addIngredients(day.meals.lunch?.sideDish);
                        addIngredients(day.meals.lunch?.soup);
                        addIngredients(day.meals.lunch?.staple);
                        addIngredients(day.meals.milkSnack);
                        addIngredients(day.meals.afternoonSnack);
                        addIngredients(day.meals.dinner);
                      });
                    });
                    
                    const sorted = Object.entries(totals)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 15);
                    
                    return sorted.map(([name, total], i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-white font-bold">{name}</span>
                        <span className="text-amber-400 font-black">{total.toFixed(2)} <span className="text-white/40 text-xs">kg</span></span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* 各园区对比表格 */}
          {Object.keys(campusRecords).length > 1 && (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-400" /> 各园区营养对比
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-4 font-black text-slate-400 uppercase text-xs">园区</th>
                      <th className="text-center py-3 px-4 font-black text-slate-400 uppercase text-xs">人数</th>
                      <th className="text-center py-3 px-4 font-black text-slate-400 uppercase text-xs">日均能量</th>
                      <th className="text-center py-3 px-4 font-black text-slate-400 uppercase text-xs">日均蛋白</th>
                      <th className="text-center py-3 px-4 font-black text-slate-400 uppercase text-xs">食材种类</th>
                      <th className="text-center py-3 px-4 font-black text-slate-400 uppercase text-xs">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(CAMPUS_CONFIG).map(([key, config]) => {
                      const record = campusRecords[key as CampusGrade];
                      return (
                        <tr key={key} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              key === 'PHUI' ? 'bg-blue-100 text-blue-700' :
                              key === 'HIGH_END' ? 'bg-purple-100 text-purple-700' :
                              key === 'JIU_YOU' ? 'bg-amber-100 text-amber-700' :
                              'bg-teal-100 text-teal-700'
                            }`}>
                              {config.name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {record?.headcount || '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {record?.nutritionSummary?.avgEnergy || '-'} <span className="text-slate-300 text-xs">kcal</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {record?.nutritionSummary?.avgProtein || '-'} <span className="text-slate-300 text-xs">g</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {record?.nutritionSummary?.varietyCount || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {record ? (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">已生成</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-400 px-2 py-1 rounded text-xs font-bold">未生成</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 空状态 */}
          {Object.keys(campusRecords).length === 0 && (
            <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
              <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-6" />
              <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">尚无统计数据</h2>
              <p className="text-slate-300 text-sm mt-2 max-w-md mx-auto">请先为各园区生成并确认食谱，统计数据将自动汇总</p>
              <button 
                onClick={() => setViewMode('PLANNER')} 
                className="mt-6 bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-amber-700"
              >
                前往生成食谱
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* 历史记录详情弹窗 */}
      {selectedHistoryRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${
                  selectedHistoryRecord.grade === 'PHUI' ? 'bg-blue-100' :
                  selectedHistoryRecord.grade === 'HIGH_END' ? 'bg-purple-100' :
                  selectedHistoryRecord.grade === 'JIU_YOU' ? 'bg-amber-100' :
                  'bg-teal-100'
                }`}>
                  <Utensils className={`w-6 h-6 ${
                    selectedHistoryRecord.grade === 'PHUI' ? 'text-blue-600' :
                    selectedHistoryRecord.grade === 'HIGH_END' ? 'text-purple-600' :
                    selectedHistoryRecord.grade === 'JIU_YOU' ? 'text-amber-600' :
                    'text-teal-600'
                  }`} />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-800">
                    {CAMPUS_CONFIG[selectedHistoryRecord.grade]?.name} · {selectedHistoryRecord.weekRange || '周食谱'}
                    {isEditingHistory && <span className="ml-2 text-purple-600 text-sm">📝 编辑中</span>}
                  </h3>
                  <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedHistoryRecord.createdAt).toLocaleDateString()} · {selectedHistoryRecord.headcount}人用餐
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingHistory(!isEditingHistory)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                    isEditingHistory 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Edit className="w-4 h-4" />
                  {isEditingHistory ? '编辑中' : '编辑'}
                </button>
                <button
                  onClick={() => { setSelectedHistoryRecord(null); setIsEditingHistory(false); }}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <span className="text-2xl text-slate-400">×</span>
                </button>
              </div>
            </div>

            {/* 营养汇总 */}
            {selectedHistoryRecord.nutritionSummary && (
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-emerald-600 font-bold">日均能量</p>
                  <p className="text-xl font-black text-emerald-800">{selectedHistoryRecord.nutritionSummary.avgEnergy} <span className="text-sm font-normal">kcal</span></p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-emerald-600 font-bold">日均蛋白</p>
                  <p className="text-xl font-black text-emerald-800">{selectedHistoryRecord.nutritionSummary.avgProtein} <span className="text-sm font-normal">g</span></p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-emerald-600 font-bold">食材种类</p>
                  <p className="text-xl font-black text-emerald-800">{selectedHistoryRecord.nutritionSummary.varietyCount} <span className="text-sm font-normal">种</span></p>
                </div>
              </div>
            )}

            {/* 日期选择 */}
            <div className="px-6 py-4 border-b border-slate-100 flex gap-2">
              {selectedHistoryRecord.days?.map((d, i) => (
                <button 
                  key={i} 
                  onClick={() => setHistoryDetailDayIdx(i)} 
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    historyDetailDayIdx === i 
                      ? 'bg-amber-600 text-white shadow-lg' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {d.day || `第${i+1}天`}
                </button>
              ))}
            </div>

            {/* 食谱详情 */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedHistoryRecord.days?.[historyDetailDayIdx] && (
                <div className="space-y-4">
                  {/* 渲染每餐详情 */}
                  {(() => {
                    const day = selectedHistoryRecord.days[historyDetailDayIdx];
                    const renderMealDetail = (label: string, dish: MealDish | undefined, icon: React.ReactNode, bgColor: string, mealKey: string, subKey: string | null = null) => {
                      if (!dish || !dish.dishName || dish.dishName === '待定') return null;
                      return (
                        <div className={`${bgColor} p-4 rounded-2xl`}>
                          <div className="flex items-center gap-2 mb-2">
                            {icon}
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{label}</span>
                          </div>
                          {isEditingHistory ? (
                            <input
                              value={dish.dishName}
                              onChange={(e) => updateHistoryDishName(historyDetailDayIdx, mealKey, subKey, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 text-lg mb-2 focus:ring-2 focus:ring-purple-400 outline-none"
                            />
                          ) : (
                            <p className="font-bold text-slate-800 text-lg mb-2">{dish.dishName}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {dish.ingredients?.map((ing, idx) => (
                              <span key={idx} className="bg-white px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                                <span className="text-slate-700">{ing.name}</span>
                                {isEditingHistory ? (
                                  <input
                                    type="number"
                                    value={ing.perPersonGrams || 0}
                                    onChange={(e) => updateHistoryIngredientGrams(historyDetailDayIdx, mealKey, subKey, idx, Number(e.target.value))}
                                    className="w-12 bg-amber-50 border border-amber-200 rounded px-1 text-amber-600 font-bold text-center"
                                  />
                                ) : (
                                  <span className="text-amber-600 font-bold ml-1">{ing.perPersonGrams}g</span>
                                )}
                                {!isEditingHistory && <span className="text-slate-400">g</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {renderMealDetail('元气早餐', day.meals?.breakfast, <Wheat className="w-4 h-4 text-amber-500" />, 'bg-amber-50', 'breakfast')}
                        
                        {day.meals?.morningFruitSnack && renderMealDetail('水果加餐', day.meals.morningFruitSnack, <Apple className="w-4 h-4 text-red-400" />, 'bg-red-50', 'morningFruitSnack')}
                        
                        {renderMealDetail('早点水果', day.meals?.morningSnack, <Apple className="w-4 h-4 text-green-500" />, 'bg-green-50', 'morningSnack')}
                        
                        {/* 午餐组合 */}
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 space-y-3">
                          <p className="text-center text-xs font-black text-slate-400 uppercase tracking-widest">正式午餐组合</p>
                          {renderMealDetail('午餐主菜', day.meals?.lunch?.mainDish, <Beef className="w-4 h-4 text-rose-500" />, 'bg-rose-50', 'lunch', 'mainDish')}
                          {renderMealDetail('午餐副菜', day.meals?.lunch?.sideDish, <Utensils className="w-4 h-4 text-slate-400" />, 'bg-slate-50', 'lunch', 'sideDish')}
                          {renderMealDetail('午餐汤品', day.meals?.lunch?.soup, <Utensils className="w-4 h-4 text-blue-400" />, 'bg-blue-50', 'lunch', 'soup')}
                          {renderMealDetail('午餐主食', day.meals?.lunch?.staple, <Wheat className="w-4 h-4 text-amber-400" />, 'bg-amber-50', 'lunch', 'staple')}
                        </div>
                        
                        {renderMealDetail('牛奶加餐', day.meals?.milkSnack, <Milk className="w-4 h-4 text-slate-400" />, 'bg-slate-50', 'milkSnack')}
                        
                        {renderMealDetail('午后点心', day.meals?.afternoonSnack, <Apple className="w-4 h-4 text-orange-400" />, 'bg-orange-50', 'afternoonSnack')}
                        
                        {renderMealDetail('营养晚餐', day.meals?.dinner, <Utensils className="w-4 h-4 text-purple-400" />, 'bg-purple-50', 'dinner')}

                        {/* 当日营养 */}
                        {day.dailyNutrition && (
                          <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl">
                            <h4 className="font-bold text-emerald-700 mb-3 flex items-center gap-2">
                              <Flame className="w-4 h-4 text-orange-500" />
                              {day.day}营养分析
                            </h4>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                              <div className="bg-white/60 p-2 rounded-xl">
                                <p className="text-[10px] text-slate-500">能量</p>
                                <p className="font-bold text-slate-700">{day.dailyNutrition.totalEnergy}<span className="text-[10px] ml-0.5">kcal</span></p>
                              </div>
                              <div className="bg-white/60 p-2 rounded-xl">
                                <p className="text-[10px] text-slate-500">蛋白质</p>
                                <p className="font-bold text-slate-700">{day.dailyNutrition.totalProtein}<span className="text-[10px] ml-0.5">g</span></p>
                              </div>
                              <div className="bg-white/60 p-2 rounded-xl">
                                <p className="text-[10px] text-slate-500">碳水</p>
                                <p className="font-bold text-slate-700">{day.dailyNutrition.totalCarbs}<span className="text-[10px] ml-0.5">g</span></p>
                              </div>
                              <div className="bg-white/60 p-2 rounded-xl">
                                <p className="text-[10px] text-slate-500">脂肪</p>
                                <p className="font-bold text-slate-700">{day.dailyNutrition.totalFat}<span className="text-[10px] ml-0.5">g</span></p>
                              </div>
                              <div className="bg-white/60 p-2 rounded-xl">
                                <p className="text-[10px] text-slate-500">钙</p>
                                <p className="font-bold text-slate-700">{day.dailyNutrition.totalCalcium}<span className="text-[10px] ml-0.5">mg</span></p>
                              </div>
                              <div className="bg-white/60 p-2 rounded-xl">
                                <p className="text-[10px] text-slate-500">铁</p>
                                <p className="font-bold text-slate-700">{day.dailyNutrition.totalIron}<span className="text-[10px] ml-0.5">mg</span></p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* 底部操作 */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => { setSelectedHistoryRecord(null); setIsEditingHistory(false); }}
                className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
              >
                关闭
              </button>
              {isEditingHistory ? (
                <button
                  onClick={saveHistoryEdit}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存修改
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCurrentRecord(selectedHistoryRecord);
                    setSelectedHistoryRecord(null);
                    setViewMode('PLANNER');
                  }}
                  className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  复用此食谱
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 确认上传弹窗 */}
      {showConfirmModal && currentRecord && (
        <ConfirmUploadModal
          isOpen={showConfirmModal}
          onConfirm={executeConfirmRecord}
          onCancel={() => { setShowConfirmModal(false); setPendingAction(null); }}
          title={`${CAMPUS_CONFIG[currentRecord.grade].name} ${currentRecord.weekRange}`}
          type="周食谱"
          summary={`确认上传${CAMPUS_CONFIG[currentRecord.grade].name}的周食谱，数据将电子留存并可追溯`}
          details={[
            { label: '园区', value: CAMPUS_CONFIG[currentRecord.grade].name },
            { label: '周期', value: currentRecord.weekRange },
            { label: '用餐人数', value: `${currentRecord.headcount}人` },
            { label: '天数', value: `${currentRecord.days?.length || 0}天` },
          ]}
          isUpdate={false}
        />
      )}
      
      {/* 成功提示 */}
      {showSuccessToast && (
        <UploadSuccessToast 
          message={successMessage} 
          onClose={() => setShowSuccessToast(false)} 
        />
      )}
    </div>
  );
};

export default KitchenView;
