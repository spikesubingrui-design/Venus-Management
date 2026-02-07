
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, UserSquare2, MessageSquare, BookOpen, Sparkles,
  Bell, Search, Menu, UtensilsCrossed, LogOut, ShieldCheck, Globe, Shield, Folder, Calendar,
  Calculator, FileText, Wrench, BarChart3, AlertTriangle, Leaf, TreeDeciduous
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
import ProfileView from './views/ProfileView';
import { getRoleName } from './services/permissionService';
import { initializeData } from './services/dataInitService';
import { initializeFromAliyun, isAliyunConfigured } from './services/aliyunOssService';
import { ToastProvider } from './components/Toast';

// 导入金星logo高清图片
import logoImg from './金星logo高清.png';

// 自然有机风格配色
// 主色: 橄榄绿 #4a5d3a  辅助: 米色 #f8f5f0  强调: 土黄 #c9a962

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
          <span className={`font-bold ${size === 'lg' ? 'text-2xl' : 'text-lg'} ${light ? 'text-amber-50' : 'text-[#4a5d3a]'} tracking-tight`} style={{ fontFamily: "'Noto Serif SC', serif" }}>金星幼儿园</span>
          <span className={`text-[9px] ${light ? 'text-amber-200/80' : 'text-[#8b7355]'} font-medium tracking-widest uppercase`}>KIDDA VENUS KINDERGARTEN</span>
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 初始化数据：优先从云端下载，硬编码数据仅作兜底
  useEffect(() => {
    const doInit = async () => {
      // 第1步：优先从云端下载最新数据
      if (isAliyunConfigured) {
        console.log('🌩️ 正在从阿里云OSS下载最新数据...');
        try {
          await initializeFromAliyun();
          console.log('🌩️ 阿里云OSS数据同步完成');
        } catch (err) {
          console.error('🌩️ 阿里云OSS同步失败:', err);
        }
      }

      // 第2步：检查云端下载后本地是否已有数据
      // 只有在云端也没有数据时，才用硬编码数据兜底
      const staffInLocal = JSON.parse(localStorage.getItem('kt_staff') || '[]');
      const studentsInLocal = JSON.parse(localStorage.getItem('kt_students') || '[]');
      
      if (staffInLocal.length === 0 || studentsInLocal.length === 0) {
        console.log('[App] 云端无数据或下载失败，使用本地硬编码数据兜底');
        const result = initializeData();
        if (result.staffCount > 0 || result.studentCount > 0) {
          console.log(`✅ 数据兜底初始化完成: ${result.staffCount}名教职工, ${result.studentCount}名学生`);
        }
      } else {
        console.log(`✅ 已从云端加载数据: ${staffInLocal.length}名教职工, ${studentsInLocal.length}名学生`);
      }
    };

    doInit();
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

  if (!user) return <ToastProvider><AuthView onLogin={setUser} /></ToastProvider>;

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
    { id: AppView.FINANCE, label: '收费管理', icon: Calculator, roles: ['FINANCE'] },
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
      case AppView.PROFILE: return <ProfileView currentUser={user} />;
      default: return <DashboardView user={user} onNavigate={setCurrentView} />;
    }
  };

  // 处理导航点击（移动端自动关闭菜单）
  const handleNavClick = (viewId: AppView) => {
    setCurrentView(viewId);
    if (isMobile) setIsMobileMenuOpen(false);
  };

  return (
    <ToastProvider>
    <div className="flex h-screen overflow-hidden font-sans" style={{ backgroundColor: '#faf8f5' }}>
      {/* 移动端遮罩层 */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#4a5d3a]/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 侧边栏 - 自然有机风格 */}
      <aside className={`
        ${isMobile 
          ? `fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `${isSidebarOpen ? 'w-64' : 'w-24'} transition-all duration-500`
        } 
        flex flex-col shadow-2xl
      `} style={{ backgroundColor: '#f5f2ed', borderRight: '1px solid #e8e4dc' }}>
        {/* Logo区域带叶子装饰 - 点击回到主页 */}
        <div className="p-4 md:p-6 h-20 md:h-24 flex items-center justify-between relative">
          <div className="cursor-pointer" onClick={() => { setCurrentView(AppView.DASHBOARD); if (isMobile) setIsMobileMenuOpen(false); }}>
            <Logo hideText={!isSidebarOpen && !isMobile} size={isSidebarOpen || isMobile ? 'md' : 'sm'} />
          </div>
          {isMobile && (
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-[#8b7355] hover:text-[#4a5d3a] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {/* 装饰性叶子 */}
          <Leaf className="absolute -right-2 top-4 w-8 h-8 text-[#4a5d3a]/10 rotate-45" />
        </div>
        
        <nav className="flex-1 px-3 md:px-4 space-y-1.5 overflow-y-auto custom-scrollbar py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id as AppView)}
              className={`w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 md:py-3.5 rounded-2xl transition-all duration-300 ${
                currentView === item.id 
                  ? 'bg-[#4a5d3a] text-white shadow-lg shadow-[#4a5d3a]/20' 
                  : 'text-[#6b7c5c] hover:bg-[#4a5d3a]/10 hover:text-[#4a5d3a]'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {(isSidebarOpen || isMobile) && <span className="font-semibold text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>
        
        {/* 底部装饰波浪 + 注销按钮 */}
        <div className="relative">
          <svg viewBox="0 0 100 20" className="w-full h-6 fill-[#4a5d3a]/5" preserveAspectRatio="none">
            <path d="M0,10 Q25,0 50,10 T100,10 L100,20 L0,20 Z" />
          </svg>
        </div>
        <div className="p-3 md:p-4 bg-[#4a5d3a]/5">
          <button onClick={() => setUser(null)} className="w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 text-[#8b5d3a] hover:text-[#6b3d2a] hover:bg-[#8b5d3a]/10 rounded-xl transition-all">
            <LogOut className="w-5 h-5" />
            {(isSidebarOpen || isMobile) && <span className="text-sm font-semibold">安全注销</span>}
          </button>
          {(isSidebarOpen || isMobile) && (
            <p className="text-center text-[10px] text-[#8b7355]/60 mt-1">V1.1.3</p>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 - 自然有机风格 */}
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-8 shrink-0 relative" style={{ backgroundColor: '#f5f2ed', borderBottom: '1px solid #e8e4dc' }}>
          <div className="flex items-center gap-3 md:gap-4">
            {/* 移动端菜单按钮 */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-[#4a5d3a] hover:text-[#3a4d2a]"
            >
              <Menu className="w-6 h-6" />
            </button>
            {/* 园区徽章 */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-dashed border-[#4a5d3a]/30" style={{ backgroundColor: '#4a5d3a10' }}>
              <TreeDeciduous className="w-3.5 h-3.5 text-[#4a5d3a]" />
              <span className="text-[10px] font-bold text-[#4a5d3a] tracking-wider truncate max-w-[120px] md:max-w-none">
                {user.role === 'SUPER_ADMIN' ? '总部全局' : user.campus}
              </span>
            </div>
          </div>
          <div 
            className="flex items-center gap-3 md:gap-4 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setCurrentView(AppView.PROFILE)}
            title="点击进入个人中心"
          >
            <div className="text-right">
              <p className="text-sm font-bold text-[#4a5d3a] truncate max-w-[80px] md:max-w-none">{user.name}</p>
              <p className="text-[9px] text-[#8b7355] font-medium tracking-wide hidden md:block">{getRoleName(user.role)}</p>
            </div>
            <div className="relative">
              <img src={user.avatar} className="w-10 h-10 rounded-full border-3 border-[#4a5d3a]/20 shadow-md" style={{ borderWidth: '3px' }} />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#7cb342] rounded-full border-2 border-white"></div>
            </div>
          </div>
          {/* 装饰性叶子 */}
          <Leaf className="absolute right-1/3 top-1 w-6 h-6 text-[#4a5d3a]/5 -rotate-12" />
        </header>

        {/* 主内容区 - 带纹理背景 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar" style={{ 
          background: 'linear-gradient(180deg, #faf8f5 0%, #f5f2ed 100%)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234a5d3a' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}>
          <div className="page-transition max-w-7xl mx-auto">{renderView()}</div>
        </div>

        {/* 移动端底部导航栏 - 自然风格 */}
        {isMobile && (
          <nav className="h-16 flex items-center justify-around px-2 shrink-0 safe-area-pb" style={{ backgroundColor: '#f5f2ed', borderTop: '1px solid #e8e4dc' }}>
            {navItems.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as AppView)}
                className={`flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-xl transition-all ${
                  currentView === item.id ? 'text-[#4a5d3a] bg-[#4a5d3a]/10' : 'text-[#8b7355]'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold truncate max-w-[50px]">{item.label.slice(0, 4)}</span>
              </button>
            ))}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-xl text-[#8b7355]"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-semibold">更多</span>
            </button>
          </nav>
        )}
      </main>
    </div>
    </ToastProvider>
  );
};

export default App;
