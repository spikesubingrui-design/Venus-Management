
import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, Search, Trash2, Filter, Globe, Eye, Phone, MapPin, Heart, 
  AlertTriangle, Calendar, Thermometer, Clock, CheckCircle2, XCircle,
  Users, ChevronDown, ChevronRight, Bell, Send, Utensils, Moon, Smile,
  ClipboardCheck, RefreshCw, Car, BookHeart, Star, Camera, Award, Plus,
  UserCheck, FileText, QrCode, X, Smartphone, Bug, Sparkles, BarChart3,
  Leaf, TreeDeciduous, Sprout
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Student, User, DailyHealthRecord, AttendanceRecord, PickupRecord, GrowthRecord, DevelopmentAssessment } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useToast } from '../components/Toast';
import { ChineseDatePicker, formatChineseDate } from '../components/ChineseDatePicker';

// 传染病登记记录
interface DiseaseRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  diseaseType: string;         // 疾病类型
  diagnosisDate: string;       // 确诊日期
  reportDate: string;          // 上报日期
  symptoms: string[];          // 症状
  hospital?: string;           // 就诊医院
  treatmentStatus: 'treating' | 'recovered' | 'isolated';  // 治疗中/已康复/隔离中
  returnDate?: string;         // 返园日期
  returnCertificate?: boolean; // 是否有返园证明
  notes?: string;
  reportedBy: string;
  createdAt: string;
}

// 班级消毒记录
interface DisinfectRecord {
  id: string;
  className: string;
  date: string;
  time: string;
  type: 'daily' | 'weekly' | 'special';  // 日常消毒/每周大消毒/特殊消毒
  areas: string[];             // 消毒区域
  method: string;              // 消毒方式
  disinfectant: string;        // 消毒剂
  concentration?: string;      // 浓度
  duration: number;            // 消毒时长（分钟）
  ventilation: boolean;        // 是否通风
  operator: string;            // 操作人
  supervisor?: string;         // 监督人
  notes?: string;
  createdAt: string;
}

interface StudentsViewProps {
  currentUser: User;
}

type ViewMode = 'CLASS_VIEW' | 'ATTENDANCE' | 'HEALTH_CHECK' | 'PICKUP' | 'GROWTH' | 'DISEASE' | 'DISINFECT' | 'STATS';

const StudentsView: React.FC<StudentsViewProps> = ({ currentUser }) => {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campusFilter, setCampusFilter] = useState<string>('ALL');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [viewDetailModal, setViewDetailModal] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('CLASS_VIEW');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [healthRecordModal, setHealthRecordModal] = useState(false);
  const [todayRecords, setTodayRecords] = useState<Record<string, DailyHealthRecord>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [pendingAttendance, setPendingAttendance] = useState<Record<string, AttendanceRecord['status']>>({});
  const [showAttendanceConfirm, setShowAttendanceConfirm] = useState(false);
  const [pickupRecords, setPickupRecords] = useState<PickupRecord[]>([]);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);
  const [pickupStudent, setPickupStudent] = useState<Student | null>(null);
  const [growthStudent, setGrowthStudent] = useState<Student | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeStudent, setQrCodeStudent] = useState<Student | null>(null);
  const [showParentScanPage, setShowParentScanPage] = useState(false);
  const [parentScanStudentId, setParentScanStudentId] = useState<string | null>(null);
  
  // 传染病登记
  const [diseaseRecords, setDiseaseRecords] = useState<DiseaseRecord[]>([]);
  const [isDiseaseModalOpen, setIsDiseaseModalOpen] = useState(false);
  
  // 班级消毒记录
  const [disinfectRecords, setDisinfectRecords] = useState<DisinfectRecord[]>([]);
  const [isDisinfectModalOpen, setIsDisinfectModalOpen] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  // 考勤日期选择（支持补登历史）
  const [attendanceDate, setAttendanceDate] = useState(today);
  
  // 获取保存的家长接送信息（自动填充用）
  const getSavedPickerInfo = () => {
    const saved = localStorage.getItem('kt_parent_picker_info');
    return saved ? JSON.parse(saved) : null;
  };
  
  // 保存家长接送信息
  const savePickerInfo = (info: { name: string; relation: string; phone: string; idLast4: string }) => {
    localStorage.setItem('kt_parent_picker_info', JSON.stringify(info));
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // 去重函数：按 name+class 或 id 去重，保留最新记录
  const deduplicateStudents = (students: Student[]): Student[] => {
    const seen = new Map<string, Student>();
    for (const s of students) {
      // 优先用 name+class 作为唯一键（更可靠），其次用 id
      const key = s.name && s.class ? `${s.name}_${s.class}` : s.id;
      if (!seen.has(key)) {
        seen.set(key, s);
      }
    }
    return Array.from(seen.values());
  };

  const loadData = async () => {
    setLoading(true);
    let data: Student[] = [];

    // 优先从 localStorage 加载（由 OSS 云端同步，数据最准确）
    const local = localStorage.getItem('kt_students');
    if (local) {
      data = JSON.parse(local);
    }

    // 仅当本地无数据时，才从 Supabase 获取
    if (data.length === 0 && isSupabaseConfigured) {
      const { data: cloudData } = await supabase.from('students').select('*').order('name');
      if (cloudData) data = cloudData;
    }

    // 去重保护：防止数据重复累积
    data = deduplicateStudents(data);

    // 多园区过滤逻辑
    if (currentUser.role !== 'SUPER_ADMIN') {
      data = data.filter(s => s.campus === currentUser.campus);
    }

    setStudents(data);
    
    // 加载今日记录
    const savedHealth = localStorage.getItem(`kt_health_${today}`);
    if (savedHealth) setTodayRecords(JSON.parse(savedHealth));
    
    const savedAttendance = localStorage.getItem(`kt_attendance_${today}`);
    if (savedAttendance) setAttendanceRecords(JSON.parse(savedAttendance));
    
    // 加载接送记录
    const savedPickup = localStorage.getItem('kt_pickup_records');
    if (savedPickup) setPickupRecords(JSON.parse(savedPickup));
    
    // 加载成长记录
    const savedGrowth = localStorage.getItem('kt_growth_records');
    if (savedGrowth) setGrowthRecords(JSON.parse(savedGrowth));
    
    // 加载传染病记录
    const savedDisease = localStorage.getItem('kt_disease_records');
    if (savedDisease) setDiseaseRecords(JSON.parse(savedDisease));
    
    // 加载消毒记录
    const savedDisinfect = localStorage.getItem('kt_disinfect_records');
    if (savedDisinfect) setDisinfectRecords(JSON.parse(savedDisinfect));
    
    setLoading(false);
  };

  // 保存接送记录
  const savePickupRecord = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pickupStudent) return;
    
    const fd = new FormData(e.currentTarget);
    const newRecord: PickupRecord = {
      id: Date.now().toString(),
      studentId: pickupStudent.id,
      date: today,
      type: fd.get('type') as 'pickup' | 'dropoff',
      time: new Date().toLocaleTimeString('zh-CN'),
      pickerName: fd.get('pickerName') as string,
      pickerRelation: fd.get('pickerRelation') as string,
      pickerPhone: fd.get('pickerPhone') as string,
      pickerIdLast4: fd.get('pickerIdLast4') as string,
      verifiedBy: currentUser.name,
      notes: fd.get('notes') as string,
    };
    
    const updated = [newRecord, ...pickupRecords];
    setPickupRecords(updated);
    localStorage.setItem('kt_pickup_records', JSON.stringify(updated));
    setIsPickupModalOpen(false);
    setPickupStudent(null);
  };

  // 保存成长记录
  const saveGrowthRecord = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!growthStudent) return;
    
    const fd = new FormData(e.currentTarget);
    const newRecord: GrowthRecord = {
      id: Date.now().toString(),
      studentId: growthStudent.id,
      date: today,
      type: fd.get('type') as any,
      title: fd.get('title') as string,
      content: fd.get('content') as string,
      category: fd.get('category') as string,
      recordedBy: currentUser.name,
      sharedToParent: fd.get('shareToParent') === 'on',
    };
    
    const updated = [newRecord, ...growthRecords];
    setGrowthRecords(updated);
    localStorage.setItem('kt_growth_records', JSON.stringify(updated));
    setIsGrowthModalOpen(false);
    setGrowthStudent(null);
  };

  // 获取学生今日接送记录
  const getStudentPickupToday = (studentId: string) => {
    return pickupRecords.filter(r => r.studentId === studentId && r.date === today);
  };

  // 获取学生成长记录
  const getStudentGrowthRecords = (studentId: string) => {
    return growthRecords.filter(r => r.studentId === studentId);
  };

  // 初始化考勤（默认全勤）
  const initAttendance = () => {
    const initial: Record<string, AttendanceRecord['status']> = {};
    students.forEach(s => {
      // 如果已有记录，保留原状态；否则默认出勤
      initial[s.id] = attendanceRecords[s.id]?.status || 'present';
    });
    setPendingAttendance(initial);
  };

  // 更新临时考勤状态（点击按钮时）
  const updatePendingAttendance = (studentId: string, status: AttendanceRecord['status']) => {
    setPendingAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  // 确认提交考勤
  const confirmAttendance = () => {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN');
      const targetDate = attendanceDate;  // 使用选择的日期
      
      // 加载该日期的现有记录
      const existingData = localStorage.getItem(`kt_attendance_${targetDate}`);
      const existingRecords = existingData ? JSON.parse(existingData) : {};
      
      Object.entries(pendingAttendance).forEach(([studentId, status]) => {
        const record: AttendanceRecord = {
          id: `${studentId}_${targetDate}`,
          studentId,
          date: targetDate,
          status,
          checkInTime: status === 'present' || status === 'late' ? timeStr : undefined,
          recordedBy: currentUser.name,
          recordedAt: now.toISOString()
        };
        
        existingRecords[studentId] = record;
      });
      
      setAttendanceRecords(existingRecords);
      localStorage.setItem(`kt_attendance_${targetDate}`, JSON.stringify(existingRecords));
      
      // 仅当登记的是今天的考勤时，更新学生当前状态
      if (targetDate === today) {
        const updatedStudents = students.map(s => ({
          ...s,
          status: pendingAttendance[s.id] || s.status,
          todayAttendance: existingRecords[s.id]
        }));
        setStudents(updatedStudents);
        localStorage.setItem('kt_students', JSON.stringify(updatedStudents));
      }
      
      const presentCount = Object.values(pendingAttendance).filter(s => s === 'present').length;
      const totalCount = Object.keys(pendingAttendance).length;
      const dateLabel = targetDate === today ? '今日' : targetDate;
      toast.success('考勤提交成功', `已记录 ${dateLabel} ${totalCount} 人考勤，出勤 ${presentCount} 人`);
      setShowAttendanceConfirm(false);
    } catch (err) {
      toast.error('考勤提交失败', '请稍后重试');
      console.error('考勤提交错误:', err);
    }
  };

  // 保存考勤（保留原函数用于其他地方）
  const saveAttendance = (studentId: string, status: AttendanceRecord['status']) => {
    const record: AttendanceRecord = {
      id: `${studentId}_${today}`,
      studentId,
      date: today,
      status,
      checkInTime: status === 'present' || status === 'late' ? new Date().toLocaleTimeString('zh-CN') : undefined,
      recordedBy: currentUser.name,
      recordedAt: new Date().toISOString()
    };
    
    const updated = { ...attendanceRecords, [studentId]: record };
    setAttendanceRecords(updated);
    localStorage.setItem(`kt_attendance_${today}`, JSON.stringify(updated));
    
    // 更新学生状态
    const updatedStudents = students.map(s => 
      s.id === studentId ? { ...s, status, todayAttendance: record } : s
    );
    setStudents(updatedStudents);
    localStorage.setItem('kt_students', JSON.stringify(updatedStudents));
  };

  // 保存健康记录
  const saveHealthRecord = (studentId: string, record: Partial<DailyHealthRecord>) => {
    const existingRecord = todayRecords[studentId] || {
      id: `${studentId}_${today}`,
      studentId,
      date: today,
      healthStatus: 'normal' as const,
      syncedToParent: false,
      recordedBy: currentUser.name,
      recordedAt: new Date().toISOString()
    };
    
    const updatedRecord: DailyHealthRecord = {
      ...existingRecord,
      ...record,
      recordedAt: new Date().toISOString()
    };
    
    const updated = { ...todayRecords, [studentId]: updatedRecord };
    setTodayRecords(updated);
    localStorage.setItem(`kt_health_${today}`, JSON.stringify(updated));
    
    // 高温自动通知家长
    const temp = record.morningTemp || record.noonTemp || record.afternoonTemp;
    if (temp && temp >= 37.3) {
      sendParentNotification(studentId, 'health_alert', `体温异常提醒`, 
        `您的孩子今日体温为 ${temp}°C，请关注孩子身体状况。如有不适请及时就医。`);
    }
  };

  // 发送家长通知
  const sendParentNotification = (studentId: string, type: string, title: string, content: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    // 模拟发送通知（实际项目中对接短信/微信等）
    console.log(`📱 通知家长 [${student.parent_name}]: ${title} - ${content}`);
    
    // 标记为已同步
    const record = todayRecords[studentId];
    if (record) {
      saveHealthRecord(studentId, { ...record, syncedToParent: true, syncedAt: new Date().toISOString() });
    }
    
    alert(`✅ 已通知家长 ${student.parent_name}（${student.parent_phone}）`);
  };

  // 批量同步今日记录给家长
  const syncAllToParents = () => {
    const studentsWithRecords = students.filter(s => todayRecords[s.id]);
    studentsWithRecords.forEach(student => {
      const record = todayRecords[student.id];
      if (record && !record.syncedToParent) {
        const content = generateDailyReport(student, record);
        sendParentNotification(student.id, 'daily_report', '今日在园情况', content);
      }
    });
  };

  // 生成每日报告
  const generateDailyReport = (student: Student, record: DailyHealthRecord) => {
    const parts = [];
    if (record.morningTemp) parts.push(`晨检体温: ${record.morningTemp}°C`);
    if (record.breakfastStatus) parts.push(`早餐: ${record.breakfastStatus === 'all' ? '全吃' : record.breakfastStatus === 'half' ? '一半' : '少量'}`);
    if (record.lunchStatus) parts.push(`午餐: ${record.lunchStatus === 'all' ? '全吃' : record.lunchStatus === 'half' ? '一半' : '少量'}`);
    if (record.napStatus) parts.push(`午睡: ${record.napStatus === 'good' ? '好' : record.napStatus === 'normal' ? '一般' : '较差'}`);
    if (record.moodStatus) parts.push(`情绪: ${record.moodStatus === 'happy' ? '开心' : record.moodStatus === 'normal' ? '一般' : '不太好'}`);
    if (record.notes) parts.push(`备注: ${record.notes}`);
    return parts.join('；');
  };

  const saveStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const birthDate = fd.get('birthDate') as string;
    const age = birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    
    const allergiesStr = fd.get('allergies') as string;
    const allergies = allergiesStr ? allergiesStr.split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];
    
    const newStudent: Student = {
      id: Date.now().toString(),
      name: fd.get('name') as string,
      gender: fd.get('gender') as '男' | '女',
      birthDate: birthDate,
      age: age,
      class: fd.get('class') as string,
      campus: fd.get('campus') as string || currentUser.campus || '十七幼',
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${fd.get('name')}`,
      status: 'present',
      last_activity: '刚入园',
      height: fd.get('height') ? parseFloat(fd.get('height') as string) : undefined,
      weight: fd.get('weight') ? parseFloat(fd.get('weight') as string) : undefined,
      bloodType: (fd.get('bloodType') as any) || '未知',
      allergies: allergies.length > 0 ? allergies : undefined,
      healthNotes: fd.get('healthNotes') as string || undefined,
      parent_name: fd.get('parent_name') as string,
      parent_phone: fd.get('parent_phone') as string,
      parent_relation: fd.get('parent_relation') as any || '母亲',
      emergency_contact: fd.get('emergency_contact') as string || undefined,
      emergency_phone: fd.get('emergency_phone') as string || undefined,
      emergency_relation: fd.get('emergency_relation') as string || undefined,
      address: fd.get('address') as string || undefined,
      enrollDate: fd.get('enrollDate') as string || new Date().toISOString().split('T')[0],
      studentNumber: fd.get('studentNumber') as string || undefined,
      dietaryRestrictions: fd.get('dietaryRestrictions') as string || undefined,
      specialNeeds: fd.get('specialNeeds') as string || undefined,
      // 收费设置
      classType: (fd.get('classType') as 'standard' | 'excellence' | 'music') || 'standard',
      feeNotes: fd.get('feeNotes') as string || undefined,
      feeDiscount: fd.get('discountType') ? {
        hasDiscount: !!fd.get('discountType'),
        discountType: fd.get('discountType') as 'percentage' | 'fixed' | 'custom' | undefined,
        discountValue: fd.get('discountValue') ? Number(fd.get('discountValue')) : undefined,
        discountReason: fd.get('discountReason') as string || undefined,
      } : undefined,
    };

    const updated = [newStudent, ...students];
    setStudents(updated);
    localStorage.setItem('kt_students', JSON.stringify(updated));

    if (isSupabaseConfigured) {
      await supabase.from('students').insert([newStudent]);
    }
    
    setIsModalOpen(false);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm('确定要删除该幼儿档案吗？')) return;
    const updated = students.filter(s => s.id !== id);
    setStudents(updated);
    localStorage.setItem('kt_students', JSON.stringify(updated));
    if (isSupabaseConfigured) {
      await supabase.from('students').delete().eq('id', id);
    }
  };

  // 按班级分组
  const groupedByClass = useMemo(() => {
    const groups: Record<string, Student[]> = {};
    students.forEach(s => {
      const matchSearch = s.name.includes(search) || s.class.includes(search);
      const matchCampus = campusFilter === 'ALL' || s.campus === campusFilter;
      if (matchSearch && matchCampus) {
        if (!groups[s.class]) groups[s.class] = [];
        groups[s.class].push(s);
      }
    });
    return groups;
  }, [students, search, campusFilter]);

  const allClasses = Object.keys(groupedByClass).sort();
  const uniqueCampuses = Array.from(new Set(students.map(s => s.campus)));

  // 统计数据
  const stats = useMemo(() => {
    const total = students.length;
    const present = students.filter(s => attendanceRecords[s.id]?.status === 'present').length;
    const absent = students.filter(s => attendanceRecords[s.id]?.status === 'absent').length;
    const sickLeave = students.filter(s => attendanceRecords[s.id]?.status === 'sick_leave').length;
    const personalLeave = students.filter(s => attendanceRecords[s.id]?.status === 'personal_leave').length;
    const highTemp = Object.values(todayRecords).filter(r => {
      const temp = r.morningTemp || r.noonTemp || r.afternoonTemp;
      return temp && temp >= 37.3;
    }).length;
    return { total, present, absent, sickLeave, personalLeave, highTemp };
  }, [students, attendanceRecords, todayRecords]);

  // 体温状态样式
  const getTempStyle = (temp?: number) => {
    if (!temp) return 'text-slate-400';
    if (temp >= 38) return 'text-red-600 bg-red-100 font-black';
    if (temp >= 37.3) return 'text-orange-600 bg-orange-100 font-bold';
    return 'text-emerald-600 bg-emerald-50';
  };

  return (
    <div className="space-y-6 relative">
      {/* 装饰元素 */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
        <TreeDeciduous className="w-full h-full text-[#4a5d3a]" />
      </div>

      {/* 顶部统计和操作栏 - 自然风格 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl shadow-lg" style={{ backgroundColor: '#4a5d3a' }}>
            <Users className="w-8 h-8 text-[#c9dbb8]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#4a5d3a', fontFamily: "'Noto Serif SC', serif" }}>幼儿档案管理</h1>
            <p className="flex items-center gap-2 text-sm mt-1" style={{ color: '#8b7355' }}>
              <Leaf className="w-4 h-4" style={{ color: '#4a5d3a' }} />
              {currentUser.role === 'SUPER_ADMIN' ? '全园管理' : currentUser.campus} · {today}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setIsModalOpen(true)} className="text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:opacity-90 flex items-center gap-2 transition-all text-sm" style={{ backgroundColor: '#4a5d3a' }}>
            <UserPlus className="w-4 h-4" /> 录入新生
          </button>
          <button onClick={syncAllToParents} className="text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:opacity-90 flex items-center gap-2 transition-all text-sm" style={{ backgroundColor: '#c9a962' }}>
            <Send className="w-4 h-4" /> 同步家长
          </button>
        </div>
      </div>

      {/* 今日统计卡片 - 自然风格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border-2 shadow-sm" style={{ backgroundColor: 'white', borderColor: '#e8e4dc' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4a5d3a20' }}>
              <Users className="w-5 h-5" style={{ color: '#4a5d3a' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#8b7355' }}>在园总数</p>
              <p className="text-2xl font-bold" style={{ color: '#4a5d3a' }}>{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border-2 shadow-sm" style={{ backgroundColor: 'white', borderColor: '#e8e4dc' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#6b7c5c20' }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: '#6b7c5c' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#8b7355' }}>今日出勤</p>
              <p className="text-2xl font-bold" style={{ color: '#6b7c5c' }}>{stats.present}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border-2 shadow-sm" style={{ backgroundColor: 'white', borderColor: '#e8e4dc' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#c9a96220' }}>
              <XCircle className="w-5 h-5" style={{ color: '#c9a962' }} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">请假/缺勤</p>
              <p className="text-2xl font-black text-orange-600">{stats.absent}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.highTemp > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
              <Thermometer className={`w-5 h-5 ${stats.highTemp > 0 ? 'text-red-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">体温异常</p>
              <p className={`text-2xl font-black ${stats.highTemp > 0 ? 'text-red-600' : 'text-slate-400'}`}>{stats.highTemp}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 视图切换和筛选 */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setViewMode('CLASS_VIEW')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'CLASS_VIEW' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Users className="w-4 h-4 inline mr-1" />班级视图
          </button>
          <button onClick={() => { setViewMode('ATTENDANCE'); initAttendance(); }} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'ATTENDANCE' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <ClipboardCheck className="w-4 h-4 inline mr-1" />快速考勤
          </button>
          <button onClick={() => setViewMode('HEALTH_CHECK')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'HEALTH_CHECK' ? 'bg-rose-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Thermometer className="w-4 h-4 inline mr-1" />健康打卡
          </button>
          <button onClick={() => setViewMode('PICKUP')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'PICKUP' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Car className="w-4 h-4 inline mr-1" />接送管理
          </button>
          <button onClick={() => setViewMode('GROWTH')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'GROWTH' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <BookHeart className="w-4 h-4 inline mr-1" />成长档案
          </button>
          <button onClick={() => setViewMode('DISEASE')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'DISEASE' ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Bug className="w-4 h-4 inline mr-1" />传染病
          </button>
          <button onClick={() => setViewMode('DISINFECT')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'DISINFECT' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <Sparkles className="w-4 h-4 inline mr-1" />班级消毒
          </button>
          <button onClick={() => setViewMode('STATS')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'STATS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <BarChart3 className="w-4 h-4 inline mr-1" />出勤统计
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input placeholder="搜索姓名或班级..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm w-48" />
          </div>
          
          {currentUser.role === 'SUPER_ADMIN' && (
            <select value={campusFilter} onChange={e => setCampusFilter(e.target.value)} className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-600">
              <option value="ALL">全部校区</option>
              {uniqueCampuses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* 班级视图 */}
      {viewMode === 'CLASS_VIEW' && (
        <div className="space-y-4">
          {allClasses.map(className => (
            <div key={className} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <button 
                onClick={() => setSelectedClass(selectedClass === className ? null : className)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-slate-800 text-lg">{className}</h3>
                    <p className="text-xs text-slate-400">{groupedByClass[className].length} 位幼儿</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-emerald-600 font-bold text-sm">
                      {groupedByClass[className].filter(s => attendanceRecords[s.id]?.status === 'present').length} 出勤
                    </span>
                    <span className="text-slate-300 mx-2">/</span>
                    <span className="text-orange-600 font-bold text-sm">
                      {groupedByClass[className].filter(s => !attendanceRecords[s.id] || attendanceRecords[s.id]?.status !== 'present').length} 未到
                    </span>
                  </div>
                  {selectedClass === className ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </div>
              </button>
              
              {selectedClass === className && (
                <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {groupedByClass[className].map(student => {
                    const healthRecord = todayRecords[student.id];
                    const attendance = attendanceRecords[student.id];
                    const temp = healthRecord?.morningTemp || healthRecord?.noonTemp;
                    
                    return (
                      <div 
                        key={student.id} 
                        onClick={() => { setSelectedStudent(student); setViewDetailModal(true); }}
                        className={`p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all ${
                          temp && temp >= 37.3 ? 'border-red-200 bg-red-50' :
                          attendance?.status === 'present' ? 'border-emerald-200 bg-emerald-50' :
                          attendance?.status === 'absent' || attendance?.status === 'sick_leave' ? 'border-orange-200 bg-orange-50' :
                          'border-slate-100 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img src={student.avatar} className="w-10 h-10 rounded-xl bg-slate-50" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{student.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {student.gender === '男' ? '👦' : '👧'} {student.age}岁
                            </p>
                          </div>
                        </div>
                        {temp && (
                          <div className={`mt-2 text-center py-1 rounded-lg text-xs ${getTempStyle(temp)}`}>
                            🌡️ {temp}°C
                          </div>
                        )}
                        {student.allergies && student.allergies.length > 0 && (
                          <div className="mt-1 text-[9px] text-red-500 font-bold">⚠️ 过敏体质</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 快速考勤视图 */}
      {viewMode === 'ATTENDANCE' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-black text-emerald-800 flex items-center gap-2">
                考勤登记 · 
                <span className="text-sm font-bold text-emerald-600">{formatChineseDate(attendanceDate)}</span>
                <input
                  type="date"
                  value={attendanceDate}
                  max={today}
                  onChange={e => {
                    setAttendanceDate(e.target.value);
                    // 加载该日期的考勤记录
                    const existingData = localStorage.getItem(`kt_attendance_${e.target.value}`);
                    if (existingData) {
                      const records = JSON.parse(existingData);
                      setAttendanceRecords(records);
                      // 更新pending状态
                      const pending: Record<string, AttendanceRecord['status']> = {};
                      students.forEach(s => {
                        pending[s.id] = records[s.id]?.status || 'present';
                      });
                      setPendingAttendance(pending);
                    } else {
                      // 没有记录，默认全勤
                      const pending: Record<string, AttendanceRecord['status']> = {};
                      students.forEach(s => {
                        pending[s.id] = 'present';
                      });
                      setPendingAttendance(pending);
                      setAttendanceRecords({});
                    }
                  }}
                  className="px-3 py-1 border border-emerald-300 rounded-lg text-emerald-700 font-bold bg-white"
                />
                {attendanceDate !== today && (
                  <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-bold">
                    补登历史
                  </span>
                )}
              </h3>
              <p className="text-xs text-emerald-600 mt-1">
                💡 默认全勤，只需标记缺勤/请假的学生，确认后提交。可选择过去日期补登考勤。
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* 统计信息 */}
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-bold">
                  出勤 {Object.values(pendingAttendance).filter(s => s === 'present').length}
                </span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-bold">
                  迟到 {Object.values(pendingAttendance).filter(s => s === 'late').length}
                </span>
                <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg font-bold">
                  请假 {Object.values(pendingAttendance).filter(s => s === 'sick_leave').length}
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold">
                  缺勤 {Object.values(pendingAttendance).filter(s => s === 'absent').length}
                </span>
              </div>
              {/* 确认提交按钮 */}
              <button 
                onClick={() => setShowAttendanceConfirm(true)}
                className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                确认提交
              </button>
            </div>
          </div>
          
          {allClasses.map(className => (
            <div key={className} className="border-b border-slate-50 last:border-0">
              <div className="px-6 py-3 bg-slate-50/50 font-bold text-slate-600 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> {className}
                <span className="text-xs text-slate-400 ml-2">
                  ({groupedByClass[className]?.length || 0}人)
                </span>
              </div>
              <div className="px-6 py-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedByClass[className]?.map(student => {
                  const status = pendingAttendance[student.id] || 'present';
                  const isModified = status !== 'present';
                  return (
                    <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isModified ? 'bg-amber-50 ring-2 ring-amber-200' : 'bg-slate-50 hover:bg-slate-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <img src={student.avatar} className="w-10 h-10 rounded-xl" />
                        <div>
                          <p className="font-bold text-slate-800">{student.name}</p>
                          <p className={`text-xs ${isModified ? 'text-amber-600 font-bold' : 'text-emerald-500'}`}>
                            {status === 'present' ? '✓ 出勤' : 
                             status === 'late' ? '⏰ 迟到' : 
                             status === 'sick_leave' ? '🏥 请假' : '✗ 缺勤'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => updatePendingAttendance(student.id, 'present')}
                          className={`p-2 rounded-lg transition-all ${status === 'present' ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50'}`}
                          title="出勤"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => updatePendingAttendance(student.id, 'late')}
                          className={`p-2 rounded-lg transition-all ${status === 'late' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'}`}
                          title="迟到"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => updatePendingAttendance(student.id, 'sick_leave')}
                          className={`p-2 rounded-lg transition-all ${status === 'sick_leave' ? 'bg-rose-500 text-white' : 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'}`}
                          title="请假"
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => updatePendingAttendance(student.id, 'absent')}
                          className={`p-2 rounded-lg transition-all ${status === 'absent' ? 'bg-slate-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                          title="缺勤"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 考勤确认弹窗 */}
      {showAttendanceConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 bg-emerald-50 border-b border-emerald-100">
              <h3 className="text-xl font-black text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                确认提交考勤
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600">确认提交今日（{today}）的考勤记录？</p>
              
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">出勤人数</span>
                  <span className="font-bold text-emerald-600">{Object.values(pendingAttendance).filter(s => s === 'present').length} 人</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">迟到人数</span>
                  <span className="font-bold text-amber-600">{Object.values(pendingAttendance).filter(s => s === 'late').length} 人</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">请假人数</span>
                  <span className="font-bold text-rose-600">{Object.values(pendingAttendance).filter(s => s === 'sick_leave').length} 人</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">缺勤人数</span>
                  <span className="font-bold text-slate-600">{Object.values(pendingAttendance).filter(s => s === 'absent').length} 人</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">总人数</span>
                  <span className="font-bold text-slate-800">{Object.keys(pendingAttendance).length} 人</span>
                </div>
              </div>

              {/* 显示非出勤名单 */}
              {Object.entries(pendingAttendance).filter(([_, s]) => s !== 'present').length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 mb-2">⚠️ 非出勤学生：</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(pendingAttendance)
                      .filter(([_, s]) => s !== 'present')
                      .map(([id, status]) => {
                        const student = students.find(s => s.id === id);
                        return (
                          <span key={id} className={`text-xs px-2 py-1 rounded-full font-bold ${
                            status === 'late' ? 'bg-amber-100 text-amber-700' :
                            status === 'sick_leave' ? 'bg-rose-100 text-rose-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {student?.name}
                          </span>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 flex gap-3 justify-end">
              <button 
                onClick={() => setShowAttendanceConfirm(false)}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
              >
                取消
              </button>
              <button 
                onClick={confirmAttendance}
                className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 健康打卡视图 */}
      {viewMode === 'HEALTH_CHECK' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 flex items-center justify-between">
            <h3 className="font-black text-rose-800 flex items-center gap-2">
              <Thermometer className="w-5 h-5" /> 今日健康打卡
            </h3>
            <div className="text-xs text-rose-600">
              {stats.highTemp > 0 && <span className="bg-red-100 px-2 py-1 rounded-full font-bold">⚠️ {stats.highTemp}人体温异常</span>}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-bold text-slate-500">班级</th>
                  <th className="px-4 py-3 font-bold text-slate-500">姓名</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">晨检体温</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">午检体温</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">早餐</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">午餐</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">午睡</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">情绪</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">同步</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedByClass).flatMap(([className, classStudents]) =>
                  classStudents.map((student, idx) => {
                    const record = todayRecords[student.id] || {} as DailyHealthRecord;
                    return (
                      <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50">
                        {idx === 0 && (
                          <td className="px-4 py-3 font-bold text-slate-600" rowSpan={classStudents.length}>
                            {className}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <img src={student.avatar} className="w-8 h-8 rounded-lg" />
                            <span className="font-bold text-slate-800">{student.name}</span>
                            {student.allergies && student.allergies.length > 0 && (
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            step="0.1" 
                            placeholder="36.5"
                            value={record.morningTemp || ''}
                            onChange={(e) => saveHealthRecord(student.id, { morningTemp: parseFloat(e.target.value) || undefined })}
                            className={`w-16 px-2 py-1 text-center rounded-lg border ${getTempStyle(record.morningTemp)} outline-none focus:ring-2 focus:ring-rose-300`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            step="0.1" 
                            placeholder="36.5"
                            value={record.noonTemp || ''}
                            onChange={(e) => saveHealthRecord(student.id, { noonTemp: parseFloat(e.target.value) || undefined })}
                            className={`w-16 px-2 py-1 text-center rounded-lg border ${getTempStyle(record.noonTemp)} outline-none focus:ring-2 focus:ring-rose-300`}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select 
                            value={record.breakfastStatus || ''}
                            onChange={(e) => saveHealthRecord(student.id, { breakfastStatus: e.target.value as any })}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                          >
                            <option value="">-</option>
                            <option value="all">🍚 全吃</option>
                            <option value="half">🍚 一半</option>
                            <option value="little">🍚 少量</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select 
                            value={record.lunchStatus || ''}
                            onChange={(e) => saveHealthRecord(student.id, { lunchStatus: e.target.value as any })}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                          >
                            <option value="">-</option>
                            <option value="all">🍚 全吃</option>
                            <option value="half">🍚 一半</option>
                            <option value="little">🍚 少量</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select 
                            value={record.napStatus || ''}
                            onChange={(e) => saveHealthRecord(student.id, { napStatus: e.target.value as any })}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                          >
                            <option value="">-</option>
                            <option value="good">😴 好</option>
                            <option value="normal">😐 一般</option>
                            <option value="poor">😣 差</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select 
                            value={record.moodStatus || ''}
                            onChange={(e) => saveHealthRecord(student.id, { moodStatus: e.target.value as any })}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                          >
                            <option value="">-</option>
                            <option value="happy">😊 开心</option>
                            <option value="normal">😐 一般</option>
                            <option value="upset">😢 不开心</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {record.syncedToParent ? (
                            <span className="text-emerald-500 text-xs font-bold">✓ 已同步</span>
                          ) : (
                            <button 
                              onClick={() => sendParentNotification(student.id, 'daily_report', '今日在园情况', generateDailyReport(student, record))}
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                            >
                              发送
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 接送管理视图 */}
      {viewMode === 'PICKUP' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100 flex items-center justify-between">
            <h3 className="font-black text-blue-800 flex items-center gap-2">
              <Car className="w-5 h-5" /> 今日接送记录
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-bold">
                {pickupRecords.filter(r => r.date === today).length} 条记录
              </span>
              <button 
                onClick={() => setShowQRCode(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
              >
                <QrCode className="w-4 h-4" /> 扫码接送
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {Object.entries(groupedByClass).flatMap(([className, classStudents]) =>
                classStudents.map(student => {
                  const todayPickup = getStudentPickupToday(student.id);
                  const hasDropoff = todayPickup.some(r => r.type === 'dropoff');
                  const hasPickup = todayPickup.some(r => r.type === 'pickup');
                  
                  return (
                    <div key={student.id} className={`p-4 rounded-xl border transition-all ${
                      hasPickup ? 'border-green-200 bg-green-50' :
                      hasDropoff ? 'border-blue-200 bg-blue-50' :
                      'border-slate-100 bg-white'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <img src={student.avatar} className="w-10 h-10 rounded-xl" />
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{student.name}</p>
                          <p className="text-xs text-slate-400">{className}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${hasDropoff ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                          送入 {hasDropoff ? '✓' : '-'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${hasPickup ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          接走 {hasPickup ? '✓' : '-'}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setPickupStudent(student); setIsPickupModalOpen(true); }}
                          className="flex-1 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                        >
                          + 记录接送
                        </button>
                        <button 
                          onClick={() => { setQrCodeStudent(student); setShowQRCode(true); }}
                          className="px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
                          title="生成二维码"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* 今日接送明细 */}
            {pickupRecords.filter(r => r.date === today).length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 mb-4">今日接送明细</h4>
                <div className="space-y-2">
                  {pickupRecords.filter(r => r.date === today).map(record => {
                    const student = students.find(s => s.id === record.studentId);
                    return (
                      <div key={record.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            record.type === 'dropoff' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {record.type === 'dropoff' ? '送入' : '接走'}
                          </span>
                          <span className="font-bold text-slate-800">{student?.name}</span>
                          <span className="text-slate-400 text-sm">由 {record.pickerName}（{record.pickerRelation}）</span>
                        </div>
                        <span className="text-xs text-slate-400">{record.time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 成长档案视图 */}
      {viewMode === 'GROWTH' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(groupedByClass).flatMap(([className, classStudents]) =>
              classStudents.map(student => {
                const studentGrowth = getStudentGrowthRecords(student.id);
                return (
                  <div key={student.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all">
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                      <div className="flex items-center gap-3">
                        <img src={student.avatar} className="w-14 h-14 rounded-xl border-2 border-white shadow-sm" />
                        <div>
                          <h4 className="font-bold text-slate-800">{student.name}</h4>
                          <p className="text-xs text-slate-500">{className} · {student.age}岁</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-400">成长记录</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">
                          {studentGrowth.length} 条
                        </span>
                      </div>
                      
                      {studentGrowth.slice(0, 3).map(record => (
                        <div key={record.id} className="py-2 border-b border-slate-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              record.type === 'milestone' ? 'bg-amber-500' :
                              record.type === 'artwork' ? 'bg-pink-500' :
                              record.type === 'assessment' ? 'bg-blue-500' :
                              'bg-emerald-500'
                            }`} />
                            <span className="text-sm font-bold text-slate-700 truncate">{record.title}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{record.content}</p>
                        </div>
                      ))}
                      
                      {studentGrowth.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">暂无记录</p>
                      )}
                      
                      <button 
                        onClick={() => { setGrowthStudent(student); setIsGrowthModalOpen(true); }}
                        className="w-full mt-3 py-2 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> 添加成长记录
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 传染病登记视图 */}
      {viewMode === 'DISEASE' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 px-4 py-2 rounded-xl">
                <span className="text-red-700 font-bold text-sm">当前患病: {diseaseRecords.filter(d => d.treatmentStatus !== 'recovered').length}人</span>
              </div>
              <div className="bg-amber-100 px-4 py-2 rounded-xl">
                <span className="text-amber-700 font-bold text-sm">隔离中: {diseaseRecords.filter(d => d.treatmentStatus === 'isolated').length}人</span>
              </div>
            </div>
            <button 
              onClick={() => setIsDiseaseModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />登记传染病
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">幼儿信息</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">疾病类型</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">确诊日期</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">症状</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">返园</th>
                </tr>
              </thead>
              <tbody>
                {diseaseRecords.map(record => (
                  <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{record.studentName}</p>
                      <p className="text-xs text-slate-400">{record.className}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                        {record.diseaseType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{record.diagnosisDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {record.symptoms.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        record.treatmentStatus === 'recovered' ? 'bg-emerald-100 text-emerald-700' :
                        record.treatmentStatus === 'isolated' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {record.treatmentStatus === 'recovered' ? '已康复' : 
                         record.treatmentStatus === 'isolated' ? '隔离中' : '治疗中'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {record.returnDate ? (
                        <div>
                          <p className="text-sm text-emerald-600">{record.returnDate}</p>
                          {record.returnCertificate && <span className="text-xs text-slate-400">✓ 有证明</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">待返园</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {diseaseRecords.length === 0 && (
              <div className="py-12 text-center">
                <Bug className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">暂无传染病记录</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 班级消毒视图 */}
      {viewMode === 'DISINFECT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-cyan-100 px-4 py-2 rounded-xl">
                <span className="text-cyan-700 font-bold text-sm">今日消毒: {disinfectRecords.filter(d => d.date === today).length}次</span>
              </div>
            </div>
            <button 
              onClick={() => setIsDisinfectModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />记录消毒
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {disinfectRecords.slice(0, 12).map(record => (
              <div key={record.id} className={`bg-white p-5 rounded-2xl border-2 ${
                record.type === 'special' ? 'border-red-200' : 
                record.type === 'weekly' ? 'border-blue-200' : 'border-slate-100'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{record.className}</h3>
                    <p className="text-xs text-slate-400">{record.date} {record.time}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    record.type === 'special' ? 'bg-red-100 text-red-700' :
                    record.type === 'weekly' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {record.type === 'special' ? '特殊消毒' : 
                     record.type === 'weekly' ? '周消毒' : '日常消毒'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">区域:</span>
                    <div className="flex flex-wrap gap-1">
                      {record.areas.map((a, i) => (
                        <span key={i} className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded text-xs">{a}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600"><span className="text-slate-400">方式:</span> {record.method}</p>
                  <p className="text-slate-600"><span className="text-slate-400">消毒剂:</span> {record.disinfectant}</p>
                  <p className="text-slate-600"><span className="text-slate-400">时长:</span> {record.duration}分钟</p>
                  <p className="text-slate-600"><span className="text-slate-400">操作人:</span> {record.operator}</p>
                  {record.ventilation && <span className="text-emerald-600 text-xs">✓ 已通风</span>}
                </div>
              </div>
            ))}
          </div>
          
          {disinfectRecords.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">暂无消毒记录</p>
              <button onClick={() => setIsDisinfectModalOpen(true)} className="text-cyan-600 font-bold mt-2 hover:underline">
                开始记录
              </button>
            </div>
          )}
        </div>
      )}

      {/* 出勤统计视图 */}
      {viewMode === 'STATS' && (
        <div className="space-y-6">
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-400 text-xs font-bold mb-2">今日出勤</p>
              <p className="text-3xl font-black text-emerald-600">{stats.present}</p>
              <p className="text-xs text-slate-400 mt-1">/ {students.length} 总人数</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-400 text-xs font-bold mb-2">出勤率</p>
              <p className="text-3xl font-black text-blue-600">
                {students.length > 0 ? Math.round((stats.present / students.length) * 100) : 0}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-400 text-xs font-bold mb-2">病假</p>
              <p className="text-3xl font-black text-amber-600">{stats.sickLeave}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-400 text-xs font-bold mb-2">事假</p>
              <p className="text-3xl font-black text-slate-600">{stats.personalLeave}</p>
            </div>
          </div>

          {/* 班级出勤对比 */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="font-bold text-slate-800 mb-4">班级出勤对比</h3>
            <div className="space-y-3">
              {allClasses.map(className => {
                const classStudents = students.filter(s => s.class === className);
                const classPresent = classStudents.filter(s => attendanceRecords[s.id]?.status === 'present').length;
                const rate = classStudents.length > 0 ? Math.round((classPresent / classStudents.length) * 100) : 0;
                return (
                  <div key={className} className="flex items-center gap-4">
                    <span className="w-20 text-sm font-bold text-slate-600">{className}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm font-bold">{classPresent}/{classStudents.length}</span>
                    <span className={`w-12 text-right text-sm font-bold ${
                      rate >= 90 ? 'text-emerald-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600'
                    }`}>{rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 连续请假统计 */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              连续请假提醒
            </h3>
            <div className="space-y-2">
              {students.filter(s => s.status === 'sick_leave' || s.status === 'personal_leave').length > 0 ? (
                students.filter(s => s.status === 'sick_leave' || s.status === 'personal_leave').map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <img src={s.avatar} className="w-8 h-8 rounded-lg" />
                      <div>
                        <p className="font-bold text-slate-800">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.class}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      s.status === 'sick_leave' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {s.status === 'sick_leave' ? '病假' : '事假'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm text-center py-4">暂无连续请假记录</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 传染病登记弹窗 */}
      {isDiseaseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const student = students.find(s => s.id === fd.get('studentId'));
            const newRecord: DiseaseRecord = {
              id: Date.now().toString(),
              studentId: fd.get('studentId') as string,
              studentName: student?.name || '',
              className: student?.class || '',
              diseaseType: fd.get('diseaseType') as string,
              diagnosisDate: fd.get('diagnosisDate') as string,
              reportDate: today,
              symptoms: (fd.get('symptoms') as string).split(',').map(s => s.trim()).filter(Boolean),
              hospital: fd.get('hospital') as string,
              treatmentStatus: fd.get('status') as 'treating' | 'recovered' | 'isolated',
              notes: fd.get('notes') as string,
              reportedBy: currentUser.name,
              createdAt: new Date().toISOString(),
            };
            const updated = [newRecord, ...diseaseRecords];
            setDiseaseRecords(updated);
            localStorage.setItem('kt_disease_records', JSON.stringify(updated));
            setIsDiseaseModalOpen(false);
          }} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Bug className="w-6 h-6 text-red-500" />
              传染病登记
            </h2>
            
            <div className="space-y-4">
              <select required name="studentId" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold">
                <option value="">选择幼儿 *</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} - {s.class}</option>)}
              </select>
              
              <select required name="diseaseType" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold">
                <option value="">疾病类型 *</option>
                <option>手足口病</option><option>流感</option><option>水痘</option>
                <option>腮腺炎</option><option>诺如病毒</option><option>疱疹性咽峡炎</option>
                <option>红眼病</option><option>其他传染病</option>
              </select>
              
              <input required type="date" name="diagnosisDate" lang="zh-CN" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold" />
              
              <input name="symptoms" placeholder="症状（用逗号分隔，如：发烧,咳嗽）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold" />
              
              <input name="hospital" placeholder="就诊医院" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold" />
              
              <select required name="status" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold">
                <option value="treating">治疗中</option>
                <option value="isolated">隔离中</option>
                <option value="recovered">已康复</option>
              </select>
              
              <textarea name="notes" placeholder="备注" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold resize-none" />
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsDiseaseModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg">登记</button>
            </div>
          </form>
        </div>
      )}

      {/* 班级消毒弹窗 */}
      {isDisinfectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const newRecord: DisinfectRecord = {
              id: Date.now().toString(),
              className: fd.get('className') as string,
              date: today,
              time: new Date().toLocaleTimeString('zh-CN').slice(0, 5),
              type: fd.get('type') as 'daily' | 'weekly' | 'special',
              areas: (fd.get('areas') as string).split(',').map(s => s.trim()).filter(Boolean),
              method: fd.get('method') as string,
              disinfectant: fd.get('disinfectant') as string,
              concentration: fd.get('concentration') as string,
              duration: parseInt(fd.get('duration') as string) || 30,
              ventilation: fd.get('ventilation') === 'on',
              operator: fd.get('operator') as string || currentUser.name,
              notes: fd.get('notes') as string,
              createdAt: new Date().toISOString(),
            };
            const updated = [newRecord, ...disinfectRecords];
            setDisinfectRecords(updated);
            localStorage.setItem('kt_disinfect_records', JSON.stringify(updated));
            setIsDisinfectModalOpen(false);
          }} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-500" />
              班级消毒记录
            </h2>
            
            <div className="space-y-4">
              <select required name="className" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold">
                <option value="">选择班级 *</option>
                {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              <select required name="type" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold">
                <option value="daily">日常消毒</option>
                <option value="weekly">每周大消毒</option>
                <option value="special">特殊消毒（传染病后）</option>
              </select>
              
              <input required name="areas" placeholder="消毒区域（用逗号分隔，如：桌面,地面,门把手,玩具）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold" />
              
              <select required name="method" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold">
                <option value="">消毒方式 *</option>
                <option>紫外线消毒</option><option>擦拭消毒</option><option>喷洒消毒</option>
                <option>浸泡消毒</option><option>熏蒸消毒</option>
              </select>
              
              <input required name="disinfectant" placeholder="消毒剂（如：84消毒液、酒精）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold" />
              
              <div className="grid grid-cols-2 gap-4">
                <input name="concentration" placeholder="浓度（如：1:100）" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold" />
                <input type="number" name="duration" placeholder="时长（分钟）" defaultValue="30" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold" />
              </div>
              
              <input name="operator" placeholder="操作人" defaultValue={currentUser.name} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold" />
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="ventilation" defaultChecked className="w-4 h-4 rounded text-cyan-600" />
                <span className="text-sm font-bold text-slate-600">消毒后已通风</span>
              </label>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsDisinfectModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-bold shadow-lg">保存记录</button>
            </div>
          </form>
        </div>
      )}

      {/* 接送记录弹窗 */}
      {isPickupModalOpen && pickupStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={savePickupRecord} className="bg-white rounded-3xl p-8 w-full max-w-md space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Car className="w-6 h-6 text-blue-500" />
              接送记录 - {pickupStudent.name}
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer hover:border-blue-500 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                  <input type="radio" name="type" value="dropoff" defaultChecked className="hidden" />
                  <span className="text-2xl">📥</span>
                  <span className="font-bold">送入园</span>
                </label>
                <label className="flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer hover:border-green-500 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                  <input type="radio" name="type" value="pickup" className="hidden" />
                  <span className="text-2xl">📤</span>
                  <span className="font-bold">接走</span>
                </label>
              </div>
              
              <input required name="pickerName" placeholder="接送人姓名 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              
              <select required name="pickerRelation" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                <option value="">与幼儿关系 *</option>
                <option>父亲</option><option>母亲</option><option>爷爷</option><option>奶奶</option>
                <option>外公</option><option>外婆</option><option>其他亲属</option><option>保姆</option>
              </select>
              
              <input name="pickerPhone" placeholder="联系电话" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              
              <input name="pickerIdLast4" placeholder="身份证后四位（验证用）" maxLength={4} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              
              <textarea name="notes" placeholder="备注" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none" />
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => { setIsPickupModalOpen(false); setPickupStudent(null); }} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">确认记录</button>
            </div>
          </form>
        </div>
      )}

      {/* 成长记录弹窗 */}
      {isGrowthModalOpen && growthStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveGrowthRecord} className="bg-white rounded-3xl p-8 w-full max-w-md space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <BookHeart className="w-6 h-6 text-purple-500" />
              成长记录 - {growthStudent.name}
            </h2>
            
            <div className="space-y-4">
              <select required name="type" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold">
                <option value="">记录类型 *</option>
                <option value="milestone">里程碑</option>
                <option value="observation">日常观察</option>
                <option value="assessment">能力评估</option>
                <option value="artwork">作品展示</option>
                <option value="photo">精彩瞬间</option>
              </select>
              
              <select name="category" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold">
                <option value="">发展领域</option>
                <option value="健康">健康领域</option>
                <option value="语言">语言领域</option>
                <option value="社会">社会领域</option>
                <option value="科学">科学领域</option>
                <option value="艺术">艺术领域</option>
              </select>
              
              <input required name="title" placeholder="标题 *（如：学会系鞋带）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold" />
              
              <textarea required name="content" placeholder="详细描述 *" rows={4} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold resize-none" />
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="shareToParent" className="w-4 h-4 rounded text-purple-600" />
                <span className="text-sm font-bold text-slate-600">同步给家长</span>
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => { setIsGrowthModalOpen(false); setGrowthStudent(null); }} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg">保存记录</button>
            </div>
          </form>
        </div>
      )}

      {/* 录入新生表单 - 保持原有代码 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveStudent} className="bg-white rounded-[3rem] p-8 w-full max-w-2xl space-y-6 animate-in zoom-in-95 duration-200 my-8">
            <h2 className="text-2xl font-bold font-brand text-slate-800">入园信息录入</h2>
            
            {/* 基本信息 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">1</span>
                基本信息
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input required name="name" placeholder="幼儿姓名 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                <select required name="gender" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                  <option value="">性别 *</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 pl-1">出生日期 *</label>
                  <input required type="date" name="birthDate" lang="zh-CN" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                </div>
                <select required name="class" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold mt-auto">
                  <option value="">选择班级 *</option>
                  <option>小班</option><option>中班</option><option>大班</option>
                  <option>智狼班</option><option>勇熊班</option><option>灵狐班</option><option>幼狮班</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 pl-1">所属园区</label>
                <select 
                  name="campus" 
                  defaultValue={selectedStudent?.campus || currentUser.campus || '十七幼'}
                  className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                >
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
            </div>

            {/* 健康信息 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">2</span>
                健康档案
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 pl-1">身高(cm)</label>
                  <input type="number" step="0.1" name="height" placeholder="如: 105" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 pl-1">体重(kg)</label>
                  <input type="number" step="0.1" name="weight" placeholder="如: 18" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                </div>
                <select name="bloodType" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold mt-auto">
                  <option value="未知">血型</option>
                  <option value="A">A型</option><option value="B">B型</option><option value="AB">AB型</option><option value="O">O型</option>
                </select>
              </div>
              <input name="allergies" placeholder="过敏史（多个用逗号分隔，如：花生、牛奶、海鲜）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
              <input name="dietaryRestrictions" placeholder="饮食禁忌（如：不吃葱姜蒜、忌辣）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
              <textarea name="healthNotes" placeholder="健康备注（如：轻度哮喘、需定期服药等）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold resize-none" />
            </div>

            {/* 家长信息 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">3</span>
                家长信息
              </p>
              <div className="grid grid-cols-3 gap-3">
                <input required name="parent_name" placeholder="监护人姓名 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                <input required name="parent_phone" placeholder="联系电话 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                <select name="parent_relation" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                  <option value="母亲">母亲</option><option value="父亲">父亲</option>
                  <option value="爷爷">爷爷</option><option value="奶奶">奶奶</option>
                  <option value="外公">外公</option><option value="外婆">外婆</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <input name="address" placeholder="家庭住址" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
            </div>

            {/* 紧急联系人 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600">4</span>
                紧急联系人
              </p>
              <div className="grid grid-cols-3 gap-3">
                <input name="emergency_contact" placeholder="紧急联系人" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                <input name="emergency_phone" placeholder="紧急联系电话" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                <input name="emergency_relation" placeholder="与幼儿关系" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
              </div>
            </div>

            {/* 入园信息 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-purple-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">5</span>
                入园信息
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 pl-1">入园日期</label>
                  <input type="date" name="enrollDate" lang="zh-CN" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                </div>
                <input name="studentNumber" placeholder="学号（可选）" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold mt-auto" />
              </div>
              <textarea name="specialNeeds" placeholder="特殊需求说明（如：需要午睡陪伴、情绪敏感等）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold resize-none" />
            </div>

            {/* 收费设置 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">6</span>
                收费设置
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 pl-1">班型</label>
                  <select name="classType" defaultValue="standard" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                    <option value="standard">标准班</option>
                    <option value="excellence">优苗班（不足两岁）</option>
                    <option value="music">音乐班</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 pl-1">优惠类型</label>
                  <select name="discountType" defaultValue="" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                    <option value="">无优惠</option>
                    <option value="percentage">百分比折扣</option>
                    <option value="fixed">固定金额减免</option>
                    <option value="custom">自定义收费</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input name="discountValue" type="number" placeholder="优惠值（百分比或金额）" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
                <input name="discountReason" placeholder="优惠原因（如：老生、员工子女）" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
              </div>
              <textarea name="feeNotes" placeholder="收费备注（特殊情况说明，如：已缴纳代办费、床品自带等）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold resize-none" />
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-bold shadow-lg shadow-amber-100">确认入园</button>
            </div>
          </form>
        </div>
      )}
      
      {/* 查看/编辑详情弹窗 */}
      {viewDetailModal && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <img src={selectedStudent.avatar} className="w-20 h-20 rounded-3xl bg-slate-50 border-2 border-amber-100" />
                <div>
                  {isEditingStudent ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="text-2xl font-bold text-slate-800 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="姓名"
                    />
                  ) : (
                    <h2 className="text-2xl font-bold text-slate-800">{selectedStudent.name}</h2>
                  )}
                  <p className="text-sm text-slate-400">
                    {selectedStudent.gender === '男' ? '👦' : '👧'} {selectedStudent.class} · {selectedStudent.age}岁
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingStudent && (
                  <button 
                    onClick={() => {
                      setIsEditingStudent(true);
                      setEditForm({ ...selectedStudent });
                    }}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-200 transition-colors"
                  >
                    ✏️ 编辑
                  </button>
                )}
                <button onClick={() => { setViewDetailModal(false); setIsEditingStudent(false); }} className="text-slate-300 hover:text-slate-500 text-2xl">×</button>
              </div>
            </div>
            
            {/* 今日状态 */}
            {(todayRecords[selectedStudent.id] || attendanceRecords[selectedStudent.id]) && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-2xl mb-6">
                <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> 今日状态
                </h3>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  {todayRecords[selectedStudent.id]?.morningTemp && (
                    <div className={`p-2 rounded-lg text-center ${getTempStyle(todayRecords[selectedStudent.id].morningTemp)}`}>
                      <p className="text-xs opacity-70">晨检体温</p>
                      <p className="font-black">{todayRecords[selectedStudent.id].morningTemp}°C</p>
                    </div>
                  )}
                  {attendanceRecords[selectedStudent.id] && (
                    <div className="p-2 rounded-lg text-center bg-emerald-50 text-emerald-700">
                      <p className="text-xs opacity-70">考勤状态</p>
                      <p className="font-black">{attendanceRecords[selectedStudent.id].status === 'present' ? '已到' : '请假'}</p>
                    </div>
                  )}
                  {todayRecords[selectedStudent.id]?.lunchStatus && (
                    <div className="p-2 rounded-lg text-center bg-blue-50 text-blue-700">
                      <p className="text-xs opacity-70">午餐</p>
                      <p className="font-black">{todayRecords[selectedStudent.id].lunchStatus === 'all' ? '全吃' : '部分'}</p>
                    </div>
                  )}
                  {todayRecords[selectedStudent.id]?.napStatus && (
                    <div className="p-2 rounded-lg text-center bg-purple-50 text-purple-700">
                      <p className="text-xs opacity-70">午睡</p>
                      <p className="font-black">{todayRecords[selectedStudent.id].napStatus === 'good' ? '好' : '一般'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="space-y-6">
              {/* 健康档案 */}
              <div className="bg-emerald-50 p-5 rounded-2xl">
                <h3 className="font-bold text-emerald-700 mb-3 flex items-center gap-2"><Heart className="w-4 h-4" /> 健康档案</h3>
                {isEditingStudent ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-emerald-600/60 text-xs mb-1">身高 (cm)</p>
                      <input
                        type="number"
                        value={editForm.height || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, height: Number(e.target.value) || undefined }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-emerald-200 font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="身高"
                      />
                    </div>
                    <div>
                      <p className="text-emerald-600/60 text-xs mb-1">体重 (kg)</p>
                      <input
                        type="number"
                        value={editForm.weight || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, weight: Number(e.target.value) || undefined }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-emerald-200 font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="体重"
                      />
                    </div>
                    <div>
                      <p className="text-emerald-600/60 text-xs mb-1">血型</p>
                      <select
                        value={editForm.bloodType || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, bloodType: e.target.value as 'A' | 'B' | 'AB' | 'O' | '未知' }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-emerald-200 font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        <option value="">未知</option>
                        <option value="A">A型</option>
                        <option value="B">B型</option>
                        <option value="O">O型</option>
                        <option value="AB">AB型</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-emerald-600/60 text-xs">身高</p>
                      <p className="font-bold text-emerald-800">{selectedStudent.height ? `${selectedStudent.height} cm` : '未填写'}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600/60 text-xs">体重</p>
                      <p className="font-bold text-emerald-800">{selectedStudent.weight ? `${selectedStudent.weight} kg` : '未填写'}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600/60 text-xs">血型</p>
                      <p className="font-bold text-emerald-800">{selectedStudent.bloodType || '未知'}</p>
                    </div>
                  </div>
                )}
                {isEditingStudent ? (
                  <div className="mt-3 pt-3 border-t border-emerald-100">
                    <p className="text-xs text-red-500 font-bold flex items-center gap-1 mb-2"><AlertTriangle className="w-3 h-3" /> 过敏史（逗号分隔）</p>
                    <input
                      type="text"
                      value={(editForm.allergies || []).join(', ')}
                      onChange={e => setEditForm(prev => ({ ...prev, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-red-200 font-bold text-red-700 outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="如：花生, 牛奶"
                    />
                  </div>
                ) : selectedStudent.allergies && selectedStudent.allergies.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-100">
                    <p className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 过敏史</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedStudent.allergies.map((a, i) => (
                        <span key={i} className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* 家长信息 */}
              <div className="bg-blue-50 p-5 rounded-2xl">
                <h3 className="font-bold text-blue-700 mb-3 flex items-center gap-2"><Phone className="w-4 h-4" /> 家长信息</h3>
                {isEditingStudent ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600/60 text-xs mb-1">主要监护人</p>
                      <input
                        type="text"
                        value={editForm.parent_name || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, parent_name: e.target.value }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-blue-200 font-bold text-blue-800 outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="监护人姓名"
                      />
                    </div>
                    <div>
                      <p className="text-blue-600/60 text-xs mb-1">与幼儿关系</p>
                      <select
                        value={editForm.parent_relation || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, parent_relation: e.target.value as '父亲' | '母亲' | '爷爷' | '奶奶' | '外公' | '外婆' | '其他' }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-blue-200 font-bold text-blue-800 outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">请选择</option>
                        <option value="父亲">父亲</option>
                        <option value="母亲">母亲</option>
                        <option value="爷爷">爷爷</option>
                        <option value="奶奶">奶奶</option>
                        <option value="外公">外公</option>
                        <option value="外婆">外婆</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <p className="text-blue-600/60 text-xs mb-1">联系电话</p>
                      <input
                        type="tel"
                        value={editForm.parent_phone || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, parent_phone: e.target.value }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-blue-200 font-bold text-blue-800 outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="手机号码"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600/60 text-xs">主要监护人</p>
                      <p className="font-bold text-blue-800">{selectedStudent.parent_name} ({selectedStudent.parent_relation})</p>
                    </div>
                    <div>
                      <p className="text-blue-600/60 text-xs">联系电话</p>
                      <p className="font-bold text-blue-800">{selectedStudent.parent_phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 编辑模式下显示更多信息 */}
              {isEditingStudent && (
                <div className="bg-purple-50 p-5 rounded-2xl">
                  <h3 className="font-bold text-purple-700 mb-3 flex items-center gap-2">📋 基本信息</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-purple-600/60 text-xs mb-1">性别</p>
                      <select
                        value={editForm.gender || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, gender: e.target.value as '男' | '女' }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-purple-200 font-bold text-purple-800 outline-none focus:ring-2 focus:ring-purple-400"
                      >
                        <option value="男">男</option>
                        <option value="女">女</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-purple-600/60 text-xs mb-1">年龄</p>
                      <input
                        type="number"
                        value={editForm.age || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, age: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-purple-200 font-bold text-purple-800 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="年龄"
                      />
                    </div>
                    <div>
                      <p className="text-purple-600/60 text-xs mb-1">班级</p>
                      <input
                        type="text"
                        value={editForm.class || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, class: e.target.value }))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-purple-200 font-bold text-purple-800 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="班级名称"
                      />
                    </div>
                    <div>
                      <p className="text-purple-600/60 text-xs mb-1">出生日期</p>
                      <ChineseDatePicker
                        value={editForm.birthDate || ''}
                        onChange={value => setEditForm(prev => ({ ...prev, birthDate: value }))}
                        placeholder="选择出生日期"
                        className="border-purple-200 focus:ring-purple-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-4 pt-6">
              {isEditingStudent ? (
                <>
                  <button
                    onClick={() => {
                      // 保存编辑
                      const updatedStudents = students.map(s => 
                        s.id === selectedStudent.id ? { ...s, ...editForm } : s
                      );
                      setStudents(updatedStudents);
                      localStorage.setItem('kt_students', JSON.stringify(updatedStudents));
                      setSelectedStudent({ ...selectedStudent, ...editForm } as Student);
                      setIsEditingStudent(false);
                      toast.success('保存成功', '学生信息已更新');
                    }}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> 保存修改
                  </button>
                  <button 
                    onClick={() => { setIsEditingStudent(false); setEditForm({}); }}
                    className="flex-1 py-3 text-slate-400 font-bold"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => sendParentNotification(selectedStudent.id, 'daily_report', '今日在园情况', generateDailyReport(selectedStudent, todayRecords[selectedStudent.id] || {} as DailyHealthRecord))}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> 发送给家长
                  </button>
                  <button onClick={() => setViewDetailModal(false)} className="flex-1 py-3 text-slate-400 font-bold">关闭</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 二维码弹窗 - 供家长扫码 */}
      {showQRCode && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-blue-600" />
                {qrCodeStudent ? `${qrCodeStudent.name} 接送二维码` : '选择学生扫码'}
              </h2>
              <button onClick={() => { setShowQRCode(false); setQrCodeStudent(null); }} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {qrCodeStudent ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl inline-block">
                  <QRCodeSVG 
                    value={`${window.location.origin}/pickup?student=${qrCodeStudent.id}&name=${encodeURIComponent(qrCodeStudent.name)}`}
                    size={200}
                    level="H"
                    includeMargin
                    className="rounded-xl"
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-slate-600 text-sm">
                    <Smartphone className="w-4 h-4 inline mr-1" />
                    家长扫描二维码，自助填写接送信息
                  </p>
                  <p className="text-xs text-slate-400">
                    首次扫码需填写完整信息，之后自动记住
                  </p>
                </div>
                
                {/* 生产环境下家长通过扫码自动跳转到填写页面 */}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-500 mb-6">选择学生生成接送二维码</p>
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                  {students.map(student => (
                    <button
                      key={student.id}
                      onClick={() => setQrCodeStudent(student)}
                      className="p-4 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <img src={student.avatar} className="w-10 h-10 rounded-lg" />
                        <div>
                          <p className="font-bold text-slate-800">{student.name}</p>
                          <p className="text-xs text-slate-400">{student.class}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 家长扫码页面 - 自助填写接送信息 */}
      {showParentScanPage && parentScanStudentId && (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 z-50 flex flex-col overflow-y-auto">
          <div className="p-4 flex justify-between items-center text-white">
            <h1 className="text-lg font-bold">金星幼儿园 · 接送登记</h1>
            <button onClick={() => { setShowParentScanPage(false); setParentScanStudentId(null); }} className="p-2 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md mx-auto shadow-2xl">
              {(() => {
                const student = students.find(s => s.id === parentScanStudentId);
                const savedInfo = getSavedPickerInfo();
                if (!student) return <p className="text-center text-slate-500">学生信息加载中...</p>;
                
                return (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const pickerInfo = {
                      name: fd.get('pickerName') as string,
                      relation: fd.get('pickerRelation') as string,
                      phone: fd.get('pickerPhone') as string,
                      idLast4: fd.get('pickerIdLast4') as string,
                    };
                    
                    // 保存家长信息
                    savePickerInfo(pickerInfo);
                    
                    // 创建接送记录
                    const newRecord: PickupRecord = {
                      id: Date.now().toString(),
                      studentId: student.id,
                      date: today,
                      type: fd.get('type') as 'pickup' | 'dropoff',
                      time: new Date().toLocaleTimeString('zh-CN'),
                      pickerName: pickerInfo.name,
                      pickerRelation: pickerInfo.relation,
                      pickerPhone: pickerInfo.phone,
                      pickerIdLast4: pickerInfo.idLast4,
                      verifiedBy: '自助扫码',
                      notes: fd.get('notes') as string,
                    };
                    
                    const updated = [newRecord, ...pickupRecords];
                    setPickupRecords(updated);
                    localStorage.setItem('kt_pickup_records', JSON.stringify(updated));
                    
                    alert(`✅ ${student.name} ${fd.get('type') === 'dropoff' ? '入园' : '离园'}登记成功！`);
                    setShowParentScanPage(false);
                    setParentScanStudentId(null);
                  }} className="space-y-6">
                    {/* 学生信息 */}
                    <div className="text-center pb-4 border-b border-slate-100">
                      <img src={student.avatar} className="w-20 h-20 rounded-2xl mx-auto mb-3 border-4 border-blue-100" />
                      <h2 className="text-xl font-bold text-slate-800">{student.name}</h2>
                      <p className="text-sm text-slate-400">{student.class} · {student.campus}</p>
                    </div>
                    
                    {/* 接送类型 */}
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex flex-col items-center gap-2 p-4 border-2 rounded-2xl cursor-pointer hover:border-blue-500 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 transition-all">
                        <input type="radio" name="type" value="dropoff" defaultChecked className="hidden" />
                        <span className="text-3xl">📥</span>
                        <span className="font-bold text-slate-700">送入园</span>
                      </label>
                      <label className="flex flex-col items-center gap-2 p-4 border-2 rounded-2xl cursor-pointer hover:border-green-500 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 transition-all">
                        <input type="radio" name="type" value="pickup" className="hidden" />
                        <span className="text-3xl">📤</span>
                        <span className="font-bold text-slate-700">接离园</span>
                      </label>
                    </div>
                    
                    {/* 接送人信息 - 自动填充已保存信息 */}
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        接送人信息 {savedInfo && <span className="text-green-500">（已记住）</span>}
                      </p>
                      
                      <input 
                        required 
                        name="pickerName" 
                        defaultValue={savedInfo?.name || ''} 
                        placeholder="您的姓名 *" 
                        className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg" 
                      />
                      
                      <select 
                        required 
                        name="pickerRelation" 
                        defaultValue={savedInfo?.relation || ''} 
                        className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                      >
                        <option value="">与孩子的关系 *</option>
                        <option value="父亲">父亲</option>
                        <option value="母亲">母亲</option>
                        <option value="爷爷">爷爷</option>
                        <option value="奶奶">奶奶</option>
                        <option value="外公">外公</option>
                        <option value="外婆">外婆</option>
                        <option value="其他亲属">其他亲属</option>
                        <option value="保姆">保姆</option>
                      </select>
                      
                      <input 
                        required 
                        name="pickerPhone" 
                        defaultValue={savedInfo?.phone || ''} 
                        placeholder="手机号码 *" 
                        type="tel"
                        className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg" 
                      />
                      
                      <input 
                        name="pickerIdLast4" 
                        defaultValue={savedInfo?.idLast4 || ''} 
                        placeholder="身份证后四位（选填）" 
                        maxLength={4}
                        className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg" 
                      />
                      
                      <textarea 
                        name="notes" 
                        placeholder="备注（选填）" 
                        rows={2}
                        className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none" 
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                    >
                      ✓ 确认登记
                    </button>
                    
                    <p className="text-xs text-center text-slate-400">
                      您的信息将被安全保存，下次自动填充
                    </p>
                  </form>
                );
              })()}
            </div>
          </div>
          
          <div className="p-4 text-center text-white/60 text-xs">
            金星教育集团 · 齐德科技提供技术支持
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsView;
