
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, UserSquare2, MessageSquare, BookOpen, Sparkles,
  Bell, Search, Menu, UtensilsCrossed, LogOut, ShieldCheck, Globe, Shield, Folder, Calendar,
  Calculator, FileText, Wrench, BarChart3, AlertTriangle
} from 'lucide-react';
import { AppView, User, UserRole } from './types';
import DashboardView from './views/DashboardView';
import StudentsView from './views/StudentsView';
import StaffView from './views/StaffView';
import CommunicationView from './views/CommunicationView';
import CurriculumView from './views/CurriculumView';
import AIAssistantView from './views/AIAssistantView';
import KitchenView from './views/KitchenView';
import SafetyView from './views/SafetyView';
import DocumentView from './views/DocumentView';
import AuthView from './views/AuthView';
import SystemManagementView from './views/SystemManagementView';
import CalendarView from './views/CalendarView';
import FinanceView from './views/FinanceView';
import ObservationView from './views/ObservationView';
import GrowthArchiveView from './views/GrowthArchiveView';
import MaintenanceView from './views/MaintenanceView';
import DataCockpitView from './views/DataCockpitView';
import AnomalyMonitorView from './views/AnomalyMonitorView';
import { getRoleName } from './services/permissionService';
import { initializeData } from './services/dataInitService';
import { initializeFromAliyun, isAliyunConfigured } from './services/aliyunOssService';

// 导入金星logo高清图片
import logoImg from './金星logo高清.png';

export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg', hideText?: boolean, light?: boolean }> = ({ size = 'md', hideText = false, light = false }) => {
  const imgSize = size === 'sm' ? 'h-12 w-12' : size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';
  return (
    <div className="flex items-center gap-3 shrink-0">
      <img 
        src={logoImg} 
        alt="金星教育 Kidda" 
        className={`${imgSize} object-contain drop-shadow-sm`}
        style={{ imageRendering: 'auto' }}
      />
      {!hideText && (
        <div className="flex flex-col">
          <span className={`font-bold ${size === 'lg' ? 'text-2xl' : 'text-lg'} ${light ? 'text-white' : 'text-slate-800'} font-brand tracking-tighter`}>金星教育系统</span>
          <span className={`text-[9px] ${light ? 'text-amber-200' : 'text-amber-700'} font-black tracking-widest uppercase opacity-80`}>Kidda Education Group</span>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('kt_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 初始化数据（导入教职工和学生）
  useEffect(() => {
    const result = initializeData();
    if (result.staffCount > 0 || result.studentCount > 0) {
      console.log(`✅ 数据初始化完成: ${result.staffCount}名教职工, ${result.studentCount}名学生`);
    }
    
    // 初始化阿里云OSS云端同步
    if (isAliyunConfigured) {
      console.log('🌩️ 正在初始化阿里云OSS云端同步...');
      initializeFromAliyun().then(() => {
        console.log('🌩️ 阿里云OSS数据同步完成');
      }).catch(err => {
        console.error('🌩️ 阿里云OSS同步失败:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('kt_user', JSON.stringify(user));
      // 根据角色设置默认视图
      if (currentView === AppView.DASHBOARD) {
        if (user.role === 'KITCHEN') setCurrentView(AppView.KITCHEN);
        else if (user.role === 'SUPER_ADMIN') setCurrentView(AppView.SYSTEM_MGMT);
        else if (user.role === 'PARENT') setCurrentView(AppView.COMMUNICATION);
      }
    } else {
      localStorage.removeItem('kt_user');
    }
  }, [user]);

  if (!user) return <AuthView onLogin={setUser} />;

  // 根据角色定义可访问的模块
  const navItems = [
    { id: AppView.SYSTEM_MGMT, label: '系统管理', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
    { id: AppView.DATA_COCKPIT, label: '数据驾驶舱', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: AppView.DASHBOARD, label: '数据大盘', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: AppView.STUDENTS, label: '幼儿档案', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { id: AppView.OBSERVATION, label: 'AI观察记录', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { id: AppView.GROWTH_ARCHIVE, label: '成长档案', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { id: AppView.KITCHEN, label: '营养厨房', icon: UtensilsCrossed, roles: ['SUPER_ADMIN', 'ADMIN', 'KITCHEN'] },
    { id: AppView.SAFETY, label: '安全工作', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: AppView.STAFF, label: '教职工管理', icon: UserSquare2, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: AppView.FINANCE, label: '财务退费', icon: Calculator, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: AppView.MAINTENANCE, label: '维修报修', icon: Wrench, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: AppView.ANOMALY_MONITOR, label: '异常监控', icon: AlertTriangle, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: AppView.COMMUNICATION, label: '家园共育', icon: MessageSquare, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT'] },
    { id: AppView.CURRICULUM, label: '课程计划', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { id: AppView.DOCUMENTS, label: '资料管理', icon: Folder, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { id: AppView.CALENDAR, label: '校园日历', icon: Calendar, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { id: AppView.AI_ASSISTANT, label: 'AI 助手', icon: Sparkles, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
  ].filter(item => item.roles.includes(user.role as any));

  // 传递用户信息到各视图，实现权限控制
  const renderView = () => {
    switch (currentView) {
      case AppView.SYSTEM_MGMT: return <SystemManagementView currentUser={user} />;
      case AppView.DATA_COCKPIT: return <DataCockpitView currentUser={user} onNavigate={setCurrentView} />;
      case AppView.DASHBOARD: return <DashboardView user={user} onNavigate={setCurrentView} />;
      case AppView.STUDENTS: return <StudentsView currentUser={user} />;
      case AppView.OBSERVATION: return <ObservationView currentUser={user} />;
      case AppView.GROWTH_ARCHIVE: return <GrowthArchiveView currentUser={user} />;
      case AppView.KITCHEN: return <KitchenView currentUser={user} />;
      case AppView.SAFETY: return <SafetyView currentUser={user} />;
      case AppView.STAFF: return <StaffView currentUser={user} />;
      case AppView.FINANCE: return <FinanceView currentUser={user} />;
      case AppView.MAINTENANCE: return <MaintenanceView currentUser={user} />;
      case AppView.ANOMALY_MONITOR: return <AnomalyMonitorView currentUser={user} />;
      case AppView.COMMUNICATION: return <CommunicationView currentUser={user} />;
      case AppView.CURRICULUM: return <CurriculumView currentUser={user} />;
      case AppView.DOCUMENTS: return <DocumentView currentUser={user} />;
      case AppView.CALENDAR: return <CalendarView user={user} />;
      case AppView.AI_ASSISTANT: return <AIAssistantView />;
      default: return <DashboardView user={user} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-24'} transition-all duration-500 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20`}>
        <div className="p-6 h-24 flex items-center justify-center">
          <Logo hideText={!isSidebarOpen} size={isSidebarOpen ? 'md' : 'sm'} />
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as AppView)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                currentView === item.id ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="font-bold text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => setUser(null)} className="w-full flex items-center gap-4 px-4 py-3 text-rose-300 hover:text-rose-600 rounded-xl transition-all">
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="text-sm font-bold">安全注销</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full">
              <Globe className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                {user.role === 'SUPER_ADMIN' ? '总部集团全局视图' : user.campus}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-800">{user.name}</p>
              <p className="text-[8px] text-amber-600 font-bold uppercase tracking-widest">{getRoleName(user.role)}</p>
            </div>
            <img src={user.avatar} className="w-8 h-8 rounded-xl border-2 border-amber-100" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          <div className="page-transition max-w-7xl mx-auto">{renderView()}</div>
        </div>
      </main>
    </div>
  );
};

export default App;
