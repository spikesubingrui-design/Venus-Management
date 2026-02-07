/**
 * 数据驾驶舱 (决策中心)
 * 集团化管理视角，一屏查看全园/集团的人（教职工/幼儿）、财（退费/采购）、物（固定资产/能耗）实时数据
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, DollarSign, Package, AlertTriangle,
  TrendingUp, TrendingDown, Building2, UserCheck, UserX,
  Wallet, Receipt, Wrench, Zap, RefreshCw, ChevronRight,
  Activity, PieChart, BarChart3, Calendar, Clock, ArrowUp, ArrowDown
} from 'lucide-react';
import { User, Student, Teacher, RefundRecord, MaintenanceRecord, AnomalyAlert, AppView } from '../types';
import { getData } from '../services/storageService';
import { getRefundRecords, getFinanceSummary } from '../services/financeService';

interface DataCockpitViewProps {
  currentUser: User;
  onNavigate?: (view: AppView) => void;
}

const DataCockpitView: React.FC<DataCockpitViewProps> = ({ currentUser, onNavigate }) => {
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // 数据状态
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    loadAllData();
    // 每30秒刷新一次
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 通用去重函数：按 name 组合键去重
  // 学生去重：和幼儿档案保持完全一致的逻辑
  const dedupStudents = (arr: any[]) => {
    const seen = new Map();
    for (const s of arr) {
      const key = s.name && s.class ? `${s.name}_${s.class}` : s.id;
      if (key && !seen.has(key)) {
        seen.set(key, s);
      }
    }
    return Array.from(seen.values());
  };

  // 教师去重：name+phone 优先，其次 name+assignedClass，最后 id
  const dedupTeachers = (arr: any[]) => {
    const seen = new Map();
    for (const t of arr) {
      const key = t.name 
        ? (t.phone ? `${t.name}_${t.phone}` 
          : t.assignedClass ? `${t.name}_${t.assignedClass}` 
          : t.name)
        : t.id;
      if (key && !seen.has(key)) {
        seen.set(key, t);
      }
    }
    return Array.from(seen.values());
  };

  const loadAllData = () => {
    setIsLoading(true);
    
    // 加载学生（带去重，逻辑与幼儿档案完全一致）
    const savedStudents = localStorage.getItem('kt_students');
    if (savedStudents) {
      const raw = JSON.parse(savedStudents);
      const deduped = dedupStudents(raw);
      setStudents(deduped);
      if (deduped.length !== raw.length) {
        localStorage.setItem('kt_students', JSON.stringify(deduped));
        console.log(`[DataCockpit] 学生去重: ${raw.length} → ${deduped.length}`);
      }
    }
    
    // 加载教师：同时从 kt_teachers 和 kt_staff 取数据，合并补齐
    const webTeachers: any[] = JSON.parse(localStorage.getItem('kt_teachers') || '[]');
    const ossStaff: any[] = JSON.parse(localStorage.getItem('kt_staff') || '[]');
    
    if (ossStaff.length > webTeachers.length) {
      const existingPhones = new Set(webTeachers.map((t: any) => t.phone || t.id));
      const missing = ossStaff.filter((s: any) => {
        const k = s.phone || s.id;
        return k && !existingPhones.has(k);
      });
      if (missing.length > 0) {
        const converted = missing.map((s: any) => ({
          id: s.id, name: s.name, role: s.position || s.role || '',
          phone: s.phone || '', assignedClass: Array.isArray(s.assignedClasses) ? s.assignedClasses[0] || s.class || '' : s.class || '',
          campus: s.campus || '', hireDate: s.hireDate || '', status: s.status || 'active',
          avatar: s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name || '')}&background=4A90A4&color=fff&size=128`,
          performanceScore: 95, education: s.education || '本科', certificates: [],
        }));
        const merged = [...webTeachers, ...converted];
        localStorage.setItem('kt_teachers', JSON.stringify(merged));
        console.log(`[DataCockpit] 🔄 kt_teachers 从 kt_staff 补充: +${missing.length} → ${merged.length} 条`);
      }
    }
    
    const finalTeachers: any[] = JSON.parse(localStorage.getItem('kt_teachers') || '[]');
    const deduped = dedupTeachers(finalTeachers);
    setTeachers(deduped);
    if (deduped.length !== finalTeachers.length) {
      localStorage.setItem('kt_teachers', JSON.stringify(deduped));
      console.log(`[DataCockpit] 教职工去重: ${finalTeachers.length} → ${deduped.length}`);
    }
    
    // 加载退费记录
    setRefunds(getRefundRecords({}));
    
    // 加载维修记录
    setMaintenance(getData<MaintenanceRecord>('kt_maintenance_records'));
    
    // 加载异常警报
    setAlerts(getData<AnomalyAlert>('kt_anomaly_alerts'));
    
    setLastUpdate(new Date());
    setIsLoading(false);
  };

  // 获取园区列表
  const campuses = useMemo(() => {
    const campusSet = new Set([
      ...students.map(s => s.campus),
      ...teachers.map(t => t.campus).filter(Boolean),
    ]);
    return ['all', ...Array.from(campusSet)];
  }, [students, teachers]);

  // 根据选择的园区过滤数据
  const filteredData = useMemo(() => {
    const filterByCampus = <T extends { campus?: string }>(arr: T[]) => 
      selectedCampus === 'all' ? arr : arr.filter(item => item.campus === selectedCampus);

    return {
      students: filterByCampus(students),
      teachers: filterByCampus(teachers as any[]) as Teacher[],
      refunds: selectedCampus === 'all' ? refunds : refunds.filter(r => r.campus === selectedCampus),
      maintenance: selectedCampus === 'all' ? maintenance : maintenance.filter(m => m.campus === selectedCampus),
    };
  }, [selectedCampus, students, teachers, refunds, maintenance]);

  // 计算人员统计
  const peopleStats = useMemo(() => {
    const todayAttendance = localStorage.getItem(`kt_attendance_${today}`);
    const attendance = todayAttendance ? JSON.parse(todayAttendance) : {};
    
    const presentStudents = filteredData.students.filter(s => 
      attendance[s.id]?.status === 'present' || attendance[s.id]?.status === 'late'
    ).length;
    
    const activeTeachers = filteredData.teachers.filter(t => t.status === 'active').length;
    const onLeaveTeachers = filteredData.teachers.filter(t => t.status === 'leave').length;

    return {
      totalStudents: filteredData.students.length,
      presentStudents,
      absentStudents: filteredData.students.length - presentStudents,
      attendanceRate: filteredData.students.length > 0 
        ? (presentStudents / filteredData.students.length * 100).toFixed(1)
        : '0',
      totalTeachers: filteredData.teachers.length,
      activeTeachers,
      onLeaveTeachers,
      teacherStudentRatio: activeTeachers > 0 
        ? (filteredData.students.length / activeTeachers).toFixed(1)
        : '-',
    };
  }, [filteredData, today]);

  // 计算财务统计
  const financeStats = useMemo(() => {
    const monthRefunds = filteredData.refunds.filter(r => r.period === thisMonth);
    const pendingRefunds = monthRefunds.filter(r => r.status === 'pending' || r.status === 'approved');
    const completedRefunds = monthRefunds.filter(r => r.status === 'completed');

    return {
      pendingRefundCount: pendingRefunds.length,
      pendingRefundAmount: pendingRefunds.reduce((sum, r) => sum + r.totalRefund, 0),
      completedRefundCount: completedRefunds.length,
      completedRefundAmount: completedRefunds.reduce((sum, r) => sum + r.totalRefund, 0),
    };
  }, [filteredData.refunds, thisMonth]);

  // 计算资产统计
  const assetStats = useMemo(() => {
    const monthMaintenance = filteredData.maintenance.filter(m => m.reportedAt.startsWith(thisMonth));
    const pendingMaintenance = filteredData.maintenance.filter(m => m.status === 'pending' || m.status === 'in_progress');
    const monthCost = monthMaintenance
      .filter(m => m.repairCost)
      .reduce((sum, m) => sum + (m.repairCost || 0), 0);

    return {
      pendingRepairs: pendingMaintenance.length,
      monthRepairCount: monthMaintenance.length,
      monthRepairCost: monthCost,
    };
  }, [filteredData.maintenance, thisMonth]);

  // 预警统计
  const alertStats = useMemo(() => {
    const activeAlerts = alerts.filter(a => a.status === 'new' || a.status === 'acknowledged');
    return {
      total: activeAlerts.length,
      critical: activeAlerts.filter(a => a.severity === 'critical').length,
      warning: activeAlerts.filter(a => a.severity === 'warning').length,
    };
  }, [alerts]);

  // 按班级统计
  const classStat = useMemo(() => {
    const classMap: Record<string, { students: number; present: number }> = {};
    const todayAttendance = localStorage.getItem(`kt_attendance_${today}`);
    const attendance = todayAttendance ? JSON.parse(todayAttendance) : {};

    filteredData.students.forEach(s => {
      if (!classMap[s.class]) {
        classMap[s.class] = { students: 0, present: 0 };
      }
      classMap[s.class].students++;
      if (attendance[s.id]?.status === 'present' || attendance[s.id]?.status === 'late') {
        classMap[s.class].present++;
      }
    });

    return Object.entries(classMap)
      .map(([name, data]) => ({
        name,
        students: data.students,
        present: data.present,
        rate: data.students > 0 ? (data.present / data.students * 100).toFixed(0) : '0',
      }))
      .sort((a, b) => b.students - a.students);
  }, [filteredData.students, today]);

  return (
    <div className="p-6 space-y-6 page-transition bg-slate-900 min-h-screen">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            数据驾驶舱
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            集团化管理决策中心 · 实时数据监控
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* 园区选择 */}
          <select
            value={selectedCampus}
            onChange={e => setSelectedCampus(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">全部园区</option>
            {campuses.filter(c => c !== 'all').map(campus => (
              <option key={campus} value={campus}>{campus}</option>
            ))}
          </select>

          {/* 刷新按钮 */}
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? '刷新中' : '刷新'}
          </button>

          {/* 最后更新时间 */}
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {lastUpdate.toLocaleTimeString('zh-CN')}
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 在园幼儿 */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-8 h-8 opacity-80" />
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              parseFloat(peopleStats.attendanceRate) > 90 ? 'bg-white/20' : 'bg-rose-500/50'
            }`}>
              {peopleStats.attendanceRate}%
            </span>
          </div>
          <p className="text-4xl font-black">{peopleStats.presentStudents}</p>
          <p className="text-sm opacity-70 mt-1">在园幼儿 / {peopleStats.totalStudents}</p>
        </div>

        {/* 教职工 */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <UserCheck className="w-8 h-8 opacity-80" />
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20">
              1:{peopleStats.teacherStudentRatio}
            </span>
          </div>
          <p className="text-4xl font-black">{peopleStats.activeTeachers}</p>
          <p className="text-sm opacity-70 mt-1">在岗教职工 / {peopleStats.totalTeachers}</p>
        </div>

        {/* 待退费 */}
        <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <Wallet className="w-8 h-8 opacity-80" />
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20">
              {financeStats.pendingRefundCount}单
            </span>
          </div>
          <p className="text-4xl font-black">¥{(financeStats.pendingRefundAmount / 1000).toFixed(1)}k</p>
          <p className="text-sm opacity-70 mt-1">待处理退费</p>
        </div>

        {/* 待维修 */}
        <div className="bg-gradient-to-br from-rose-600 to-pink-700 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <Wrench className="w-8 h-8 opacity-80" />
            {alertStats.critical > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/30 animate-pulse">
                {alertStats.critical}个紧急
              </span>
            )}
          </div>
          <p className="text-4xl font-black">{assetStats.pendingRepairs}</p>
          <p className="text-sm opacity-70 mt-1">待处理维修</p>
        </div>
      </div>

      {/* 主体内容区 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* 左侧：班级出勤 */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="font-black text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            班级出勤率
          </h3>
          <div className="space-y-3">
            {classStat.slice(0, 8).map(cls => (
              <div key={cls.name} className="flex items-center gap-3">
                <span className="text-sm text-slate-400 w-20 truncate">{cls.name}</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      parseInt(cls.rate) > 90 ? 'bg-emerald-500' :
                      parseInt(cls.rate) > 70 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${cls.rate}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white w-12 text-right">{cls.rate}%</span>
                <span className="text-xs text-slate-500 w-16 text-right">{cls.present}/{cls.students}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 中间：财务概览 */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="font-black text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            本月财务概览
          </h3>
          <div className="space-y-4">
            <div className="bg-slate-700/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">待处理退费</span>
                <span className="text-amber-400 font-bold">{financeStats.pendingRefundCount}单</span>
              </div>
              <p className="text-2xl font-black text-white">
                ¥{financeStats.pendingRefundAmount.toLocaleString()}
              </p>
            </div>
            
            <div className="bg-slate-700/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">已完成退费</span>
                <span className="text-emerald-400 font-bold">{financeStats.completedRefundCount}单</span>
              </div>
              <p className="text-2xl font-black text-white">
                ¥{financeStats.completedRefundAmount.toLocaleString()}
              </p>
            </div>

            <div className="bg-slate-700/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">本月维修支出</span>
                <span className="text-rose-400 font-bold">{assetStats.monthRepairCount}单</span>
              </div>
              <p className="text-2xl font-black text-white">
                ¥{assetStats.monthRepairCost.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* 右侧：预警中心 */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="font-black text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            预警中心
          </h3>
          
          {alertStats.total === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Activity className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-bold">系统运行正常</p>
              <p className="text-slate-500 text-sm mt-1">暂无异常预警</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertStats.critical > 0 && (
                <div className="bg-rose-500/20 border border-rose-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-rose-400 font-bold text-sm">紧急预警</span>
                  </div>
                  <p className="text-white font-bold">{alertStats.critical} 个需立即处理</p>
                </div>
              )}
              
              {alertStats.warning > 0 && (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    <span className="text-amber-400 font-bold text-sm">警告</span>
                  </div>
                  <p className="text-white font-bold">{alertStats.warning} 个需关注</p>
                </div>
              )}

              <button 
                onClick={() => onNavigate?.(AppView.ANOMALY_MONITOR)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-slate-300 font-bold transition-colors"
              >
                查看全部预警
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部快速入口 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: '幼儿档案', color: 'from-emerald-500 to-teal-600', view: AppView.STUDENTS },
          { icon: Receipt, label: '退费管理', color: 'from-amber-500 to-orange-600', view: AppView.FINANCE },
          { icon: Wrench, label: '报修管理', color: 'from-rose-500 to-pink-600', view: AppView.MAINTENANCE },
          { icon: BarChart3, label: '异常监控', color: 'from-purple-500 to-indigo-600', view: AppView.ANOMALY_MONITOR },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => onNavigate?.(item.view)}
            className={`bg-gradient-to-br ${item.color} rounded-xl p-4 flex items-center gap-3 text-white hover:scale-105 transition-transform shadow-lg`}
          >
            <item.icon className="w-6 h-6" />
            <span className="font-bold">{item.label}</span>
            <ChevronRight className="w-4 h-4 ml-auto opacity-70" />
          </button>
        ))}
      </div>

      {/* 页脚信息 */}
      <div className="text-center text-xs text-slate-600 pt-4">
        <p>金星教育集团 · 数据驾驶舱 V1.1.3</p>
        <p className="mt-1">数据每30秒自动刷新 · 最后更新: {lastUpdate.toLocaleString()}</p>
      </div>
    </div>
  );
};

export default DataCockpitView;

