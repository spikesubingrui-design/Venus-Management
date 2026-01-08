/**
 * 自动化成长档案视图
 * 基于日常采集的健康、进区、观察数据，一键生成个性化《成长档案》供家长查看
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Download, User, Heart, Brain, Palette, Users,
  TrendingUp, Calendar, Camera, Star, Award, ChevronRight,
  ChevronDown, Loader2, Eye, Share2, Printer, BookOpen,
  Activity, Utensils, Moon, Smile, Search, Filter
} from 'lucide-react';
import { User as UserType, Student, GrowthRecord, DailyHealthRecord, DevelopmentAssessment } from '../types';
import { getProfessionalObservations } from '../services/observationService';

interface GrowthArchiveViewProps {
  currentUser: UserType;
}

// 五大领域颜色
const DOMAIN_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  '健康': { bg: 'bg-rose-100', text: 'text-rose-600', icon: Heart },
  '语言': { bg: 'bg-blue-100', text: 'text-blue-600', icon: BookOpen },
  '社会': { bg: 'bg-amber-100', text: 'text-amber-600', icon: Users },
  '科学': { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: Brain },
  '艺术': { bg: 'bg-purple-100', text: 'text-purple-600', icon: Palette },
};

const GrowthArchiveView: React.FC<GrowthArchiveViewProps> = ({ currentUser }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // 学生相关数据
  const [healthRecords, setHealthRecords] = useState<DailyHealthRecord[]>([]);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [observations, setObservations] = useState<any[]>([]);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentData(selectedStudent.id);
    }
  }, [selectedStudent]);

  const loadStudents = () => {
    const saved = localStorage.getItem('kt_students_local');
    if (saved) setStudents(JSON.parse(saved));
  };

  const loadStudentData = (studentId: string) => {
    // 加载健康记录
    const healthData: DailyHealthRecord[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayHealth = localStorage.getItem(`kt_health_${dateStr}`);
      if (dayHealth) {
        const records = JSON.parse(dayHealth);
        if (records[studentId]) {
          healthData.push(records[studentId]);
        }
      }
    }
    setHealthRecords(healthData);

    // 加载成长记录
    const savedGrowth = localStorage.getItem('kt_growth_records');
    if (savedGrowth) {
      const all = JSON.parse(savedGrowth) as GrowthRecord[];
      setGrowthRecords(all.filter(r => r.studentId === studentId));
    }

    // 加载观察记录
    const obs = getProfessionalObservations({ studentId });
    setObservations(obs);
  };

  // 班级列表
  const classes = useMemo(() => {
    const classSet = new Set(students.map(s => s.class));
    return Array.from(classSet).sort();
  }, [students]);

  // 过滤学生
  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (filterClass !== 'all') {
      filtered = filtered.filter(s => s.class === filterClass);
    }
    if (searchTerm) {
      filtered = filtered.filter(s => s.name.includes(searchTerm));
    }
    return filtered;
  }, [students, filterClass, searchTerm]);

  // 计算健康统计
  const healthStats = useMemo(() => {
    if (healthRecords.length === 0) return null;
    
    const avgMood = healthRecords.filter(r => r.moodStatus).length > 0
      ? healthRecords.filter(r => r.moodStatus === 'happy').length / healthRecords.filter(r => r.moodStatus).length * 100
      : 0;
    
    const avgMeal = healthRecords.filter(r => r.lunchStatus).length > 0
      ? healthRecords.filter(r => r.lunchStatus === 'all' || r.lunchStatus === 'half').length / healthRecords.filter(r => r.lunchStatus).length * 100
      : 0;
    
    const avgNap = healthRecords.filter(r => r.napStatus).length > 0
      ? healthRecords.filter(r => r.napStatus === 'good' || r.napStatus === 'normal').length / healthRecords.filter(r => r.napStatus).length * 100
      : 0;

    return { avgMood, avgMeal, avgNap, total: healthRecords.length };
  }, [healthRecords]);

  // 按领域统计观察记录
  const observationsByDomain = useMemo(() => {
    const result: Record<string, number> = {};
    observations.forEach(obs => {
      if (obs.guidelineRefs) {
        obs.guidelineRefs.forEach((ref: any) => {
          result[ref.domain] = (result[ref.domain] || 0) + 1;
        });
      }
    });
    return result;
  }, [observations]);

  // 打印/导出PDF
  const handleExportPDF = () => {
    setIsGenerating(true);
    setPreviewMode(true);
    
    setTimeout(() => {
      window.print();
      setIsGenerating(false);
    }, 500);
  };

  return (
    <div className="p-6 space-y-6 page-transition">
      {/* 页面标题 */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            成长档案
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            基于日常数据自动生成个性化成长档案，支持导出PDF
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 左侧：学生选择 */}
        <div className="lg:col-span-1 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h3 className="font-bold text-slate-800 mb-4">选择学生</h3>
            
            {/* 搜索和筛选 */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索学生..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <select
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold"
              >
                <option value="all">全部班级</option>
                {classes.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* 学生列表 */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    selectedStudent?.id === student.id
                      ? 'bg-amber-100 border-2 border-amber-500'
                      : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                  }`}
                >
                  <img
                    src={student.avatar}
                    alt={student.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="text-left">
                    <p className="font-bold text-slate-800">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.class} · {student.age}岁</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：档案预览 */}
        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-bold">请从左侧选择一位学生</p>
              <p className="text-sm text-slate-400 mt-1">查看并生成成长档案</p>
            </div>
          ) : (
            <div ref={printRef} className="space-y-6">
              {/* 导出按钮 */}
              <div className="flex justify-end gap-3 print:hidden">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {previewMode ? '编辑模式' : '预览模式'}
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  导出PDF
                </button>
              </div>

              {/* 档案封面 */}
              <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-8 text-white shadow-xl print:rounded-none print:shadow-none">
                <div className="flex items-center gap-6">
                  <img
                    src={selectedStudent.avatar}
                    alt={selectedStudent.name}
                    className="w-24 h-24 rounded-2xl border-4 border-white/30 shadow-lg"
                  />
                  <div>
                    <h2 className="text-3xl font-black">{selectedStudent.name}</h2>
                    <p className="text-white/80 mt-1">{selectedStudent.class} · {selectedStudent.age}岁</p>
                    <p className="text-white/60 text-sm mt-2">
                      入园日期：{selectedStudent.enrollDate}
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/20">
                  <p className="text-2xl font-bold font-brand">成长档案</p>
                  <p className="text-white/60 text-sm">Growth Archive · {new Date().getFullYear()}</p>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:shadow-none print:border-slate-300">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-600" />
                  基本信息
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">性别</p>
                    <p className="font-bold text-slate-800">{selectedStudent.gender}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">出生日期</p>
                    <p className="font-bold text-slate-800">{selectedStudent.birthDate}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">身高</p>
                    <p className="font-bold text-slate-800">{selectedStudent.height || '-'} cm</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">体重</p>
                    <p className="font-bold text-slate-800">{selectedStudent.weight || '-'} kg</p>
                  </div>
                </div>
              </div>

              {/* 健康数据 */}
              {healthStats && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:shadow-none print:border-slate-300">
                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-500" />
                    近30天健康概况
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-amber-50 rounded-xl">
                      <Smile className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                      <p className="text-2xl font-black text-amber-600">{healthStats.avgMood.toFixed(0)}%</p>
                      <p className="text-xs text-slate-500">情绪愉快率</p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-xl">
                      <Utensils className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      <p className="text-2xl font-black text-emerald-600">{healthStats.avgMeal.toFixed(0)}%</p>
                      <p className="text-xs text-slate-500">进餐良好率</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <Moon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-2xl font-black text-blue-600">{healthStats.avgNap.toFixed(0)}%</p>
                      <p className="text-xs text-slate-500">午睡良好率</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 text-center">
                    基于 {healthStats.total} 条健康记录统计
                  </p>
                </div>
              )}

              {/* 发展领域 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:shadow-none print:border-slate-300">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  五大领域发展
                </h3>
                <div className="grid grid-cols-5 gap-3">
                  {Object.entries(DOMAIN_COLORS).map(([domain, style]) => {
                    const count = observationsByDomain[domain] || 0;
                    return (
                      <div key={domain} className={`${style.bg} rounded-xl p-4 text-center`}>
                        <style.icon className={`w-6 h-6 mx-auto mb-2 ${style.text}`} />
                        <p className="text-xs font-bold text-slate-600">{domain}</p>
                        <p className={`text-lg font-black ${style.text}`}>{count}</p>
                        <p className="text-[10px] text-slate-400">观察记录</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 精彩观察 */}
              {observations.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:shadow-none print:border-slate-300">
                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    精彩观察记录
                  </h3>
                  <div className="space-y-4">
                    {observations.slice(0, 3).map((obs, idx) => (
                      <div key={obs.id} className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-slate-800">{obs.title}</h4>
                          <span className="text-xs text-slate-400">
                            {new Date(obs.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{obs.behavior}</p>
                        {obs.suggestions && obs.suggestions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-emerald-600 font-bold">
                              💡 {obs.suggestions[0]}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 成长记录 */}
              {growthRecords.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:shadow-none print:border-slate-300">
                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-500" />
                    成长里程碑
                  </h3>
                  <div className="space-y-3">
                    {growthRecords.slice(0, 5).map(record => (
                      <div key={record.id} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                        <div>
                          <p className="font-bold text-slate-800">{record.title}</p>
                          <p className="text-sm text-slate-500">{record.content}</p>
                          <p className="text-xs text-slate-400 mt-1">{record.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 教师寄语 */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white print:bg-slate-100 print:text-slate-800">
                <h3 className="font-black mb-4">💌 教师寄语</h3>
                <p className="text-white/80 print:text-slate-600 leading-relaxed">
                  亲爱的{selectedStudent.name}小朋友，在幼儿园的每一天，你都在快乐地成长。
                  希望你继续保持好奇心，勇于探索，与小伙伴们友好相处。
                  祝你健康快乐，每天都有新的收获！
                </p>
                <p className="text-white/50 print:text-slate-400 text-sm mt-4 text-right">
                  —— {selectedStudent.class}全体老师
                </p>
              </div>

              {/* 页脚 */}
              <div className="text-center text-xs text-slate-400 py-4 print:py-8">
                <p>金星教育 · {selectedStudent.campus}</p>
                <p>档案生成时间：{new Date().toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 打印样式 */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          #root { visibility: visible; }
          [data-print] { visibility: visible; }
        }
      `}</style>
    </div>
  );
};

export default GrowthArchiveView;


