
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, TrendingUp, Activity, Clock, CheckCircle2, CalendarDays, ChevronRight,
  AlertTriangle, Thermometer, Bell, UserCheck, BookOpen, UtensilsCrossed,
  RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { User, Student, Teacher, Announcement, AppView } from '../types';

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
    
    // 加载学生数据
    const savedStudents = localStorage.getItem('kt_students_local');
    if (savedStudents) setStudents(JSON.parse(savedStudents));
    
    // 加载教师数据
    const savedTeachers = localStorage.getItem('kt_teachers');
    if (savedTeachers) setTeachers(JSON.parse(savedTeachers));
    
    // 加载今日考勤
    const savedAttendance = localStorage.getItem(`kt_attendance_${today}`);
    if (savedAttendance) setTodayAttendance(JSON.parse(savedAttendance));
    
    // 加载今日健康记录
    const savedHealth = localStorage.getItem(`kt_health_${today}`);
    if (savedHealth) setTodayHealth(JSON.parse(savedHealth));
    
    // 加载公告
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
    
    // 高温警告
    const highTempCount = Object.values(todayHealth).filter((h: any) => {
      const temp = h.morningTemp || h.noonTemp;
      return temp && temp >= 37.3;
    }).length;
    
    // 班级统计
    const classCounts: Record<string, number> = {};
    students.forEach(s => {
      classCounts[s.class] = (classCounts[s.class] || 0) + 1;
    });
    
    return { totalStudents, presentCount, attendanceRate, totalTeachers, teacherStudentRatio, highTempCount, classCounts };
  }, [students, teachers, todayAttendance, todayHealth]);

  // 生成出勤趋势数据（过去7天）
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
    const colors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#06b6d4'];
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
    
    // 体温异常告警
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
    
    // 缺勤告警
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
    
    // 过敏幼儿提醒
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

  const StatCard = ({ title, value, change, icon: Icon, color, trend }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change && (
          <span className={`text-sm font-medium px-2 py-1 rounded-lg flex items-center gap-1 ${
            trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 
            trend === 'down' ? 'text-rose-600 bg-rose-50' : 'text-slate-600 bg-slate-50'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
            {change}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">欢迎回来，{user.name}！</h1>
          <p className="text-slate-500">
            {user.role === 'SUPER_ADMIN' ? '全园实时数据概览' : `${user.campus || '金星幼儿园'}今日运行简报`}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadAllData} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
          <button className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-700 shadow-lg shadow-orange-100 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </button>
        </div>
      </div>

      {/* 核心统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="在园幼儿" value={stats.totalStudents} change={stats.totalStudents > 0 ? '+' + stats.totalStudents : null} icon={Users} color="bg-orange-500" trend="up" />
        <StatCard title="今日出勤" value={`${stats.attendanceRate}%`} change={`${stats.presentCount}/${stats.totalStudents}`} icon={CheckCircle2} color="bg-blue-500" trend={parseFloat(stats.attendanceRate) >= 90 ? 'up' : 'down'} />
        <StatCard title="教职工" value={stats.totalTeachers} icon={UserCheck} color="bg-emerald-500" />
        <StatCard title="师生比" value={stats.teacherStudentRatio} icon={TrendingUp} color="bg-purple-500" />
        <StatCard 
          title="体温异常" 
          value={stats.highTempCount} 
          icon={Thermometer} 
          color={stats.highTempCount > 0 ? "bg-rose-500" : "bg-slate-400"} 
          change={stats.highTempCount > 0 ? '需关注' : '正常'}
          trend={stats.highTempCount > 0 ? 'down' : 'up'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 出勤趋势 */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">出勤趋势分析（近7天）</h3>
          <div className="h-[300px]">
            {attendanceTrend.some(d => d.attendance > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient id="colorAttend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${value}%`, '出勤率']}
                  />
                  <Area type="monotone" dataKey="attendance" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorAttend)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂无出勤数据</p>
                  <p className="text-xs mt-1">请先在幼儿档案中录入学生并记录考勤</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 班级分布 */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">班级人数分布</h3>
          <div className="h-[300px]">
            {classesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={60} />
                  <Tooltip />
                  <Bar dataKey="students" radius={[0, 8, 8, 0]}>
                    {classesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂无班级数据</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 快捷入口 + 告警 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 快捷功能入口 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
          <h3 className="font-bold text-lg mb-4">快捷操作</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Users, label: '幼儿档案', color: 'from-orange-500 to-amber-500', view: AppView.STUDENTS },
              { icon: UserCheck, label: '快速考勤', color: 'from-emerald-500 to-green-500', view: AppView.STUDENTS },
              { icon: UtensilsCrossed, label: '营养厨房', color: 'from-purple-500 to-indigo-500', view: AppView.KITCHEN },
              { icon: BookOpen, label: '课程计划', color: 'from-blue-500 to-cyan-500', view: AppView.CURRICULUM },
            ].map((item, idx) => (
              <button 
                key={idx} 
                onClick={() => onNavigate?.(item.view)}
                className={`p-4 rounded-xl bg-gradient-to-br ${item.color} flex flex-col items-center gap-2 hover:scale-105 transition-transform shadow-lg active:scale-95`}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-bold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 告警列表 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              今日告警与提醒
            </h3>
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-bold">
              {alerts.length} 条
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div key={alert.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className={`w-2 h-12 rounded-full ${
                  alert.level === 'critical' ? 'bg-rose-500' :
                  alert.level === 'warning' ? 'bg-amber-500' : 
                  alert.level === 'info' ? 'bg-blue-500' : 'bg-slate-300'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{alert.msg}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">
                    {alert.type} • {alert.time}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            )) : (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="font-medium">今日暂无告警</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
