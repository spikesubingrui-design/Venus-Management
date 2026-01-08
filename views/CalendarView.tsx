import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2,
  Sun, Moon, Star, Gift, Flag, Users, Music, Camera, Megaphone, Heart,
  BookOpen, Award, PartyPopper, TreePine, Sparkles, Clock, MapPin, Bell,
  Check, Filter, Download, Upload, Search
} from 'lucide-react';
import { User } from '../types';
import { auditCreate, auditUpdate, auditDelete } from '../services/auditService';
import { EditHistoryButton } from '../components/EditHistoryPanel';

interface CalendarViewProps {
  user: User;
}

// 活动类型定义
type EventType = 
  | 'holiday'      // 节假日
  | 'activity'     // 校园活动
  | 'meeting'      // 家长会
  | 'sports'       // 运动会
  | 'performance'  // 演出/表演
  | 'festival'     // 节日活动
  | 'inspection'   // 检查/评估
  | 'training'     // 培训
  | 'birthday'     // 生日会
  | 'fieldtrip'    // 外出活动
  | 'other';       // 其他

// 活动接口
interface CalendarEvent {
  id: string;
  title: string;
  date: string;           // YYYY-MM-DD
  endDate?: string;       // 多日活动结束日期
  type: EventType;
  description?: string;
  location?: string;
  time?: string;          // HH:MM
  participants?: string[];  // 参与班级
  reminder?: boolean;
  isHoliday?: boolean;    // 是否为法定节假日
  isWorkday?: boolean;    // 是否为调休工作日
  color?: string;
}

// 2026年中国法定节假日数据（河南濮阳适用）
const HOLIDAYS_2026: CalendarEvent[] = [
  // 元旦
  { id: 'h1', title: '元旦', date: '2026-01-01', type: 'holiday', isHoliday: true, description: '元旦假期', color: '#ef4444' },
  
  // 春节 (2026年2月17日是除夕，春节假期2月17日-23日)
  { id: 'h2', title: '除夕', date: '2026-02-16', type: 'holiday', isHoliday: true, description: '除夕夜，阖家团圆', color: '#ef4444' },
  { id: 'h3', title: '春节', date: '2026-02-17', endDate: '2026-02-23', type: 'holiday', isHoliday: true, description: '春节假期（初一至初七）', color: '#ef4444' },
  { id: 'h3a', title: '春节调休上班', date: '2026-02-14', type: 'holiday', isWorkday: true, description: '春节调休，正常上班', color: '#f97316' },
  { id: 'h3b', title: '春节调休上班', date: '2026-02-28', type: 'holiday', isWorkday: true, description: '春节调休，正常上班', color: '#f97316' },
  
  // 清明节 (2026年4月4日-6日)
  { id: 'h4', title: '清明节', date: '2026-04-04', endDate: '2026-04-06', type: 'holiday', isHoliday: true, description: '清明节假期', color: '#22c55e' },
  
  // 劳动节 (2026年5月1日-5日)
  { id: 'h5', title: '劳动节', date: '2026-05-01', endDate: '2026-05-05', type: 'holiday', isHoliday: true, description: '五一劳动节假期', color: '#ef4444' },
  { id: 'h5a', title: '劳动节调休上班', date: '2026-04-26', type: 'holiday', isWorkday: true, description: '劳动节调休，正常上班', color: '#f97316' },
  
  // 端午节 (2026年5月31日-6月2日)
  { id: 'h6', title: '端午节', date: '2026-05-31', endDate: '2026-06-02', type: 'holiday', isHoliday: true, description: '端午节假期', color: '#22c55e' },
  
  // 中秋节 (2026年9月25日-27日)
  { id: 'h7', title: '中秋节', date: '2026-09-25', endDate: '2026-09-27', type: 'holiday', isHoliday: true, description: '中秋节假期', color: '#f59e0b' },
  
  // 国庆节 (2026年10月1日-7日)
  { id: 'h8', title: '国庆节', date: '2026-10-01', endDate: '2026-10-07', type: 'holiday', isHoliday: true, description: '国庆节假期', color: '#ef4444' },
  { id: 'h8a', title: '国庆调休上班', date: '2026-09-27', type: 'holiday', isWorkday: true, description: '国庆调休，正常上班', color: '#f97316' },
  { id: 'h8b', title: '国庆调休上班', date: '2026-10-10', type: 'holiday', isWorkday: true, description: '国庆调休，正常上班', color: '#f97316' },
  
  // 传统节日（非法定假日但重要）
  { id: 't1', title: '元宵节', date: '2026-03-02', type: 'festival', description: '正月十五元宵节', color: '#ec4899' },
  { id: 't2', title: '植树节', date: '2026-03-12', type: 'festival', description: '植树节，环保教育日', color: '#22c55e' },
  { id: 't3', title: '妇女节', date: '2026-03-08', type: 'festival', description: '国际妇女节', color: '#ec4899' },
  { id: 't4', title: '儿童节', date: '2026-06-01', type: 'festival', description: '国际儿童节', color: '#8b5cf6' },
  { id: 't5', title: '教师节', date: '2026-09-10', type: 'festival', description: '教师节', color: '#3b82f6' },
  { id: 't6', title: '重阳节', date: '2026-10-18', type: 'festival', description: '九九重阳节，敬老活动', color: '#f59e0b' },
  { id: 't7', title: '腊八节', date: '2026-01-27', type: 'festival', description: '腊八节，喝腊八粥', color: '#8b5cf6' },
  
  // 特殊日子
  { id: 's1', title: '世界读书日', date: '2026-04-23', type: 'activity', description: '世界读书日，阅读活动', color: '#3b82f6' },
  { id: 's2', title: '世界地球日', date: '2026-04-22', type: 'activity', description: '世界地球日，环保教育', color: '#22c55e' },
  { id: 's3', title: '全国爱眼日', date: '2026-06-06', type: 'activity', description: '全国爱眼日，视力保护', color: '#06b6d4' },
  { id: 's4', title: '全国爱牙日', date: '2026-09-20', type: 'activity', description: '全国爱牙日，口腔健康', color: '#06b6d4' },
];

// 活动类型配置
const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  holiday: { label: '节假日', icon: <Sun className="w-4 h-4" />, color: '#ef4444', bgColor: 'bg-red-100' },
  activity: { label: '校园活动', icon: <Star className="w-4 h-4" />, color: '#3b82f6', bgColor: 'bg-blue-100' },
  meeting: { label: '家长会', icon: <Users className="w-4 h-4" />, color: '#8b5cf6', bgColor: 'bg-purple-100' },
  sports: { label: '运动会', icon: <Award className="w-4 h-4" />, color: '#22c55e', bgColor: 'bg-green-100' },
  performance: { label: '演出/表演', icon: <Music className="w-4 h-4" />, color: '#ec4899', bgColor: 'bg-pink-100' },
  festival: { label: '节日活动', icon: <PartyPopper className="w-4 h-4" />, color: '#f59e0b', bgColor: 'bg-amber-100' },
  inspection: { label: '检查/评估', icon: <Flag className="w-4 h-4" />, color: '#6366f1', bgColor: 'bg-indigo-100' },
  training: { label: '培训', icon: <BookOpen className="w-4 h-4" />, color: '#14b8a6', bgColor: 'bg-teal-100' },
  birthday: { label: '生日会', icon: <Gift className="w-4 h-4" />, color: '#f43f5e', bgColor: 'bg-rose-100' },
  fieldtrip: { label: '外出活动', icon: <TreePine className="w-4 h-4" />, color: '#84cc16', bgColor: 'bg-lime-100' },
  other: { label: '其他', icon: <Sparkles className="w-4 h-4" />, color: '#64748b', bgColor: 'bg-slate-100' },
};

// 班级列表
const CLASS_LIST = [
  '书田中一', '书田中二', '悦芽一班', '星语大一', '星语大二',
  '花开小一', '花开小二', '花开小三', '全园'
];

const CalendarView: React.FC<CalendarViewProps> = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 新活动表单
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: '',
    date: '',
    type: 'activity',
    description: '',
    location: '',
    time: '',
    participants: [],
    reminder: true,
  });

  // 加载数据
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = () => {
    const saved = localStorage.getItem('kt_calendar_events');
    if (saved) {
      const customEvents = JSON.parse(saved);
      setEvents([...HOLIDAYS_2026, ...customEvents]);
    } else {
      setEvents(HOLIDAYS_2026);
    }
  };

  const saveEvents = (newEvents: CalendarEvent[]) => {
    // 只保存自定义活动，不保存节假日
    const customEvents = newEvents.filter(e => !e.id.startsWith('h') && !e.id.startsWith('t') && !e.id.startsWith('s'));
    localStorage.setItem('kt_calendar_events', JSON.stringify(customEvents));
    setEvents([...HOLIDAYS_2026, ...customEvents]);
  };

  // 获取当月天数
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday
    
    return { daysInMonth, startingDay, year, month };
  };

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentDate);

  // 获取某日期的所有活动
  const getEventsForDate = (dateStr: string) => {
    return events.filter(event => {
      if (event.date === dateStr) return true;
      if (event.endDate) {
        const start = new Date(event.date);
        const end = new Date(event.endDate);
        const current = new Date(dateStr);
        return current >= start && current <= end;
      }
      return false;
    }).filter(event => {
      if (filterType === 'all') return true;
      return event.type === filterType;
    }).filter(event => {
      if (!searchTerm) return true;
      return event.title.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  // 判断是否为周末
  const isWeekend = (day: number) => {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  // 判断是否为今天
  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  // 格式化日期
  const formatDate = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // 月份导航
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 添加/编辑活动
  const handleSaveEvent = () => {
    if (!newEvent.title || !newEvent.date) return;

    const eventToSave: CalendarEvent = {
      id: editingEvent?.id || `evt_${Date.now()}`,
      title: newEvent.title!,
      date: newEvent.date!,
      endDate: newEvent.endDate,
      type: newEvent.type as EventType,
      description: newEvent.description,
      location: newEvent.location,
      time: newEvent.time,
      participants: newEvent.participants,
      reminder: newEvent.reminder,
      color: EVENT_TYPE_CONFIG[newEvent.type as EventType].color,
    };

    let updatedEvents: CalendarEvent[];
    if (editingEvent) {
      updatedEvents = events.map(e => e.id === editingEvent.id ? eventToSave : e);
      // 记录修改审计日志
      auditUpdate('校园日历', 'calendarEvent', editingEvent, eventToSave);
    } else {
      updatedEvents = [...events, eventToSave];
      // 记录新增审计日志
      auditCreate('校园日历', 'calendarEvent', eventToSave);
    }

    saveEvents(updatedEvents);
    resetForm();
  };

  const handleDeleteEvent = (eventId: string) => {
    if (window.confirm('确定要删除这个活动吗？')) {
      const deletedEvent = events.find(e => e.id === eventId);
      const updatedEvents = events.filter(e => e.id !== eventId);
      saveEvents(updatedEvents);
      
      // 记录删除审计日志
      if (deletedEvent) {
        auditDelete('校园日历', 'calendarEvent', deletedEvent);
      }
    }
  };

  const resetForm = () => {
    setNewEvent({
      title: '',
      date: selectedDate || '',
      type: 'activity',
      description: '',
      location: '',
      time: '',
      participants: [],
      reminder: true,
    });
    setEditingEvent(null);
    setShowEventModal(false);
  };

  const openAddModal = (date?: string) => {
    setNewEvent({
      ...newEvent,
      date: date || selectedDate || formatDate(new Date().getDate()),
    });
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setNewEvent({ ...event });
    setEditingEvent(event);
    setShowEventModal(true);
  };

  // 导出日历
  const exportCalendar = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      school: '金星第十七幼儿园',
      location: '河南濮阳',
      events: events.filter(e => !e.id.startsWith('h') && !e.id.startsWith('t') && !e.id.startsWith('s')),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `校园日历_${year}年${month + 1}月.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 选中日期的活动
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // 农历月份
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 生成日历格子
  const calendarCells = useMemo(() => {
    const cells = [];
    
    // 上月的天数
    const prevMonthDays = startingDay;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevMonthYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        dateStr: `${prevMonthYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(daysInPrevMonth - i).padStart(2, '0')}`,
      });
    }
    
    // 本月的天数
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        day,
        isCurrentMonth: true,
        dateStr: formatDate(day),
      });
    }
    
    // 下月的天数（补齐到42格，即6行）
    const remainingCells = 42 - cells.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextMonthYear = month === 11 ? year + 1 : year;
      cells.push({
        day,
        isCurrentMonth: false,
        dateStr: `${nextMonthYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    }
    
    return cells;
  }, [year, month, daysInMonth, startingDay]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-orange-500" />
            校园日历
          </h1>
          <p className="text-gray-500 mt-1">金星第十七幼儿园 · 河南濮阳 · {year}年{month + 1}月</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCalendar}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出日历
          </button>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加活动
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EventType | 'all')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">全部类型</option>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索活动..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              今天
            </button>
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-2 text-sm rounded-l-lg transition-colors ${viewMode === 'month' ? 'bg-orange-500 text-white' : 'hover:bg-gray-50'}`}
              >
                月
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-2 text-sm rounded-r-lg transition-colors ${viewMode === 'week' ? 'bg-orange-500 text-white' : 'hover:bg-gray-50'}`}
              >
                周
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 日历主体 */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* 月份导航 */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800">
              {year}年 {monthNames[month]}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 星期标题 */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={`text-center py-2 text-sm font-medium ${
                  index === 0 || index === 6 ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日历格子 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, index) => {
              const dayEvents = getEventsForDate(cell.dateStr);
              const hasHoliday = dayEvents.some(e => e.isHoliday);
              const hasWorkday = dayEvents.some(e => e.isWorkday);
              const isTodayCell = cell.isCurrentMonth && isToday(cell.day);
              const isWeekendCell = cell.isCurrentMonth && isWeekend(cell.day);
              const isSelected = selectedDate === cell.dateStr;
              
              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`
                    min-h-[100px] p-2 border rounded-lg cursor-pointer transition-all
                    ${!cell.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                    ${isSelected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-100 hover:border-orange-300'}
                    ${isTodayCell ? 'bg-orange-50' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`
                      text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                      ${isTodayCell ? 'bg-orange-500 text-white' : ''}
                      ${isWeekendCell && !isTodayCell ? 'text-red-500' : ''}
                      ${hasHoliday && !isTodayCell ? 'text-red-600 font-bold' : ''}
                      ${hasWorkday && !isTodayCell ? 'text-orange-600' : ''}
                    `}>
                      {cell.day}
                    </span>
                    {hasHoliday && <span className="text-xs text-red-500">休</span>}
                    {hasWorkday && <span className="text-xs text-orange-500">班</span>}
                  </div>
                  
                  {/* 活动标签 */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event, i) => (
                      <div
                        key={event.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate"
                        style={{ backgroundColor: `${event.color || '#3b82f6'}20`, color: event.color || '#3b82f6' }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500 pl-1">
                        +{dayEvents.length - 3}更多
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 侧边栏 - 选中日期详情 */}
        <div className="space-y-4">
          {/* 图例 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              图例说明
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-red-500 rounded text-white text-xs flex items-center justify-center">休</span>
                <span className="text-gray-600">法定节假日</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-orange-500 rounded text-white text-xs flex items-center justify-center">班</span>
                <span className="text-gray-600">调休上班</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-200"></span>
                <span className="text-red-500">周末</span>
              </div>
            </div>
          </div>

          {/* 选中日期的活动 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">
                {selectedDate ? (
                  <>
                    {new Date(selectedDate).getMonth() + 1}月{new Date(selectedDate).getDate()}日
                  </>
                ) : '选择日期查看'}
              </h3>
              {selectedDate && (
                <button
                  onClick={() => openAddModal(selectedDate)}
                  className="text-orange-500 hover:text-orange-600 p-1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {selectedDate ? (
              selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map(event => {
                    const config = EVENT_TYPE_CONFIG[event.type];
                    const isSystemEvent = event.id.startsWith('h') || event.id.startsWith('t') || event.id.startsWith('s');
                    
                    return (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg ${config.bgColor} border border-gray-100`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span style={{ color: config.color }}>{config.icon}</span>
                            <span className="font-medium text-gray-800">{event.title}</span>
                          </div>
                          {!isSystemEvent && (
                            <div className="flex items-center gap-1">
                              <EditHistoryButton entityId={event.id} entityName={event.title} size="sm" />
                              <button
                                onClick={() => openEditModal(event)}
                                className="p-1 text-gray-400 hover:text-blue-500"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
                            {config.label}
                          </span>
                          {event.time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {event.time}
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </div>
                          )}
                          {event.description && (
                            <p className="text-gray-500">{event.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>暂无活动</p>
                  <button
                    onClick={() => openAddModal(selectedDate)}
                    className="mt-2 text-orange-500 text-sm hover:underline"
                  >
                    添加活动
                  </button>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-gray-400">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>点击日期查看详情</p>
              </div>
            )}
          </div>

          {/* 即将到来的活动 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-500" />
              近期活动
            </h3>
            <div className="space-y-2">
              {events
                .filter(e => new Date(e.date) >= new Date())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 5)
                .map(event => {
                  const config = EVENT_TYPE_CONFIG[event.type];
                  const date = new Date(event.date);
                  return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedDate(event.date)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="text-center min-w-[40px]">
                        <div className="text-xs text-gray-500">{date.getMonth() + 1}月</div>
                        <div className="text-lg font-bold" style={{ color: config.color }}>{date.getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">{event.title}</div>
                        <div className="text-xs text-gray-500">{config.label}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* 添加/编辑活动弹窗 */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">
                {editingEvent ? '编辑活动' : '添加活动'}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  活动名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newEvent.title || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="例如：春季家长会"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    开始日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newEvent.date || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                  <input
                    type="date"
                    value={newEvent.endDate || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活动类型</label>
                  <select
                    value={newEvent.type || 'activity'}
                    onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as EventType })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活动时间</label>
                  <input
                    type="time"
                    value={newEvent.time || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">活动地点</label>
                <input
                  type="text"
                  value={newEvent.location || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="例如：幼儿园多功能厅"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">参与班级</label>
                <div className="flex flex-wrap gap-2">
                  {CLASS_LIST.map(cls => (
                    <label
                      key={cls}
                      className={`
                        flex items-center gap-1 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                        ${newEvent.participants?.includes(cls)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                      `}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={newEvent.participants?.includes(cls) || false}
                        onChange={(e) => {
                          const current = newEvent.participants || [];
                          if (e.target.checked) {
                            setNewEvent({ ...newEvent, participants: [...current, cls] });
                          } else {
                            setNewEvent({ ...newEvent, participants: current.filter(c => c !== cls) });
                          }
                        }}
                      />
                      {cls}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">活动描述</label>
                <textarea
                  value={newEvent.description || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="活动详细说明..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reminder"
                  checked={newEvent.reminder || false}
                  onChange={(e) => setNewEvent({ ...newEvent, reminder: e.target.checked })}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="reminder" className="text-sm text-gray-600">
                  活动前一天发送提醒
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEvent}
                disabled={!newEvent.title || !newEvent.date}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingEvent ? '保存修改' : '添加活动'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;

