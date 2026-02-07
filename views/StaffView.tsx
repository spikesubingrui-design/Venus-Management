
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, Calendar, Star, GraduationCap, MoreHorizontal, ChevronRight,
  UserPlus, Trash2, Edit2, Phone, Clock, Users, Search, Filter,
  CalendarDays, CheckCircle2, XCircle, Coffee, Sun, Moon, AlertTriangle,
  Shield, Utensils, Plus, X, User as UserIcon, MapPin, ClipboardList, Lock, Upload
} from 'lucide-react';
import { Teacher, ScheduleRecord, User } from '../types';
import { hasPermission } from '../services/permissionService';
import { logOperation, saveAndSync } from '../services/storageService';
import { auditCreate, auditUpdate, auditDelete } from '../services/auditService';
import { canEditSensitiveFields, getSensitiveFieldsList, filterEditableFields, SENSITIVE_FIELDS, getPermissionSummary } from '../services/fieldPermissionService';
import ConfirmUploadModal, { UploadSuccessToast } from '../components/ConfirmUploadModal';
import { EditHistoryButton } from '../components/EditHistoryPanel';
import { ChineseDatePicker } from '../components/ChineseDatePicker';
import { uploadToAliyun, isAliyunConfigured } from '../services/aliyunOssService';

/**
 * 将网页版教职工数据同步到 kt_staff（OSS格式），确保小程序端可读
 * 同时保存到 kt_teachers（网页格式）
 */
function syncTeachersToOssFormat(webTeachers: Teacher[]): void {
  // 保存网页格式
  saveAndSync('kt_teachers', webTeachers);
  
  // 转换为OSS格式并保存到 kt_staff
  const ossStaff = webTeachers.map((t: any) => ({
    id: t.id,
    name: t.name,
    phone: t.phone || '',
    gender: t._ossGender || '',
    class: t._ossClass || t.assignedClass || '',
    className: t.assignedClass || '',
    position: t._ossPosition || t.role || '',
    campus: t._ossCampus || t.campus || '',
    role: t._ossRole || 'TEACHER',
    assignedClasses: t._ossAssignedClasses || (t.assignedClass ? [t.assignedClass] : []),
    hireDate: t.hireDate || '',
    status: t.status || 'active',
  }));
  saveAndSync('kt_staff', ossStaff);
  
  // 异步上传到云端（带安全检查）
  if (isAliyunConfigured && ossStaff.length >= 3) {
    uploadToAliyun('kt_staff', ossStaff, true).then(success => {
      if (success) {
        console.log(`[StaffView] ✅ kt_staff 已同步到云端: ${ossStaff.length}条`);
      }
    });
  } else if (ossStaff.length < 3) {
    console.warn(`[StaffView] ⚠️ 教职工数据不足(${ossStaff.length}<3)，跳过云端上传`);
  }
}

interface StaffViewProps {
  currentUser: User;
}

// 行政值班记录
interface DutyRecord {
  id: string;
  date: string;
  dutyPerson: string;
  dutyPhone: string;
  shift: 'day' | 'night' | 'full';
  tasks: string[];
  issues?: string;
  handoverNotes?: string;
  status: 'scheduled' | 'completed' | 'in_progress';
  createdAt: string;
}

// 行政陪餐记录
interface MealAccompanyRecord {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'snack';
  accompanier: string;
  className?: string;
  rating: {
    taste: number;      // 口味
    appearance: number; // 外观
    portion: number;    // 份量
    temperature: number; // 温度
    hygiene: number;    // 卫生
  };
  dishes: string[];
  feedback: string;
  suggestions?: string;
  photos?: string[];
  createdAt: string;
}

// 教职工数据从本地存储读取，无默认模拟数据

const SHIFTS = [
  { key: 'morning', label: '早班', icon: Sun, time: '7:30-14:30', color: 'bg-amber-100 text-amber-700' },
  { key: 'afternoon', label: '午班', icon: Moon, time: '14:00-18:30', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'full', label: '全天', icon: Clock, time: '7:30-18:30', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'rest', label: '休息', icon: Coffee, time: '-', color: 'bg-slate-100 text-slate-500' },
];

type ViewMode = 'LIST' | 'SCHEDULE' | 'PERFORMANCE' | 'DUTY' | 'MEAL';

const StaffView: React.FC<StaffViewProps> = ({ currentUser }) => {
  // 权限检查
  const canEdit = hasPermission(currentUser.role, 'staff.edit');
  const canCreate = hasPermission(currentUser.role, 'staff.create');
  const canDelete = hasPermission(currentUser.role, 'staff.delete');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  
  // 行政值班
  const [dutyRecords, setDutyRecords] = useState<DutyRecord[]>([]);
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);
  
  // 行政陪餐
  const [mealRecords, setMealRecords] = useState<MealAccompanyRecord[]>([]);
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  
  // 确认上传相关状态
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState<{ type: 'teacher' | 'delete'; data: any; isUpdate: boolean } | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff)).toISOString().split('T')[0];
  });

  // 去重函数：按 name 组合键去重
  const dedupTeachers = (arr: Teacher[]): Teacher[] => {
    const seen = new Map();
    return arr.filter((t: any) => {
      const key = t.name 
        ? (t.phone ? `${t.name}_${t.phone}` : t.assignedClass ? `${t.name}_${t.assignedClass}` : t.name)
        : t.id;
      if (!key || seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('kt_teachers');
    if (saved) {
      const parsed = JSON.parse(saved);
      const deduped = dedupTeachers(parsed);
      setTeachers(deduped);
      // 如果有重复，清理localStorage
      if (deduped.length !== parsed.length) {
        localStorage.setItem('kt_teachers', JSON.stringify(deduped));
        console.log(`[StaffView] 教职工去重: ${parsed.length} → ${deduped.length}`);
      }
    }
    // 不再预填充模拟数据，初始为空列表
    
    const savedSchedules = localStorage.getItem('kt_schedules');
    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
    
    // 加载行政值班记录
    const savedDuty = localStorage.getItem('kt_duty_records');
    if (savedDuty) setDutyRecords(JSON.parse(savedDuty));
    
    // 加载行政陪餐记录
    const savedMeal = localStorage.getItem('kt_meal_records');
    if (savedMeal) setMealRecords(JSON.parse(savedMeal));
  }, []);

  const saveTeacher = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    if (editingTeacher) {
      // 编辑模式 - 准备数据并显示确认弹窗
      let updatedTeacher: Teacher = {
        ...editingTeacher,
        name: fd.get('name') as string,
        role: fd.get('role') as string,
        phone: fd.get('phone') as string,
        assignedClass: fd.get('assignedClass') as string,
        campus: fd.get('campus') as string,
        education: fd.get('education') as string,
      };
      
      // 敏感字段只有 SUPER_ADMIN 可以修改
      if (canEditSensitiveFields(currentUser.role)) {
        updatedTeacher.hireDate = fd.get('hireDate') as string || editingTeacher.hireDate;
        updatedTeacher.status = (fd.get('status') as 'active' | 'leave' | 'resigned') || editingTeacher.status;
      } else {
        // 非最高权限用户，保持敏感字段不变
        updatedTeacher.hireDate = editingTeacher.hireDate;
        updatedTeacher.status = editingTeacher.status;
      }
      
      setPendingData({ type: 'teacher', data: updatedTeacher, isUpdate: true });
      setShowConfirmModal(true);
    } else {
      // 新增模式 - 准备数据并显示确认弹窗
      const newTeacher: Teacher = {
        id: Date.now().toString(),
        name: fd.get('name') as string,
        role: fd.get('role') as string,
        phone: fd.get('phone') as string,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fd.get('name') as string)}&background=4A90A4&color=fff&size=128&font-size=0.4&bold=true`,
        assignedClass: fd.get('assignedClass') as string,
        performanceScore: 90 + Math.floor(Math.random() * 10),
        campus: fd.get('campus') as string,
        hireDate: fd.get('hireDate') as string || new Date().toISOString().split('T')[0],
        education: fd.get('education') as string,
        status: 'active',
      };
      setPendingData({ type: 'teacher', data: newTeacher, isUpdate: false });
      setShowConfirmModal(true);
    }
  };
  
  // 执行确认上传
  const executeConfirm = () => {
    if (!pendingData) return;
    
    if (pendingData.type === 'teacher') {
      const beforeData = pendingData.isUpdate ? teachers.find(t => t.id === pendingData.data.id) : null;
      
      let updated: Teacher[];
      if (pendingData.isUpdate) {
        updated = teachers.map(t => t.id === pendingData.data.id ? pendingData.data : t);
      } else {
        updated = [pendingData.data, ...teachers];
      }
      setTeachers(updated);
      syncTeachersToOssFormat(updated);
      
      // 记录操作日志（基础日志）
      logOperation(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        pendingData.isUpdate ? 'UPDATE' : 'CREATE',
        'staff',
        '教职工',
        pendingData.data.id,
        pendingData.data.name,
        `${pendingData.isUpdate ? '更新' : '新增'}教职工：${pendingData.data.name}`,
        beforeData,
        pendingData.data
      );
      
      // 记录详细审计日志（字段级修改追踪）
      if (pendingData.isUpdate && beforeData) {
        auditUpdate('教职工管理', 'staff', beforeData, pendingData.data);
      } else {
        auditCreate('教职工管理', 'staff', pendingData.data);
      }
      
      setSuccessMessage(`教职工${pendingData.isUpdate ? '更新' : '录入'}成功，已电子留存`);
    } else if (pendingData.type === 'delete') {
      const deletedTeacher = teachers.find(t => t.id === pendingData.data);
      const updated = teachers.filter(t => t.id !== pendingData.data);
      setTeachers(updated);
      syncTeachersToOssFormat(updated);
      
      // 记录删除日志
      logOperation(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'DELETE',
        'staff',
        '教职工',
        pendingData.data,
        deletedTeacher?.name || '',
        `删除教职工：${deletedTeacher?.name}`,
        deletedTeacher,
        null
      );
      
      // 记录详细审计日志
      if (deletedTeacher) {
        auditDelete('教职工管理', 'staff', deletedTeacher);
      }
      
      setSuccessMessage('教职工已删除，操作已记录');
    }
    
    setShowConfirmModal(false);
    setPendingData(null);
    setIsModalOpen(false);
    setEditingTeacher(null);
    setShowSuccessToast(true);
  };

  const deleteTeacher = (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    setPendingData({ type: 'delete', data: id, isUpdate: false });
    setShowConfirmModal(true);
  };

  const updateSchedule = (teacherId: string, date: string, shift: string) => {
    const existingIdx = schedules.findIndex(s => s.teacherId === teacherId && s.date === date);
    let updated: ScheduleRecord[];
    
    if (existingIdx >= 0) {
      updated = schedules.map((s, idx) => idx === existingIdx ? { ...s, shift: shift as any } : s);
    } else {
      updated = [...schedules, {
        id: Date.now().toString(),
        teacherId,
        date,
        shift: shift as any,
      }];
    }
    
    setSchedules(updated);
    saveAndSync('kt_schedules', updated);
  };

  const getSchedule = (teacherId: string, date: string) => {
    return schedules.find(s => s.teacherId === teacherId && s.date === date);
  };

  const weekDates = useMemo(() => {
    const dates = [];
    const start = new Date(selectedWeekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [selectedWeekStart]);

  const filtered = teachers.filter(t => 
    t.name.includes(search) || t.role.includes(search) || t.assignedClass.includes(search)
  );

  // 统计数据
  const stats = useMemo(() => {
    const activeCount = teachers.filter(t => t.status === 'active').length;
    const avgScore = teachers.length > 0 
      ? (teachers.reduce((sum, t) => sum + t.performanceScore, 0) / teachers.length).toFixed(1) 
      : '0';
    const classCount = new Set(teachers.map(t => t.assignedClass).filter(c => c !== '全园流动')).size;
    return { activeCount, avgScore, classCount };
  }, [teachers]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      {/* 顶部 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 font-brand">教职工管理</h1>
          <p className="text-slate-500 text-sm mt-1">管理教师信息、排班与绩效考核</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditingTeacher(null); setIsModalOpen(true); }} className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-amber-700 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> 添加教职工
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">在职教师</p>
              <p className="text-2xl font-black text-slate-800">{stats.activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Star className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">平均绩效</p>
              <p className="text-2xl font-black text-amber-600">{stats.avgScore}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">管理班级</p>
              <p className="text-2xl font-black text-emerald-600">{stats.classCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">本周排班</p>
              <p className="text-2xl font-black text-purple-600">{schedules.filter(s => weekDates.includes(s.date)).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 视图切换和搜索 */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setViewMode('LIST')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'LIST' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Users className="w-4 h-4 inline mr-1" />教师列表
          </button>
          <button onClick={() => setViewMode('SCHEDULE')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'SCHEDULE' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <CalendarDays className="w-4 h-4 inline mr-1" />排班管理
          </button>
          <button onClick={() => setViewMode('DUTY')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'DUTY' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Shield className="w-4 h-4 inline mr-1" />行政值班
          </button>
          <button onClick={() => setViewMode('MEAL')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'MEAL' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Utensils className="w-4 h-4 inline mr-1" />行政陪餐
          </button>
          <button onClick={() => setViewMode('PERFORMANCE')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'PERFORMANCE' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Award className="w-4 h-4 inline mr-1" />绩效考核
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input placeholder="搜索姓名/角色/班级..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm w-64" />
        </div>
      </div>

      {/* 教师列表视图 */}
      {viewMode === 'LIST' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((teacher) => (
            <div key={teacher.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6 hover:shadow-md transition-shadow group">
              <div className="relative shrink-0">
                <img src={teacher.avatar} className="w-20 h-20 rounded-2xl object-cover shadow-md" alt={teacher.name} />
                <div className={`absolute -bottom-2 -right-2 p-1.5 rounded-lg shadow-sm ${teacher.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'} text-white`}>
                  {teacher.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate">
                    <h3 className="font-black text-slate-800 text-lg truncate">{teacher.name}</h3>
                    <p className="text-amber-600 text-sm font-bold">{teacher.role}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <EditHistoryButton entityId={teacher.id} entityName={teacher.name} size="sm" />
                    <button onClick={() => { setEditingTeacher(teacher); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-blue-500">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteTeacher(teacher.id)} className="p-2 text-slate-300 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg text-slate-500 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    {teacher.performanceScore}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg text-slate-500 text-xs font-bold">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {teacher.assignedClass}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg text-slate-500 text-xs font-bold">
                    <Phone className="w-3.5 h-3.5" />
                    {teacher.phone}
                  </div>
                </div>
                
                {teacher.hireDate && (
                  <p className="mt-2 text-xs text-slate-400">
                    入职日期: {teacher.hireDate}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 排班管理视图 */}
      {viewMode === 'SCHEDULE' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  const d = new Date(selectedWeekStart);
                  d.setDate(d.getDate() - 7);
                  setSelectedWeekStart(d.toISOString().split('T')[0]);
                }}
                className="p-2 hover:bg-white rounded-lg"
              >
                ←
              </button>
              <h3 className="font-black text-slate-800">
                {selectedWeekStart} ~ {weekDates[6]}
              </h3>
              <button 
                onClick={() => {
                  const d = new Date(selectedWeekStart);
                  d.setDate(d.getDate() + 7);
                  setSelectedWeekStart(d.toISOString().split('T')[0]);
                }}
                className="p-2 hover:bg-white rounded-lg"
              >
                →
              </button>
            </div>
            <div className="flex gap-2">
              {SHIFTS.map(s => (
                <span key={s.key} className={`px-2 py-1 rounded text-xs font-bold ${s.color}`}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left font-bold text-slate-500 w-40">教师</th>
                  {weekDates.map((date, i) => {
                    const d = new Date(date);
                    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th key={date} className={`px-2 py-3 text-center font-bold w-24 ${isWeekend ? 'text-rose-500' : 'text-slate-500'}`}>
                        <div>周{dayNames[d.getDay()]}</div>
                        <div className="text-xs font-normal">{d.getDate()}日</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map(teacher => (
                  <tr key={teacher.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img src={teacher.avatar} className="w-8 h-8 rounded-lg" />
                        <div>
                          <p className="font-bold text-slate-800">{teacher.name}</p>
                          <p className="text-xs text-slate-400">{teacher.assignedClass}</p>
                        </div>
                      </div>
                    </td>
                    {weekDates.map(date => {
                      const schedule = getSchedule(teacher.id, date);
                      const shift = SHIFTS.find(s => s.key === schedule?.shift);
                      return (
                        <td key={date} className="px-2 py-2 text-center">
                          <select 
                            value={schedule?.shift || ''}
                            onChange={(e) => updateSchedule(teacher.id, date, e.target.value)}
                            className={`w-full px-2 py-2 rounded-lg text-xs font-bold border-none cursor-pointer ${shift?.color || 'bg-slate-100 text-slate-400'}`}
                          >
                            <option value="">-</option>
                            {SHIFTS.map(s => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 绩效考核视图 */}
      {viewMode === 'PERFORMANCE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filtered.sort((a, b) => b.performanceScore - a.performanceScore).map((teacher, idx) => (
              <div key={teacher.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  {idx < 3 && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black ${
                      idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-amber-700'
                    }`}>
                      {idx + 1}
                    </div>
                  )}
                  <img src={teacher.avatar} className="w-12 h-12 rounded-xl" />
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{teacher.name}</h4>
                    <p className="text-xs text-slate-400">{teacher.role} · {teacher.assignedClass}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-2xl font-black text-amber-600">
                      <Star className="w-5 h-5 fill-current" />
                      {teacher.performanceScore}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {[
                    { label: '教学质量', score: teacher.performanceScore * 20 },
                    { label: '出勤率', score: 95 },
                    { label: '家长满意度', score: teacher.performanceScore * 18 },
                    { label: '团队协作', score: teacher.performanceScore * 19 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-20">{item.label}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-10">{item.score.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 行政值班视图 */}
      {viewMode === 'DUTY' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 px-4 py-2 rounded-xl">
                <span className="text-blue-700 font-bold text-sm">本月值班: {dutyRecords.length}次</span>
              </div>
            </div>
            <button 
              onClick={() => setIsDutyModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />安排值班
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">日期</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">值班人员</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">班次</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">工作事项</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">状态</th>
                </tr>
              </thead>
              <tbody>
                {dutyRecords.map(record => (
                  <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{record.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-700">{record.dutyPerson}</span>
                      </div>
                      <p className="text-xs text-slate-400">{record.dutyPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        record.shift === 'day' ? 'bg-amber-100 text-amber-700' :
                        record.shift === 'night' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {record.shift === 'day' ? '白班 8:00-17:00' :
                         record.shift === 'night' ? '夜班 17:00-次日8:00' : '全天'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {record.tasks.slice(0, 3).map((t, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{t}</span>
                        ))}
                        {record.tasks.length > 3 && <span className="text-xs text-slate-400">+{record.tasks.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        record.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        record.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {record.status === 'completed' ? '已完成' :
                         record.status === 'in_progress' ? '进行中' : '已安排'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dutyRecords.length === 0 && (
              <div className="py-12 text-center">
                <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">暂无值班安排</p>
                <button onClick={() => setIsDutyModalOpen(true)} className="text-blue-600 font-bold mt-2 hover:underline">
                  安排值班
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 行政陪餐视图 */}
      {viewMode === 'MEAL' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 px-4 py-2 rounded-xl">
                <span className="text-orange-700 font-bold text-sm">本月陪餐: {mealRecords.length}次</span>
              </div>
            </div>
            <button 
              onClick={() => setIsMealModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />记录陪餐
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mealRecords.map(record => {
              const avgRating = (record.rating.taste + record.rating.appearance + record.rating.portion + record.rating.temperature + record.rating.hygiene) / 5;
              return (
                <div key={record.id} className="bg-white p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800">{record.date}</h3>
                      <p className="text-xs text-slate-400">{record.accompanier}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      record.mealType === 'breakfast' ? 'bg-amber-100 text-amber-700' :
                      record.mealType === 'lunch' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {record.mealType === 'breakfast' ? '早餐' :
                       record.mealType === 'lunch' ? '午餐' : '点心'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">菜品:</span>
                      <div className="flex flex-wrap gap-1">
                        {record.dishes.map((d, i) => (
                          <span key={i} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">{d}</span>
                        ))}
                      </div>
                    </div>
                    {record.className && (
                      <p className="text-sm text-slate-600"><MapPin className="w-3 h-3 inline mr-1" />{record.className}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {[
                      { label: '口味', value: record.rating.taste },
                      { label: '外观', value: record.rating.appearance },
                      { label: '份量', value: record.rating.portion },
                      { label: '温度', value: record.rating.temperature },
                      { label: '卫生', value: record.rating.hygiene },
                    ].map((item, i) => (
                      <div key={i} className="text-center">
                        <p className="text-xs text-slate-400">{item.label}</p>
                        <p className={`font-bold ${item.value >= 4 ? 'text-emerald-600' : item.value >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">综合评分</span>
                    <span className={`font-black text-lg ${avgRating >= 4 ? 'text-emerald-600' : avgRating >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                      {avgRating.toFixed(1)}
                    </span>
                  </div>
                  
                  {record.feedback && (
                    <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{record.feedback}</p>
                  )}
                </div>
              );
            })}
          </div>
          
          {mealRecords.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <Utensils className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">暂无陪餐记录</p>
              <button onClick={() => setIsMealModalOpen(true)} className="text-orange-600 font-bold mt-2 hover:underline">
                记录陪餐
              </button>
            </div>
          )}
        </div>
      )}

      {/* 行政值班弹窗 */}
      {isDutyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const newRecord: DutyRecord = {
              id: Date.now().toString(),
              date: fd.get('date') as string,
              dutyPerson: fd.get('dutyPerson') as string,
              dutyPhone: fd.get('dutyPhone') as string,
              shift: fd.get('shift') as 'day' | 'night' | 'full',
              tasks: (fd.get('tasks') as string).split(',').map(s => s.trim()).filter(Boolean),
              status: 'scheduled',
              createdAt: new Date().toISOString(),
            };
            const updated = [newRecord, ...dutyRecords];
            setDutyRecords(updated);
            saveAndSync('kt_duty_records', updated);
            setIsDutyModalOpen(false);
          }} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-500" />
              安排行政值班
            </h2>
            
            <div className="space-y-4">
              <input required type="date" name="date" lang="zh-CN" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              
              <select required name="dutyPerson" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                <option value="">值班人员 *</option>
                {teachers.map(t => <option key={t.id} value={t.name}>{t.name} - {t.role}</option>)}
              </select>
              
              <input required name="dutyPhone" placeholder="值班电话 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              
              <select required name="shift" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                <option value="day">白班 (8:00-17:00)</option>
                <option value="night">夜班 (17:00-次日8:00)</option>
                <option value="full">全天值班</option>
              </select>
              
              <input name="tasks" placeholder="工作事项（用逗号分隔，如：巡园,接待来访,安全检查）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsDutyModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">确认安排</button>
            </div>
          </form>
        </div>
      )}

      {/* 行政陪餐弹窗 */}
      {isMealModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const newRecord: MealAccompanyRecord = {
              id: Date.now().toString(),
              date: fd.get('date') as string,
              mealType: fd.get('mealType') as 'breakfast' | 'lunch' | 'snack',
              accompanier: fd.get('accompanier') as string,
              className: fd.get('className') as string,
              rating: {
                taste: parseInt(fd.get('taste') as string) || 4,
                appearance: parseInt(fd.get('appearance') as string) || 4,
                portion: parseInt(fd.get('portion') as string) || 4,
                temperature: parseInt(fd.get('temperature') as string) || 4,
                hygiene: parseInt(fd.get('hygiene') as string) || 4,
              },
              dishes: (fd.get('dishes') as string).split(',').map(s => s.trim()).filter(Boolean),
              feedback: fd.get('feedback') as string,
              suggestions: fd.get('suggestions') as string,
              createdAt: new Date().toISOString(),
            };
            const updated = [newRecord, ...mealRecords];
            setMealRecords(updated);
            saveAndSync('kt_meal_records', updated);
            setIsMealModalOpen(false);
          }} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95 my-8">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Utensils className="w-6 h-6 text-orange-500" />
              行政陪餐记录
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required type="date" name="date" lang="zh-CN" defaultValue={new Date().toISOString().split('T')[0]} className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" />
                <select required name="mealType" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold">
                  <option value="breakfast">早餐</option>
                  <option value="lunch">午餐</option>
                  <option value="snack">点心</option>
                </select>
              </div>
              
              <select required name="accompanier" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold">
                <option value="">陪餐人员 *</option>
                {teachers.filter(t => t.role.includes('组长') || t.role.includes('行政')).map(t => 
                  <option key={t.id} value={t.name}>{t.name}</option>
                )}
                <option value="园长">园长</option>
                <option value="副园长">副园长</option>
              </select>
              
              <select name="className" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold">
                <option value="">陪餐班级（可选）</option>
                <option>智狼班</option><option>勇熊班</option><option>灵狐班</option><option>幼狮班</option>
                <option>小班</option><option>中班</option><option>大班</option>
              </select>
              
              <input required name="dishes" placeholder="菜品（用逗号分隔）*" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" />
              
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-600">评分（1-5分）</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { name: 'taste', label: '口味' },
                    { name: 'appearance', label: '外观' },
                    { name: 'portion', label: '份量' },
                    { name: 'temperature', label: '温度' },
                    { name: 'hygiene', label: '卫生' },
                  ].map(item => (
                    <div key={item.name} className="text-center">
                      <label className="text-xs text-slate-400">{item.label}</label>
                      <select name={item.name} defaultValue="4" className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold outline-none focus:ring-2 focus:ring-orange-500">
                        <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              
              <textarea required name="feedback" placeholder="陪餐反馈 *" rows={3} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold resize-none" />
              
              <textarea name="suggestions" placeholder="改进建议（选填）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold resize-none" />
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsMealModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold shadow-lg">保存记录</button>
            </div>
          </form>
        </div>
      )}

      {/* 添加/编辑弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveTeacher} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95 my-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{editingTeacher ? '编辑教职工' : '添加教职工'}</h2>
              {/* 权限提示 */}
              <p className="text-xs text-slate-400 mt-1">
                {getPermissionSummary(currentUser.role)}
              </p>
            </div>
            
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <input required name="name" defaultValue={editingTeacher?.name} placeholder="姓名 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                <select required name="role" defaultValue={editingTeacher?.role || ''} className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                  <option value="">选择职位 *</option>
                  <option>园长</option><option>副园长</option><option>保教主任</option>
                  <option>班长</option><option>配班</option><option>保育员</option>
                  <option>厨师</option><option>保安</option><option>行政</option>
                  <option>美术老师</option><option>体育老师</option><option>音乐老师</option>
                </select>
              </div>
              
              <input required name="phone" defaultValue={editingTeacher?.phone} placeholder="联系电话 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
              
              <div className="grid grid-cols-2 gap-4">
                <select name="assignedClass" defaultValue={editingTeacher?.assignedClass || ''} className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                  <option value="">管理班级</option>
                  <option>书田中一</option><option>书田中二</option><option>悦芽一班</option>
                  <option>星语大一</option><option>星语大二</option>
                  <option>花开小一</option><option>花开小二</option><option>花开小三</option>
                  <option>全园流动</option>
                </select>
                <select name="campus" defaultValue={editingTeacher?.campus || '十七幼'} className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                  <option value="南江">南江园</option>
                  <option value="高新">高新园</option>
                  <option value="新市花园">新市花园园</option>
                  <option value="创越">创越园</option>
                  <option value="七幼">金星第七幼儿园</option>
                  <option value="八幼">金星第八幼儿园</option>
                  <option value="九幼">金星第九幼儿园</option>
                  <option value="十幼">金星第十幼儿园</option>
                  <option value="十二幼">金星第十二幼儿园</option>
                  <option value="十七幼">金星第十七幼儿园</option>
                </select>
              </div>
              
              <select name="education" defaultValue={editingTeacher?.education || ''} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                <option value="">学历（可选）</option>
                <option>高中/中专</option><option>大专</option><option>本科</option><option>硕士及以上</option>
              </select>
              
              {/* 园长权限区域 */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-slate-600">园长权限</span>
                  {!canEditSensitiveFields(currentUser.role) && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">仅园长可编辑</span>
                  )}
                </div>
                
                {/* 入职日期 - 敏感字段 */}
                <div className="space-y-1 mb-3">
                  <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    入职日期
                    {!canEditSensitiveFields(currentUser.role) && <Lock className="w-3 h-3 text-red-400" />}
                  </label>
                  <input 
                    type="date" 
                    lang="zh-CN"
                    name="hireDate" 
                    defaultValue={editingTeacher?.hireDate || new Date().toISOString().split('T')[0]} 
                    disabled={editingTeacher && !canEditSensitiveFields(currentUser.role)}
                    className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold ${
                      editingTeacher && !canEditSensitiveFields(currentUser.role) 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-slate-50'
                    }`}
                  />
                </div>
                
                {/* 在职状态 - 敏感字段 */}
                {editingTeacher && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      在职状态
                      {!canEditSensitiveFields(currentUser.role) && <Lock className="w-3 h-3 text-red-400" />}
                    </label>
                    <select 
                      name="status" 
                      defaultValue={editingTeacher?.status || 'active'}
                      disabled={!canEditSensitiveFields(currentUser.role)}
                      className={`w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold ${
                        !canEditSensitiveFields(currentUser.role) 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-50'
                      }`}
                    >
                      <option value="active">在职</option>
                      <option value="leave">请假</option>
                      <option value="resigned">离职</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => { setIsModalOpen(false); setEditingTeacher(null); }} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                {editingTeacher ? '保存修改' : '确认添加'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* 确认上传弹窗 */}
      {showConfirmModal && pendingData && (
        <ConfirmUploadModal
          isOpen={showConfirmModal}
          onConfirm={executeConfirm}
          onCancel={() => { setShowConfirmModal(false); setPendingData(null); }}
          title={pendingData.type === 'delete' 
            ? teachers.find(t => t.id === pendingData.data)?.name || '教职工' 
            : pendingData.data?.name || '教职工'}
          type={pendingData.type === 'delete' ? '删除教职工' : '教职工信息'}
          summary={pendingData.type === 'delete' 
            ? `确认删除教职工：${teachers.find(t => t.id === pendingData.data)?.name}？此操作将被记录。`
            : `确认${pendingData.isUpdate ? '更新' : '录入'}教职工信息，数据将电子留存`}
          details={pendingData.type === 'delete' ? [
            { label: '操作类型', value: '删除' },
            { label: '教职工', value: teachers.find(t => t.id === pendingData.data)?.name || '' },
          ] : [
            { label: '姓名', value: pendingData.data?.name || '' },
            { label: '职位', value: pendingData.data?.role || '' },
            { label: '负责班级', value: pendingData.data?.assignedClass || '' },
            { label: '园区', value: pendingData.data?.campus || '' },
          ]}
          isUpdate={pendingData.isUpdate}
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

export default StaffView;
