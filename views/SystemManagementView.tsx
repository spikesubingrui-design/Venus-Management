
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Users, 
  PhoneCall, 
  Search,
  XCircle,
  AlertTriangle,
  Lock,
  History,
  Database,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  CheckCircle2,
  Loader2,
  CloudOff,
  Leaf,
  TreeDeciduous,
  Sprout,
  Edit3,
  X
} from 'lucide-react';
import { User, UserRole } from '../types';
import OperationLogsViewer from '../components/OperationLogsViewer';
import { checkAliyunHealth, isAliyunConfigured, initializeFromAliyun, getSyncStatus, resetCloudStudents, deleteCloudData, uploadAllToAliyun } from '../services/aliyunOssService';
import { saveAndSync } from '../services/storageService';

interface SystemManagementViewProps {
  currentUser: User;
}

// 授权手机号数据类型（包含完整教职工信息）
interface AuthorizedPhone {
  phone: string;
  name?: string;
  gender?: string;
  campus?: string;
  role?: string;        // 系统角色 TEACHER/ADMIN 等
  position?: string;    // 职务名称（园长、班长、配班等）
  assignedClass?: string; // 分配班级
  department?: string;  // 部门
  is_used?: boolean;
  created_at?: string;
}

const SystemManagementView: React.FC<SystemManagementViewProps> = ({ currentUser }) => {
  const [authorizedPhones, setAuthorizedPhones] = useState<AuthorizedPhone[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneName, setNewPhoneName] = useState('');
  const [newPhoneGender, setNewPhoneGender] = useState('女');
  const [newPhoneCampus, setNewPhoneCampus] = useState('总园');
  const [newPhoneRole, setNewPhoneRole] = useState('TEACHER');
  const [newPhonePosition, setNewPhonePosition] = useState('');
  const [newPhoneClass, setNewPhoneClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AuthorizedPhone>({} as AuthorizedPhone);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'phones' | 'users' | 'logs' | 'cloud'>('phones');
  
  // 动态班级和职务列表（从实际数据中读取）
  const [classList, setClassList] = useState<string[]>([]);
  const [positionList, setPositionList] = useState<string[]>([]);
  
  // 云同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, key: '' });
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cloudHealth, setCloudHealth] = useState<{ isHealthy: boolean; latency?: number } | null>(null);

  useEffect(() => {
    loadData();
    loadClassesAndPositions();
  }, []);

  // 从学生和教职工数据中动态提取班级和职务列表
  const loadClassesAndPositions = () => {
    const students = JSON.parse(localStorage.getItem('kt_students') || '[]');
    const teachers = JSON.parse(localStorage.getItem('kt_teachers') || '[]');
    const ossStaff = JSON.parse(localStorage.getItem('kt_staff') || '[]');
    
    const classSet = new Set<string>();
    students.forEach((s: any) => { if (s.class) classSet.add(s.class); });
    teachers.forEach((t: any) => { 
      if (t.assignedClass) classSet.add(t.assignedClass);
      if (t.class) classSet.add(t.class);
    });
    ossStaff.forEach((s: any) => { 
      if (s.class) classSet.add(s.class);
      if (Array.isArray(s.assignedClasses)) s.assignedClasses.forEach((c: string) => classSet.add(c));
    });
    
    const classOrder = (name: string) => {
      if (name.includes('悦芽') || name.includes('托')) return 1;
      if (name.includes('花开') || name.includes('小')) return 2;
      if (name.includes('书田') || name.includes('中')) return 3;
      if (name.includes('星语') || name.includes('大')) return 4;
      return 5;
    };
    const sortedClasses = Array.from(classSet).filter(Boolean).sort((a, b) => {
      const orderDiff = classOrder(a) - classOrder(b);
      return orderDiff !== 0 ? orderDiff : a.localeCompare(b, 'zh-CN');
    });
    setClassList(sortedClasses);
    
    const positionSet = new Set<string>();
    ['园长', '副园长', '保教主任', '后勤主任', '班长', '配班', '保育员', 
     '美术老师', '舞蹈老师', '英语老师', '体育老师', '音乐老师',
     '厨师长', '帮厨', '门卫', '保洁', '保健医生', '财务'].forEach(p => positionSet.add(p));
    teachers.forEach((t: any) => { if (t.role) positionSet.add(t.role); if (t._ossPosition) positionSet.add(t._ossPosition); });
    ossStaff.forEach((s: any) => { if (s.position) positionSet.add(s.position); if (s.role && s.role !== 'TEACHER' && s.role !== 'ADMIN') positionSet.add(s.role); });
    
    setPositionList(Array.from(positionSet).filter(Boolean));
  };

  // 加载数据（从本地存储，阿里云OSS负责同步）
  const loadData = async () => {
    // 从本地存储加载数据
    const phones = JSON.parse(localStorage.getItem('kt_authorized_phones') || '[]');
    const users = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
    
    // 处理手机号格式：兼容旧格式（纯字符串）和新格式（对象）
    if (phones.length > 0) {
      if (typeof phones[0] === 'string') {
        // 旧格式：尝试从教职工列表关联信息
        const teachers = JSON.parse(localStorage.getItem('kt_teachers') || '[]');
        const ossStaff = JSON.parse(localStorage.getItem('kt_staff') || '[]');
        const allStaff = [...teachers, ...ossStaff];
        const staffMap = new Map(allStaff.filter((t: any) => t.phone).map((t: any) => [t.phone.replace(/\D/g, ''), t]));
        
        const enriched = phones.map((p: string) => {
          const cleanPhone = p.replace(/\D/g, '');
          const teacher = staffMap.get(cleanPhone);
          if (teacher) {
            return {
              phone: cleanPhone,
              name: teacher.name || '',
              gender: teacher.gender || '',
              campus: teacher.campus || '',
              role: teacher.role || 'TEACHER',
              position: teacher.position || teacher.role || '',
              assignedClass: teacher.assignedClass || (Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses[0] : '') || teacher.class || '',
              is_used: users.some((u: any) => u.phone === cleanPhone),
            };
          }
          return { phone: cleanPhone };
        });
        setAuthorizedPhones(enriched);
      } else {
        setAuthorizedPhones(phones);
      }
    }
    setAllUsers(users);
    
    // 检查阿里云健康状态
    if (isAliyunConfigured) {
      checkAliyunHealth().then(setCloudHealth);
    }
  };

  // 执行云同步
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      await initializeFromAliyun();
      setSyncResult({ success: true, message: '同步完成！数据已安全保存到阿里云。' });
    } catch (error) {
      setSyncResult({ success: false, message: '同步出错，请检查网络连接。' });
    } finally {
      setIsSyncing(false);
      // 刷新云端状态
      checkAliyunHealth().then(setCloudHealth);
    }
  };

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    // 清理手机号格式（只保留数字）
    const cleanPhone = newPhone.replace(/\D/g, '');
    
    if (!cleanPhone || cleanPhone.length !== 11) {
      alert('请输入正确的11位手机号');
      return;
    }
    
    if (authorizedPhones.find(p => p.phone === cleanPhone)) {
      alert('该手机号已在授权列表中');
      return;
    }

    const newAuthorizedPhone: AuthorizedPhone = {
      phone: cleanPhone,
      name: newPhoneName,
      gender: newPhoneGender,
      campus: newPhoneCampus,
      role: newPhoneRole,
      position: newPhonePosition,
      assignedClass: newPhoneClass,
      is_used: false,
      created_at: new Date().toISOString()
    };
    
    // 本地添加授权手机号
    const updated = [...authorizedPhones, newAuthorizedPhone];
    setAuthorizedPhones(updated);
    saveAndSync('kt_authorized_phones', updated);
    
    // 同时添加到 kt_staff 和 kt_teachers（非家长角色）
    if (newPhoneRole !== 'PARENT') {
      const staffList: any[] = JSON.parse(localStorage.getItem('kt_staff') || '[]');
      const teacherList: any[] = JSON.parse(localStorage.getItem('kt_teachers') || '[]');
      
      // 检查是否已存在
      const existsInStaff = staffList.some((s: any) => s.phone === cleanPhone);
      const existsInTeachers = teacherList.some((t: any) => t.phone === cleanPhone);
      
      if (!existsInStaff) {
        const newStaffEntry = {
          id: `staff_${cleanPhone}_${Date.now()}`,
          name: newPhoneName, phone: cleanPhone, gender: newPhoneGender,
          class: newPhoneClass, className: newPhoneClass,
          position: newPhonePosition, campus: newPhoneCampus,
          role: newPhoneRole, assignedClasses: newPhoneClass ? [newPhoneClass] : [],
          hireDate: new Date().toISOString().split('T')[0], status: 'active',
        };
        staffList.push(newStaffEntry);
        saveAndSync('kt_staff', staffList);
        console.log(`[SystemMgmt] ✅ 同步新增到 kt_staff: ${newPhoneName}`);
      }
      
      if (!existsInTeachers) {
        const newTeacherEntry = {
          id: `staff_${cleanPhone}_${Date.now()}`,
          name: newPhoneName, phone: cleanPhone, role: newPhonePosition || newPhoneRole,
          assignedClass: newPhoneClass, campus: newPhoneCampus,
          hireDate: new Date().toISOString().split('T')[0], status: 'active',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newPhoneName)}&background=${newPhoneGender === '男' ? '4A90A4' : 'E879A0'}&color=fff&size=128`,
          performanceScore: 95, education: '本科', certificates: [],
          _ossRole: newPhoneRole, _ossPosition: newPhonePosition,
          _ossClass: newPhoneClass, _ossCampus: newPhoneCampus, _ossGender: newPhoneGender,
        };
        teacherList.push(newTeacherEntry);
        saveAndSync('kt_teachers', teacherList);
        console.log(`[SystemMgmt] ✅ 同步新增到 kt_teachers: ${newPhoneName}`);
      }
    }
    
    setNewPhone('');
    setNewPhoneName('');
    setNewPhonePosition('');
    setNewPhoneClass('');
    console.log('已添加授权:', cleanPhone, newPhoneName);
  };

  const handleDeletePhone = async (phone: string) => {
    // 本地删除
    const updated = authorizedPhones.filter(p => p.phone !== phone);
    setAuthorizedPhones(updated);
    saveAndSync('kt_authorized_phones', updated);
  };

  // 开始编辑
  const handleStartEdit = (p: AuthorizedPhone) => {
    setEditingPhone(p.phone);
    setEditForm({ ...p });
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingPhone) return;
    const updated = authorizedPhones.map(p => 
      p.phone === editingPhone ? { ...p, ...editForm } : p
    );
    setAuthorizedPhones(updated);
    saveAndSync('kt_authorized_phones', updated);
    setEditingPhone(null);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingPhone(null);
    setEditForm({} as AuthorizedPhone);
  };

  const handleDeleteUser = async (userId: string) => {
    // 本地删除
    const updated = allUsers.filter(u => u.id !== userId);
    setAllUsers(updated);
    saveAndSync('kt_all_users', updated);
    
    // 同时删除密码
    const passwords = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
    const userToDelete = allUsers.find(u => u.id === userId);
    if (userToDelete) {
      delete passwords[userToDelete.phone];
      localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));
    }
  };

  // 从教职工列表导入手机号到授权名单（带完整信息）
  const handleImportTeacherPhones = async () => {
    // 同时从 kt_teachers（网页格式）和 kt_staff（OSS格式）加载，取最全的
    const webTeachers = JSON.parse(localStorage.getItem('kt_teachers') || '[]');
    const ossStaff = JSON.parse(localStorage.getItem('kt_staff') || '[]');
    const teachers = webTeachers.length >= ossStaff.length ? webTeachers : ossStaff;
    
    if (teachers.length === 0) {
      alert('暂无教职工数据，请先在"教职工管理"中添加教职工');
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    const existingMap = new Map(authorizedPhones.map(p => [typeof p === 'string' ? p : p.phone, p]));
    const newList: AuthorizedPhone[] = [];

    for (const teacher of teachers) {
      if (!teacher.phone) continue;
      
      const cleanPhone = teacher.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 11) continue;
      
      const enrichedPhone: AuthorizedPhone = {
        phone: cleanPhone,
        name: teacher.name || '',
        gender: teacher.gender || teacher._ossGender || '',
        campus: teacher.campus || teacher._ossCampus || currentUser.campus || '总园',
        role: teacher._ossRole || teacher.role || 'TEACHER',
        position: teacher._ossPosition || teacher.position || teacher.role || '',
        assignedClass: teacher.assignedClass || (Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses[0] : '') || teacher.class || teacher._ossClass || '',
        department: teacher.department || '',
        is_used: allUsers.some(u => u.phone === cleanPhone),
        created_at: new Date().toISOString()
      };

      if (existingMap.has(cleanPhone)) {
        // 更新已有记录的信息
        updatedCount++;
      } else {
        addedCount++;
      }
      newList.push(enrichedPhone);
      existingMap.set(cleanPhone, enrichedPhone);
    }

    // 保留不在教职工列表中的手动添加的号码
    const teacherPhones = new Set(newList.map(p => p.phone));
    const manualPhones = authorizedPhones.filter(p => {
      const phone = typeof p === 'string' ? p : p.phone;
      return !teacherPhones.has(phone);
    });

    const finalList = [...newList, ...manualPhones];
    setAuthorizedPhones(finalList);
    saveAndSync('kt_authorized_phones', finalList);

    alert(`导入完成！\n✅ 新增授权: ${addedCount} 人\n🔄 更新信息: ${updatedCount} 人\n📋 教职工总数: ${teachers.length} 人\n📌 授权总数: ${finalList.length} 人`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {/* 装饰元素 */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
        <TreeDeciduous className="w-full h-full text-[#4a5d3a]" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl shadow-lg" style={{ backgroundColor: '#4a5d3a' }}>
            <ShieldCheck className="w-8 h-8 text-[#c9dbb8]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#4a5d3a', fontFamily: "'Noto Serif SC', serif" }}>
              系统总管中心
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: '#8b7355' }}>
              <Leaf className="w-4 h-4" style={{ color: '#4a5d3a' }} />
              生产环境安全加密连接已激活
            </p>
          </div>
        </div>
        <div className="flex p-1.5 rounded-2xl" style={{ backgroundColor: '#f5f2ed', border: '1px solid #e8e4dc' }}>
          {[
            { id: 'phones', label: '预授权', icon: PhoneCall },
            { id: 'users', label: '用户库', icon: Users },
            { id: 'logs', label: '操作日志', icon: History },
            { id: 'cloud', label: '云同步', icon: Cloud },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'text-white shadow-lg' 
                  : 'hover:bg-[#4a5d3a]/10'
              }`}
              style={{ 
                backgroundColor: activeTab === tab.id ? '#4a5d3a' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#6b7c5c'
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {activeTab === 'phones' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">授权名单</h3>
                  <p className="text-slate-400 text-xs mt-1">仅限名单内的号码注册入园</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleImportTeacherPhones}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    导入教职工
                  </button>
                  <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">{authorizedPhones.length} 个席位</span>
                </div>
              </div>
              
              <div className="p-10">
                {/* 搜索栏 */}
                <div className="mb-6">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索姓名、手机号、园区、班级..."
                    className="w-full px-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 outline-none transition-all text-sm"
                  />
                </div>

                {/* 手动添加表单 */}
                <form onSubmit={handleAddPhone} className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 mb-4">手动添加授权</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <input 
                      type="text"
                      value={newPhoneName}
                      onChange={(e) => setNewPhoneName(e.target.value)}
                      placeholder="姓名"
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    />
                    <div className="relative">
                      <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="手机号 *"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        required
                      />
                    </div>
                    <select 
                      value={newPhoneGender}
                      onChange={(e) => setNewPhoneGender(e.target.value)}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      <option value="女">女</option>
                      <option value="男">男</option>
                    </select>
                    <select 
                      value={newPhoneCampus}
                      onChange={(e) => setNewPhoneCampus(e.target.value)}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      <option value="总园">总园（集团总部）</option>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <select
                      value={newPhonePosition}
                      onChange={(e) => setNewPhonePosition(e.target.value)}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      <option value="">选择职务</option>
                      {positionList.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <select
                      value={newPhoneClass}
                      onChange={(e) => setNewPhoneClass(e.target.value)}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      <option value="">选择班级（可选）</option>
                      {classList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select 
                      value={newPhoneRole}
                      onChange={(e) => setNewPhoneRole(e.target.value)}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      <option value="TEACHER">教师</option>
                      <option value="ADMIN">管理员</option>
                      <option value="HEALTH_TEACHER">保健医生</option>
                      <option value="KITCHEN">厨房</option>
                      <option value="SECURITY">安保</option>
                      <option value="PARENT">家长</option>
                    </select>
                    <button type="submit" className="bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      添加授权
                    </button>
                  </div>
                </form>

                {/* 授权名单表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b-2 border-slate-100">
                        <th className="pb-4 pl-4">状态</th>
                        <th className="pb-4">姓名</th>
                        <th className="pb-4">性别</th>
                        <th className="pb-4">手机号</th>
                        <th className="pb-4">园区</th>
                        <th className="pb-4">职务</th>
                        <th className="pb-4">班级</th>
                        <th className="pb-4">角色</th>
                        <th className="pb-4 text-right pr-4">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {authorizedPhones
                        .filter(p => {
                          if (!searchQuery) return true;
                          const q = searchQuery.toLowerCase();
                          const phone = typeof p === 'string' ? p : p.phone;
                          const name = typeof p === 'string' ? '' : (p.name || '');
                          const campus = typeof p === 'string' ? '' : (p.campus || '');
                          const cls = typeof p === 'string' ? '' : (p.assignedClass || '');
                          const pos = typeof p === 'string' ? '' : (p.position || '');
                          return phone.includes(q) || name.includes(q) || campus.includes(q) || cls.includes(q) || pos.includes(q);
                        })
                        .map((p) => {
                          const phoneNumber = typeof p === 'string' ? p : p.phone;
                          const name = typeof p === 'string' ? '' : (p.name || '');
                          const gender = typeof p === 'string' ? '' : (p.gender || '');
                          const campus = typeof p === 'string' ? '' : (p.campus || '');
                          const position = typeof p === 'string' ? '' : (p.position || '');
                          const assignedClass = typeof p === 'string' ? '' : (p.assignedClass || '');
                          const role = typeof p === 'string' ? '' : (p.role || '');
                          const isUsed = typeof p === 'string' ? false : p.is_used;
                          const isRegistered = allUsers.some(u => u.phone === phoneNumber) || isUsed;
                          
                          const roleLabel: Record<string, string> = {
                            'TEACHER': '教师', 'ADMIN': '管理员', 'HEALTH_TEACHER': '保健医生',
                            'KITCHEN': '厨房', 'SECURITY': '安保', 'PARENT': '家长',
                            'SUPER_ADMIN': '超级管理员'
                          };
                          
                          const isEditing = editingPhone === phoneNumber;
                          const editCls = "px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none w-full";
                          const selectCls = "px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-amber-500/30 outline-none";
                          
                          return (
                            <tr key={phoneNumber} className={`group transition-colors ${isEditing ? 'bg-amber-50/80' : 'hover:bg-amber-50/50'}`}>
                              <td className="py-3 pl-4">
                                <div className={`w-3 h-3 rounded-full ${isRegistered ? 'bg-emerald-500' : 'bg-slate-200'}`} 
                                  title={isRegistered ? '已激活' : '等待准入'} />
                              </td>
                              <td className="py-3">
                                {isEditing ? (
                                  <input value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className={editCls} placeholder="姓名" />
                                ) : (
                                  <span className="font-bold text-slate-800 text-sm">{name || <span className="text-slate-300">-</span>}</span>
                                )}
                              </td>
                              <td className="py-3">
                                {isEditing ? (
                                  <select value={editForm.gender || ''} onChange={e => setEditForm({...editForm, gender: e.target.value})} className={selectCls}>
                                    <option value="">-</option>
                                    <option value="女">女</option>
                                    <option value="男">男</option>
                                  </select>
                                ) : gender ? (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gender === '男' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>{gender}</span>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="py-3">
                                <span className="font-mono font-bold text-slate-700 text-sm tracking-wider">{phoneNumber}</span>
                              </td>
                              <td className="py-3">
                                {isEditing ? (
                                  <select value={editForm.campus || ''} onChange={e => setEditForm({...editForm, campus: e.target.value})} className={selectCls}>
                                    <option value="">-</option>
                                    <option value="总园">总园</option>
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
                                ) : campus ? (
                                  <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{campus}</span>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="py-3">
                                {isEditing ? (
                                  <select value={editForm.position || ''} onChange={e => setEditForm({...editForm, position: e.target.value})} className={selectCls}>
                                    <option value="">选择职务</option>
                                    {positionList.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                  </select>
                                ) : position ? (
                                  <span className="text-xs font-bold text-slate-600">{position}</span>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="py-3">
                                {isEditing ? (
                                  <select value={editForm.assignedClass || ''} onChange={e => setEditForm({...editForm, assignedClass: e.target.value})} className={selectCls}>
                                    <option value="">选择班级</option>
                                    {classList.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                ) : assignedClass ? (
                                  <span className="text-xs font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{assignedClass}</span>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="py-3">
                                {isEditing ? (
                                  <select value={editForm.role || ''} onChange={e => setEditForm({...editForm, role: e.target.value})} className={selectCls}>
                                    <option value="TEACHER">教师</option>
                                    <option value="ADMIN">管理员</option>
                                    <option value="HEALTH_TEACHER">保健医生</option>
                                    <option value="KITCHEN">厨房</option>
                                    <option value="SECURITY">安保</option>
                                    <option value="PARENT">家长</option>
                                  </select>
                                ) : (
                                  <span className="text-xs font-bold text-slate-500">{roleLabel[role] || role || '-'}</span>
                                )}
                              </td>
                              <td className="py-3 text-right pr-4">
                                {isEditing ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <button onClick={handleSaveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="保存">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleCancelEdit} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="取消">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleStartEdit(p)} className="p-1.5 text-slate-300 hover:text-amber-600 transition-colors" title="编辑">
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeletePhone(phoneNumber)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors" title="删除">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-10 border-b border-slate-100 bg-slate-50/30">
                <h3 className="text-xl font-bold text-slate-800">活跃成员库</h3>
                <p className="text-slate-400 text-xs mt-1">管理当前已在系统内激活的教职工与家长</p>
              </div>
              <div className="p-10 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50">
                      <th className="pb-6">身份信息</th>
                      <th className="pb-6">联系方式</th>
                      <th className="pb-6">权限等级</th>
                      <th className="pb-6 text-right">管控</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allUsers.map((u) => {
                      // 角色中文映射
                      const roleNames: Record<string, string> = {
                        'SUPER_ADMIN': '超级管理员',
                        'ADMIN': '园区管理员',
                        'TEACHER': '教师',
                        'KITCHEN': '厨房人员',
                        'PARENT': '家长'
                      };
                      const roleColors: Record<string, string> = {
                        'SUPER_ADMIN': 'bg-purple-100 text-purple-700',
                        'ADMIN': 'bg-amber-100 text-amber-700',
                        'TEACHER': 'bg-blue-100 text-blue-700',
                        'KITCHEN': 'bg-emerald-100 text-emerald-700',
                        'PARENT': 'bg-pink-100 text-pink-700'
                      };
                      return (
                        <tr key={u.id} className="group hover:bg-slate-50/30 transition-colors">
                          <td className="py-6">
                            <div className="flex items-center gap-4">
                              <img src={u.avatar} className="w-12 h-12 rounded-2xl object-cover shadow-sm ring-2 ring-white" />
                              <div>
                                <span className="font-black text-slate-800 block">{u.name}</span>
                                {u.campus && <span className="text-xs text-slate-400">{u.campus}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-6 font-bold text-slate-500">{u.phone}</td>
                          <td className="py-6">
                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black tracking-widest ${
                              roleColors[u.role] || 'bg-slate-100 text-slate-600'
                            }`}>
                              {roleNames[u.role] || u.role}
                            </span>
                          </td>
                          <td className="py-6 text-right">
                            {u.role !== 'SUPER_ADMIN' && (
                              <button onClick={() => handleDeleteUser(u.id)} className="p-3 text-slate-200 hover:text-rose-600 transition-colors">
                                <Trash2 className="w-5 h-5" />
                              </button>
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

          {activeTab === 'logs' && (
            <OperationLogsViewer />
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-8">
              {/* 云端状态卡片 */}
              <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-[2.5rem] p-10 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white/10 rounded-2xl">
                      <Cloud className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">阿里云 OSS 云端存储</h3>
                      <p className="text-white/70 text-sm">国内高速访问，实时自动同步</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAliyunConfigured ? (
                      <>
                        <div className={`w-3 h-3 rounded-full ${cloudHealth?.isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-300'}`} />
                        <span className="text-sm font-bold text-white/80">
                          {cloudHealth?.isHealthy ? `已连接 (${cloudHealth.latency}ms)` : '检测中...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full bg-rose-300" />
                        <span className="text-sm font-bold text-rose-200">未配置</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 实时同步状态 */}
                {isAliyunConfigured && cloudHealth?.isHealthy && (
                  <div className="p-6 bg-white/20 rounded-2xl flex items-center gap-4 mb-6">
                    <div className="relative">
                      <RefreshCw className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    </div>
                    <div>
                      <p className="font-black text-white">实时同步已启用</p>
                      <p className="text-white/70 text-sm">数据变更将在0.5秒内自动同步到阿里云</p>
                    </div>
                  </div>
                )}

                {/* 同步特性说明 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 bg-white/10 rounded-2xl">
                    <CloudUpload className="w-8 h-8 text-white mb-3" />
                    <p className="font-black text-white mb-1">自动上传</p>
                    <p className="text-white/60 text-xs">本地数据变更时自动同步到阿里云</p>
                  </div>
                  <div className="p-6 bg-white/10 rounded-2xl">
                    <CloudDownload className="w-8 h-8 text-white mb-3" />
                    <p className="font-black text-white mb-1">启动同步</p>
                    <p className="text-white/60 text-xs">应用启动时自动拉取云端最新数据</p>
                  </div>
                  <div className="p-6 bg-white/10 rounded-2xl">
                    <RefreshCw className="w-8 h-8 text-white mb-3" />
                    <p className="font-black text-white mb-1">国内高速</p>
                    <p className="text-white/60 text-xs">华北2（北京）节点，无需VPN</p>
                  </div>
                </div>

                {/* 手动同步按钮（备用） */}
                <div className="mt-6 pt-6 border-t border-white/20 space-y-3">
                  <button
                    onClick={() => handleSync()}
                    disabled={isSyncing || !isAliyunConfigured}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-5 h-5 text-white/70 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="text-white/70 text-sm font-bold">
                      {isSyncing ? '同步中...' : '手动强制同步（一般无需使用）'}
                    </span>
                  </button>
                  
                  {/* 重置云端学生数据 */}
                  <button
                    onClick={async () => {
                      if (!window.confirm('⚠️ 警告：这将删除云端所有学生数据，然后上传当前本地数据。\n\n确定要重置云端学生数据吗？')) return;
                      setIsSyncing(true);
                      try {
                        const result = await resetCloudStudents();
                        if (result.success) {
                          setSyncResult({ success: true, message: `✅ 云端学生数据已重置: ${result.count} 人` });
                        } else {
                          setSyncResult({ success: false, message: '❌ 重置失败' });
                        }
                      } catch (err: any) {
                        setSyncResult({ success: false, message: `❌ 错误: ${err.message}` });
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    disabled={isSyncing || !isAliyunConfigured}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-rose-500/30 hover:bg-rose-500/50 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-5 h-5 text-rose-300" />
                    <span className="text-rose-300 text-sm font-bold">
                      🔄 重置云端学生数据（解决数据重复问题）
                    </span>
                  </button>
                  
                  {/* 上传本地数据到云端 */}
                  <button
                    onClick={async () => {
                      if (!window.confirm('将本地所有数据上传到云端（会覆盖云端数据）。\n\n确定要上传吗？')) return;
                      setIsSyncing(true);
                      try {
                        const result = await uploadAllToAliyun();
                        if (result.success) {
                          setSyncResult({ success: true, message: '✅ 本地数据已上传到云端' });
                        } else {
                          setSyncResult({ success: false, message: '❌ 上传失败' });
                        }
                      } catch (err: any) {
                        setSyncResult({ success: false, message: `❌ 错误: ${err.message}` });
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    disabled={isSyncing || !isAliyunConfigured}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-emerald-500/30 hover:bg-emerald-500/50 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CloudUpload className="w-5 h-5 text-emerald-300" />
                    <span className="text-emerald-300 text-sm font-bold">
                      📤 上传本地数据到云端
                    </span>
                  </button>
                </div>

                {syncResult && (
                  <div className={`mt-4 p-4 rounded-2xl ${syncResult.success ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`}>
                    <p className="text-white text-sm font-bold">{syncResult.message}</p>
                  </div>
                )}
              </div>

              {/* 数据统计 */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200">
                <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
                  <Database className="w-5 h-5 text-amber-600" />
                  本地数据统计
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: '幼儿档案', key: 'kt_students', color: 'amber' },
                    { label: '教职工', key: 'kt_staff', color: 'blue' },
                    { label: '操作日志', key: 'kt_operation_logs', color: 'emerald' },
                    { label: '日历事件', key: 'kt_calendar_events', color: 'purple' },
                  ].map(item => {
                    const data = JSON.parse(localStorage.getItem(item.key) || '[]');
                    return (
                      <div key={item.key} className="text-center p-6 bg-slate-50 rounded-2xl">
                        <p className={`text-3xl font-black text-${item.color}-600`}>{data.length}</p>
                        <p className="text-slate-500 text-sm font-bold mt-1">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SystemManagementView;
