
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, TrendingUp, Activity, Clock, CheckCircle2, CalendarDays, ChevronRight,
  AlertTriangle, Thermometer, Bell, UserCheck, BookOpen, UtensilsCrossed,
  RefreshCw, ArrowUpRight, ArrowDownRight, Leaf, Sun, Cloud, TreeDeciduous,
  Flower2, Sprout, Bird
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { User, Student, Teacher, Announcement, AppView } from '../types';
import { NaturalCard, NaturalButton, StatCard, PageTitle, Badge, WaveDivider, NaturalPattern, EmptyState } from '../components/NaturalUI';

interface DashboardViewProps {
  user: User;
  onNavigate?: (view: AppView) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ user, onNavigate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Record<string, any>>({});
  const [todayHealth, setTodayHealth] = useState<Record<string, any>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    setLoading(true);
    
    const savedStudents = localStorage.getItem('kt_students_local');
    if (savedStudents) setStudents(JSON.parse(savedStudents));
    
    const savedTeachers = localStorage.getItem('kt_teachers');
    if (savedTeachers) setTeachers(JSON.parse(savedTeachers));
    
    const savedAttendance = localStorage.getItem(`kt_attendance_${today}`);
    if (savedAttendance) setTodayAttendance(JSON.parse(savedAttendance));
    
    const savedHealth = localStorage.getItem(`kt_health_${today}`);
    if (savedHealth) setTodayHealth(JSON.parse(savedHealth));
    
    const savedAnnouncements = localStorage.getItem('kt_announcements');
    if (savedAnnouncements) setAnnouncements(JSON.parse(savedAnnouncements));
    
    setLoading(false);
  };

  // 计算统计数据
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const presentCount = Object.values(todayAttendance).filter((a: any) => a.status === 'present').length;
    const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : '0';
    const totalTeachers = teachers.length;
    const teacherStudentRatio = totalTeachers > 0 ? `1:${Math.round(totalStudents / totalTeachers)}` : '0:0';
    
    const highTempCount = Object.values(todayHealth).filter((h: any) => {
      const temp = h.morningTemp || h.noonTemp;
      return temp && temp >= 37.3;
    }).length;
    
    const classCounts: Record<string, number> = {};
    students.forEach(s => {
      classCounts[s.class] = (classCounts[s.class] || 0) + 1;
    });
    
    return { totalStudents, presentCount, attendanceRate, totalTeachers, teacherStudentRatio, highTempCount, classCounts };
  }, [students, teachers, todayAttendance, todayHealth]);

  // 生成出勤趋势数据
  const attendanceTrend = useMemo(() => {
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const todayIdx = new Date().getDay();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayAttendance = localStorage.getItem(`kt_attendance_${dateStr}`);
      let presentCount = 0;
      
      if (dayAttendance) {
        const records = JSON.parse(dayAttendance);
        presentCount = Object.values(records).filter((r: any) => r.status === 'present').length;
      }
      
      const dayIdx = (todayIdx - i + 7) % 7;
      data.push({
        name: days[dayIdx] || date.getDate() + '日',
        attendance: students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0,
        present: presentCount
      });
    }
    
    return data;
  }, [students]);

  // 班级人数分布
  const classesData = useMemo(() => {
    const colors = ['#4a5d3a', '#6b7c5c', '#8b9d7c', '#c9a962', '#8b6f47', '#a68b5c'];
    return Object.entries(stats.classCounts)
      .map(([name, count], idx) => ({
        name,
        students: count,
        fill: colors[idx % colors.length]
      }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 6);
  }, [stats.classCounts]);

  // 生成告警列表
  const alerts = useMemo(() => {
    const list: { id: number; type: string; msg: string; time: string; level: string }[] = [];
    
    Object.entries(todayHealth).forEach(([studentId, record]: [string, any]) => {
      const temp = record.morningTemp || record.noonTemp;
      if (temp && temp >= 37.3) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          list.push({
            id: list.length + 1,
            type: '健康',
            msg: `${student.name} 体温偏高 (${temp}°C)`,
            time: record.recordedAt ? new Date(record.recordedAt).toLocaleTimeString() : '今日',
            level: temp >= 38 ? 'critical' : 'warning'
          });
        }
      }
    });
    
    const absentStudents = students.filter(s => {
      const attendance = todayAttendance[s.id];
      return !attendance || attendance.status === 'absent';
    });
    if (absentStudents.length > 3) {
      list.push({
        id: list.length + 1,
        type: '考勤',
        msg: `今日有 ${absentStudents.length} 名幼儿未签到`,
        time: '待处理',
        level: 'info'
      });
    }
    
    const allergicStudents = students.filter(s => s.allergies && s.allergies.length > 0);
    if (allergicStudents.length > 0) {
      list.push({
        id: list.length + 1,
        type: '健康',
        msg: `有 ${allergicStudents.length} 名幼儿有过敏史，请注意配餐`,
        time: '长期提醒',
        level: 'low'
      });
    }
    
    return list.slice(0, 5);
  }, [students, todayHealth, todayAttendance]);

  // 获取当前时间问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return { text: '夜深了', icon: <Cloud className="w-6 h-6" />, emoji: '🌙' };
    if (hour < 9) return { text: '早安', icon: <Sun className="w-6 h-6" />, emoji: '🌅' };
    if (hour < 12) return { text: '上午好', icon: <Sun className="w-6 h-6" />, emoji: '☀️' };
    if (hour < 14) return { text: '中午好', icon: <Sun className="w-6 h-6" />, emoji: '🌤️' };
    if (hour < 18) return { text: '下午好', icon: <Leaf className="w-6 h-6" />, emoji: '🌿' };
    return { text: '晚上好', icon: <Cloud className="w-6 h-6" />, emoji: '🌆' };
  };

  const greeting = getGreeting();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {/* 装饰元素 */}
      <div className="absolute top-0 right-0 w-40 h-40 opacity-5 pointer-events-none">
        <TreeDeciduous className="w-full h-full text-[#4a5d3a]" />
      </div>

      {/* 欢迎横幅 */}
      <div 
        className="relative rounded-3xl overflow-hidden shadow-xl"
        style={{ background: 'linear-gradient(135deg, #4a5d3a 0%, #6b7c5c 50%, #8b9d7c 100%)' }}
      >
        <NaturalPattern className="opacity-10" />
        <div className="relative p-8 md:p-10 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <span className="text-3xl">{greeting.emoji}</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  {greeting.text}，{user.name}！
                </h1>
                <p className="text-white/70 text-sm">
                  {user.role === 'SUPER_ADMIN' ? '🌍 全园实时数据概览' : `🏡 ${user.campus || '金星幼儿园'}今日运行简报`}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="success" size="sm">
                    <Leaf className="w-3 h-3" />
                    自然成长
                  </Badge>
                  <Badge variant="success" size="sm">
                    <Bird className="w-3 h-3" />
                    快乐学习
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <NaturalButton variant="outline" onClick={loadAllData} icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}>
                刷新
              </NaturalButton>
              <div 
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <CalendarDays className="w-4 h-4" />
                {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </div>
            </div>
          </div>
        </div>
        <WaveDivider color="rgba(255,255,255,0.1)" className="absolute bottom-0 h-6" />
      </div>

      {/* 核心统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="在园幼儿" 
          value={stats.totalStudents} 
          icon={<Users className="w-6 h-6" />}
          variant="green"
          trend={stats.totalStudents > 0 ? { value: 2.5, isUp: true } : undefined}
        />
        <StatCard 
          title="今日出勤" 
          value={`${stats.attendanceRate}%`} 
          icon={<CheckCircle2 className="w-6 h-6" />}
          variant="sage"
          trend={{ value: parseFloat(stats.attendanceRate) >= 90 ? 3.2 : -1.5, isUp: parseFloat(stats.attendanceRate) >= 90 }}
        />
        <StatCard 
          title="教职工" 
          value={stats.totalTeachers} 
          icon={<UserCheck className="w-6 h-6" />}
          variant="gold"
        />
        <StatCard 
          title="师生比" 
          value={stats.teacherStudentRatio} 
          icon={<TrendingUp className="w-6 h-6" />}
          variant="brown"
        />
        <StatCard 
          title="体温关注" 
          value={stats.highTempCount} 
          icon={<Thermometer className="w-6 h-6" />}
          variant={stats.highTempCount > 0 ? "brown" : "sage"}
          trend={stats.highTempCount > 0 ? { value: stats.highTempCount, isUp: false } : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 出勤趋势 */}
        <div className="lg:col-span-2">
          <NaturalCard title="出勤趋势分析（近7天）" icon={<Activity className="w-5 h-5" />}>
            <div className="h-[300px]">
              {attendanceTrend.some(d => d.attendance > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrend}>
                    <defs>
                      <linearGradient id="colorAttendNatural" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4a5d3a" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#4a5d3a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e4dc" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#8b7355', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#8b7355', fontSize: 12}} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '2px solid #e8e4dc', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#faf8f5' }}
                      formatter={(value: any) => [`${value}%`, '出勤率']}
                    />
                    <Area type="monotone" dataKey="attendance" stroke="#4a5d3a" strokeWidth={3} fillOpacity={1} fill="url(#colorAttendNatural)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState 
                  icon={<Sprout className="w-10 h-10" style={{ color: '#4a5d3a40' }} />}
                  title="暂无出勤数据"
                  description="请先在幼儿档案中录入学生并记录考勤"
                />
              )}
            </div>
          </NaturalCard>
        </div>

        {/* 班级分布 */}
        <NaturalCard title="班级人数分布" icon={<Users className="w-5 h-5" />}>
          <div className="h-[300px]">
            {classesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8e4dc" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#8b7355', fontSize: 12}} width={60} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '2px solid #e8e4dc', backgroundColor: '#faf8f5' }}
                  />
                  <Bar dataKey="students" radius={[0, 8, 8, 0]}>
                    {classesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState 
                icon={<TreeDeciduous className="w-10 h-10" style={{ color: '#4a5d3a40' }} />}
                title="暂无班级数据"
              />
            )}
          </div>
        </NaturalCard>
      </div>

      {/* 快捷入口 + 告警 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 快捷功能入口 - 自然风格 */}
        <div 
          className="rounded-3xl p-6 relative overflow-hidden shadow-xl"
          style={{ background: 'linear-gradient(135deg, #3d4a32 0%, #4a5d3a 100%)' }}
        >
          <NaturalPattern className="opacity-10" />
          <div className="relative">
            <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
              <Sprout className="w-5 h-5 text-[#c9dbb8]" />
              快捷操作
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: '幼儿档案', color: '#6b7c5c', view: AppView.STUDENTS },
                { icon: UserCheck, label: '快速考勤', color: '#8b9d7c', view: AppView.STUDENTS },
                { icon: UtensilsCrossed, label: '营养厨房', color: '#c9a962', view: AppView.KITCHEN },
                { icon: BookOpen, label: '课程计划', color: '#8b6f47', view: AppView.CURRICULUM },
              ].map((item, idx) => (
                <button 
                  key={idx} 
                  onClick={() => onNavigate?.(item.view)}
                  className="p-4 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all shadow-lg active:scale-95 border-2 border-white/10"
                  style={{ backgroundColor: item.color }}
                >
                  <item.icon className="w-6 h-6 text-white" />
                  <span className="text-xs font-bold text-white">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* 装饰叶子 */}
          <Leaf className="absolute -bottom-4 -right-4 w-24 h-24 text-white/5 rotate-45" />
        </div>

        {/* 告警列表 */}
        <div className="lg:col-span-2">
          <NaturalCard 
            title="今日告警与提醒" 
            icon={<Bell className="w-5 h-5" />}
            noPadding
          >
            <div className="px-6 py-2 border-b" style={{ borderColor: '#e8e4dc' }}>
              <Badge variant="accent" size="sm">
                <AlertTriangle className="w-3 h-3" />
                {alerts.length} 条提醒
              </Badge>
            </div>
            <div className="divide-y divide-[#f5f2ed]">
              {alerts.length > 0 ? alerts.map((alert) => (
                <div key={alert.id} className="p-4 flex items-center gap-4 hover:bg-[#faf8f5] transition-colors">
                  <div className={`w-2 h-12 rounded-full ${
                    alert.level === 'critical' ? 'bg-rose-500' :
                    alert.level === 'warning' ? 'bg-[#c9a962]' : 
                    alert.level === 'info' ? 'bg-[#4a5d3a]' : 'bg-[#c9dbb8]'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#3d4a32' }}>{alert.msg}</p>
                    <p className="text-xs uppercase tracking-wider font-semibold mt-1" style={{ color: '#8b7355' }}>
                      {alert.type} • {alert.time}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: '#c9dbb8' }} />
                </div>
              )) : (
                <div className="p-8 text-center">
                  <div 
                    className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: '#4a5d3a20' }}
                  >
                    <CheckCircle2 className="w-6 h-6" style={{ color: '#4a5d3a' }} />
                  </div>
                  <p className="font-medium" style={{ color: '#4a5d3a' }}>今日暂无告警 🌿</p>
                  <p className="text-sm mt-1" style={{ color: '#8b7355' }}>一切运行正常</p>
                </div>
              )}
            </div>
          </NaturalCard>
        </div>
      </div>

      {/* 底部装饰 */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: '#8b7355' }}>
          <Leaf className="w-4 h-4" style={{ color: '#4a5d3a' }} />
          <span>培育每一颗种子，静待花开 🌱</span>
          <Leaf className="w-4 h-4 rotate-180" style={{ color: '#4a5d3a' }} />
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
