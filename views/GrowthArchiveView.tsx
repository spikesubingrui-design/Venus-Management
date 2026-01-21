/**
 * 成长档案与发展评价视图
 * 基于日常采集的健康、进区、观察数据，一键生成个性化《成长档案》
 * 支持在线填写发展评价表，保存到学生档案
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Download, User, Heart, Brain, Palette, Users,
  TrendingUp, Calendar, Camera, Star, Award, ChevronRight,
  ChevronDown, Loader2, Eye, Share2, Printer, BookOpen,
  Activity, Utensils, Moon, Smile, Search, Filter, ClipboardCheck,
  CheckCircle2, Save, Plus, Edit3, Trash2, X, Sparkles
} from 'lucide-react';
import { User as UserType, Student, GrowthRecord, DailyHealthRecord, StudentEvaluation, EvaluationTemplate, EvaluationScore } from '../types';
import { getProfessionalObservations } from '../services/observationService';

// 豆包 API 配置
const DOUBAO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DOUBAO_MODEL = "doubao-seed-1-6-251015";

// AI润色教师评语
async function polishTeacherComment(
  studentName: string,
  studentClass: string,
  templateName: string,
  averageScore: number,
  originalComment: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_DOUBAO_API_KEY || import.meta.env.VITE_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("API Key 未配置");
  }

  const prompt = `请帮我润色以下幼儿园教师对学生的发展评价评语，使其更加专业、温暖、具体。

学生信息：
- 姓名：${studentName}
- 班级：${studentClass}
- 评价类型：${templateName}
- 平均得分：${averageScore}/5

教师原始评语：
${originalComment || '（教师未填写评语）'}

要求：
1. 如果原评语为空或很短，请根据学生信息和评价结果生成一段专业的评语
2. 评语要体现对孩子的关爱和鼓励
3. 适当提及孩子的发展特点和进步空间
4. 语言温馨、专业，符合幼儿园教师的表达风格
5. 控制在100-150字

请直接输出润色后的评语，不要输出其他内容。`;

  const response = await fetch(DOUBAO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DOUBAO_MODEL,
      messages: [
        { 
          role: "system", 
          content: "你是一位专业、温暖的幼儿园教师，擅长撰写发展评价评语。" 
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || originalComment;
}

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

// 评价等级配置
const EVALUATION_LEVELS = [
  { value: 5, label: '优秀', color: 'bg-emerald-500' },
  { value: 4, label: '良好', color: 'bg-blue-500' },
  { value: 3, label: '一般', color: 'bg-amber-500' },
  { value: 2, label: '需加强', color: 'bg-orange-500' },
  { value: 1, label: '待发展', color: 'bg-red-500' },
];

// 默认评价模板
const DEFAULT_TEMPLATES: EvaluationTemplate[] = [
  {
    id: 'lang_senior_1',
    name: '大班阅读、语言能力评价',
    targetGrade: '大班',
    domain: '语言',
    semester: '上学期',
    items: [
      { id: 'l1', name: '认真听并能听懂常用语言', levels: EVALUATION_LEVELS },
      { id: 'l2', name: '能根据指令做出相应反应', levels: EVALUATION_LEVELS },
      { id: 'l3', name: '愿意讲话并能清楚地表达', levels: EVALUATION_LEVELS },
      { id: 'l4', name: '能有序、连贯地讲述事情', levels: EVALUATION_LEVELS },
      { id: 'l5', name: '喜欢听故事、看图书', levels: EVALUATION_LEVELS },
      { id: 'l6', name: '能理解图书内容并讲述', levels: EVALUATION_LEVELS },
      { id: 'l7', name: '对汉字产生兴趣', levels: EVALUATION_LEVELS },
      { id: 'l8', name: '愿意用图画和符号表达想法', levels: EVALUATION_LEVELS },
      { id: 'l9', name: '正确书写自己的名字', levels: EVALUATION_LEVELS },
      { id: 'l10', name: '有良好的阅读习惯', levels: EVALUATION_LEVELS },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'art_junior_1',
    name: '小班幼儿艺术表现能力评价',
    targetGrade: '小班',
    domain: '艺术',
    semester: '上学期',
    items: [
      { id: 'a1', name: '喜欢自然界与生活中美的事物', levels: EVALUATION_LEVELS },
      { id: 'a2', name: '喜欢欣赏多种形式的艺术作品', levels: EVALUATION_LEVELS },
      { id: 'a3', name: '能用自己喜欢的方式进行艺术表现', levels: EVALUATION_LEVELS },
      { id: 'a4', name: '喜欢唱歌并能基本唱准', levels: EVALUATION_LEVELS },
      { id: 'a5', name: '能用身体动作表现音乐节奏', levels: EVALUATION_LEVELS },
      { id: 'a6', name: '喜欢涂涂画画', levels: EVALUATION_LEVELS },
      { id: 'a7', name: '能用简单材料进行手工制作', levels: EVALUATION_LEVELS },
      { id: 'a8', name: '乐于参与集体艺术活动', levels: EVALUATION_LEVELS },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const GrowthArchiveView: React.FC<GrowthArchiveViewProps> = ({ currentUser }) => {
  // 主标签页
  const [activeTab, setActiveTab] = useState<'archive' | 'evaluation'>('archive');
  
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

  // 评价相关状态
  const [templates, setTemplates] = useState<EvaluationTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<EvaluationTemplate | null>(null);
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([]);
  const [currentScores, setCurrentScores] = useState<Record<string, number>>({});
  const [teacherComment, setTeacherComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showEvaluationHistory, setShowEvaluationHistory] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);

  useEffect(() => {
    loadStudents();
    loadEvaluations();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentData(selectedStudent.id);
    }
  }, [selectedStudent]);

  const loadStudents = () => {
    const saved = localStorage.getItem('kt_students');
    if (saved) setStudents(JSON.parse(saved));
  };

  const loadEvaluations = () => {
    const saved = localStorage.getItem('kt_student_evaluations');
    if (saved) setEvaluations(JSON.parse(saved));
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

  // 获取学生的评价记录
  const studentEvaluations = useMemo(() => {
    if (!selectedStudent) return [];
    return evaluations.filter(e => e.studentId === selectedStudent.id);
  }, [selectedStudent, evaluations]);

  // 打印/导出PDF
  const handleExportPDF = () => {
    setIsGenerating(true);
    setPreviewMode(true);
    
    setTimeout(() => {
      window.print();
      setIsGenerating(false);
    }, 500);
  };

  // 选择评价模板
  const handleSelectTemplate = (template: EvaluationTemplate) => {
    setSelectedTemplate(template);
    setCurrentScores({});
    setTeacherComment('');
    
    // 检查是否有已保存的评价
    if (selectedStudent) {
      const existing = evaluations.find(
        e => e.studentId === selectedStudent.id && e.templateId === template.id && e.status === 'draft'
      );
      if (existing) {
        const scores: Record<string, number> = {};
        existing.scores.forEach(s => { scores[s.itemId] = s.score; });
        setCurrentScores(scores);
        setTeacherComment(existing.teacherComment || '');
      }
    }
  };

  // 更新评分
  const handleScoreChange = (itemId: string, score: number) => {
    setCurrentScores(prev => ({ ...prev, [itemId]: score }));
  };

  // 保存评价
  const handleSaveEvaluation = (status: 'draft' | 'completed') => {
    if (!selectedStudent || !selectedTemplate) return;
    
    setIsSaving(true);
    
    const scores: EvaluationScore[] = selectedTemplate.items.map(item => ({
      itemId: item.id,
      itemName: item.name,
      score: currentScores[item.id] || 0,
    }));
    
    const filledScores = scores.filter(s => s.score > 0);
    const totalScore = filledScores.reduce((sum, s) => sum + s.score, 0);
    const averageScore = filledScores.length > 0 ? totalScore / filledScores.length : 0;
    
    const evaluation: StudentEvaluation = {
      id: `eval_${selectedStudent.id}_${selectedTemplate.id}_${Date.now()}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      domain: selectedTemplate.domain,
      semester: selectedTemplate.semester,
      schoolYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      scores,
      totalScore,
      averageScore: Math.round(averageScore * 10) / 10,
      teacherComment,
      evaluatedBy: currentUser.name,
      evaluatedAt: new Date().toISOString(),
      status,
    };
    
    // 移除旧的草稿（如果有）
    const filtered = evaluations.filter(
      e => !(e.studentId === selectedStudent.id && e.templateId === selectedTemplate.id && e.status === 'draft')
    );
    
    const updated = [...filtered, evaluation];
    setEvaluations(updated);
    localStorage.setItem('kt_student_evaluations', JSON.stringify(updated));
    
    setTimeout(() => {
      setIsSaving(false);
      if (status === 'completed') {
        alert(`${selectedStudent.name}的${selectedTemplate.name}已保存完成！`);
        setSelectedTemplate(null);
        setCurrentScores({});
        setTeacherComment('');
      } else {
        alert('草稿已保存');
      }
    }, 500);
  };

  // 删除评价记录
  const handleDeleteEvaluation = (evalId: string) => {
    if (!confirm('确定删除这条评价记录吗？')) return;
    const updated = evaluations.filter(e => e.id !== evalId);
    setEvaluations(updated);
    localStorage.setItem('kt_student_evaluations', JSON.stringify(updated));
  };

  // AI润色教师评语
  const handlePolishComment = async () => {
    if (!selectedStudent || !selectedTemplate) return;
    
    setIsPolishing(true);
    
    try {
      // 计算当前平均分
      const filledScores = selectedTemplate.items.filter(item => currentScores[item.id] > 0);
      const avgScore = filledScores.length > 0 
        ? filledScores.reduce((sum, item) => sum + currentScores[item.id], 0) / filledScores.length 
        : 3;
      
      const polished = await polishTeacherComment(
        selectedStudent.name,
        selectedStudent.class,
        selectedTemplate.name,
        Math.round(avgScore * 10) / 10,
        teacherComment
      );
      
      setTeacherComment(polished);
    } catch (error: any) {
      console.error('AI润色失败:', error);
      alert(`AI润色失败: ${error.message || '请稍后重试'}`);
    } finally {
      setIsPolishing(false);
    }
  };

  // 计算完成进度
  const completionProgress = useMemo(() => {
    if (!selectedTemplate) return 0;
    const filled = selectedTemplate.items.filter(item => currentScores[item.id] > 0).length;
    return Math.round((filled / selectedTemplate.items.length) * 100);
  }, [selectedTemplate, currentScores]);

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
            成长档案 · 发展评价 · 在线填写
          </p>
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
              activeTab === 'archive'
                ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            成长档案
          </button>
          <button
            onClick={() => setActiveTab('evaluation')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
              activeTab === 'evaluation'
                ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            发展评价
            {studentEvaluations.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                {studentEvaluations.length}
              </span>
            )}
          </button>
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
              {filteredStudents.map(student => {
                const hasEval = evaluations.some(e => e.studentId === student.id);
                return (
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
                    <div className="text-left flex-1">
                      <p className="font-bold text-slate-800 flex items-center gap-2">
                        {student.name}
                        {hasEval && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      </p>
                      <p className="text-xs text-slate-500">{student.class} · {student.age}岁</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-bold">请从左侧选择一位学生</p>
              <p className="text-sm text-slate-400 mt-1">查看成长档案或填写发展评价</p>
            </div>
          ) : activeTab === 'archive' ? (
            /* 成长档案内容 */
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

              {/* 发展评价汇总 */}
              {studentEvaluations.filter(e => e.status === 'completed').length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:shadow-none print:border-slate-300">
                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                    发展评价记录
                  </h3>
                  <div className="space-y-3">
                    {studentEvaluations.filter(e => e.status === 'completed').slice(0, 3).map(ev => (
                      <div key={ev.id} className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-slate-800">{ev.templateName}</h4>
                          <span className="text-xs text-slate-400">
                            {new Date(ev.evaluatedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-black text-amber-600">{ev.averageScore}</p>
                            <p className="text-xs text-slate-500">平均分</p>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                                style={{ width: `${(ev.averageScore || 0) / 5 * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        {ev.teacherComment && (
                          <p className="text-sm text-slate-600 mt-2 italic">"{ev.teacherComment}"</p>
                        )}
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
          ) : (
            /* 发展评价内容 */
            <div className="space-y-6">
              {/* 学生信息卡 */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedStudent.avatar}
                    alt={selectedStudent.name}
                    className="w-16 h-16 rounded-2xl border-2 border-white/30"
                  />
                  <div>
                    <h2 className="text-2xl font-black">{selectedStudent.name}</h2>
                    <p className="text-white/80">{selectedStudent.class} · {selectedStudent.age}岁</p>
                  </div>
                </div>
              </div>

              {/* 评价历史 */}
              {studentEvaluations.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <button
                    onClick={() => setShowEvaluationHistory(!showEvaluationHistory)}
                    className="w-full flex items-center justify-between"
                  >
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                      已有评价记录 ({studentEvaluations.length})
                    </h3>
                    {showEvaluationHistory ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  
                  {showEvaluationHistory && (
                    <div className="mt-4 space-y-3">
                      {studentEvaluations.map(ev => (
                        <div key={ev.id} className="bg-slate-50 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-slate-800">{ev.templateName}</h4>
                              <p className="text-xs text-slate-500">
                                {new Date(ev.evaluatedAt).toLocaleDateString('zh-CN')} · 
                                {ev.evaluatedBy} · 
                                <span className={ev.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}>
                                  {ev.status === 'completed' ? '已完成' : '草稿'}
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-black text-amber-600">{ev.averageScore}</span>
                              <button
                                onClick={() => handleDeleteEvaluation(ev.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 选择评价模板 */}
              {!selectedTemplate ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4">选择评价表</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className="p-4 bg-slate-50 hover:bg-amber-50 rounded-xl text-left transition-all border-2 border-transparent hover:border-amber-300"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-xl ${DOMAIN_COLORS[template.domain]?.bg || 'bg-slate-100'}`}>
                            {(() => {
                              const domainConfig = DOMAIN_COLORS[template.domain];
                              if (domainConfig?.icon) {
                                const IconComp = domainConfig.icon;
                                return <IconComp className={`w-5 h-5 ${domainConfig.text}`} />;
                              }
                              return <ClipboardCheck className="w-5 h-5 text-slate-500" />;
                            })()}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{template.name}</h4>
                            <p className="text-xs text-slate-500">
                              {template.targetGrade} · {template.domain} · {template.semester}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600">
                          共 {template.items.length} 项评价指标
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* 填写评价表 */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  {/* 评价表头部 */}
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800">{selectedTemplate.name}</h3>
                      <p className="text-sm text-slate-500">
                        {selectedTemplate.targetGrade} · {selectedTemplate.domain} · {selectedTemplate.semester}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="p-2 hover:bg-slate-100 rounded-lg"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  {/* 进度条 */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-600">填写进度</span>
                      <span className="text-sm font-bold text-amber-600">{completionProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                        style={{ width: `${completionProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* 评价项目 */}
                  <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                    {selectedTemplate.items.map((item, idx) => (
                      <div key={item.id} className="p-4 bg-slate-50 rounded-xl">
                        <p className="font-bold text-slate-800 mb-3">
                          {idx + 1}. {item.name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {EVALUATION_LEVELS.map(level => (
                            <button
                              key={level.value}
                              onClick={() => handleScoreChange(item.id, level.value)}
                              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                currentScores[item.id] === level.value
                                  ? `${level.color} text-white shadow-lg`
                                  : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
                              }`}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 教师评语 */}
                  <div className="p-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-slate-700">教师评语（选填）</label>
                      <button
                        type="button"
                        onClick={handlePolishComment}
                        disabled={isPolishing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 shadow-sm"
                      >
                        {isPolishing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            润色中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            AI润色
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={teacherComment}
                      onChange={e => setTeacherComment(e.target.value)}
                      placeholder="请输入对该学生的整体评价，或点击AI润色自动生成..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none h-24"
                    />
                    {isPolishing && (
                      <p className="text-xs text-purple-500 mt-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI正在根据评价结果生成专业评语...
                      </p>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="p-4 border-t border-slate-200 flex gap-3">
                    <button
                      onClick={() => handleSaveEvaluation('draft')}
                      disabled={isSaving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      保存草稿
                    </button>
                    <button
                      onClick={() => handleSaveEvaluation('completed')}
                      disabled={isSaving || completionProgress < 100}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      完成评价
                    </button>
                  </div>
                </div>
              )}
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
