
import React, { useState, useEffect } from 'react';
import { 
  Plus, BookOpen, Lightbulb, Music, Paintbrush, Sun, Trash2, Edit2, Check, X,
  Camera, Image, Eye, FileText, Sparkles, Search, Filter, Heart, Users,
  Calendar, Clock, Star, MessageSquare, Download, Share2, ZoomIn, Grid, List, Lock
} from 'lucide-react';
import { User } from '../types';
import { hasPermission } from '../services/permissionService';

interface CurriculumViewProps {
  currentUser: User;
}

interface ActivityItem {
  id: string;
  time: string;
  activity: string;
  type: 'arts' | 'music' | 'play' | 'reading' | 'food';
}

// AI相册照片
interface AlbumPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  className: string;
  studentNames?: string[];
  tags: string[];
  activity?: string;
  capturedAt: string;
  uploadedBy: string;
  likes: number;
  aiGenerated?: boolean;
  aiDescription?: string;
}

// AI观察记录
interface ObservationRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string;
  domain: '健康' | '语言' | '社会' | '科学' | '艺术';
  title: string;
  observation: string;
  analysis?: string;
  aiSuggestion?: string;
  mediaUrls?: string[];
  tags: string[];
  recordedBy: string;
  createdAt: string;
  sharedToParent: boolean;
}

// 空白课程表模板，由教师自行填充
const EMPTY_SCHEDULE: Record<string, ActivityItem[]> = {
  '周一': [], '周二': [], '周三': [], '周四': [], '周五': []
};

const iconMap = {
  play: { icon: Sun, color: 'text-amber-500 bg-amber-50' },
  music: { icon: Music, color: 'text-purple-500 bg-purple-50' },
  arts: { icon: Paintbrush, color: 'text-pink-500 bg-pink-50' },
  reading: { icon: BookOpen, color: 'text-blue-500 bg-blue-50' },
  food: { icon: Sun, color: 'text-orange-500 bg-orange-50' },
};

const DOMAIN_COLORS = {
  '健康': 'bg-emerald-100 text-emerald-700',
  '语言': 'bg-blue-100 text-blue-700',
  '社会': 'bg-amber-100 text-amber-700',
  '科学': 'bg-purple-100 text-purple-700',
  '艺术': 'bg-pink-100 text-pink-700',
};

type ViewMode = 'SCHEDULE' | 'ALBUM' | 'OBSERVATION';

const CurriculumView: React.FC<CurriculumViewProps> = ({ currentUser }) => {
  // 权限检查
  const canEdit = hasPermission(currentUser.role, 'curriculum.edit');
  const [viewMode, setViewMode] = useState<ViewMode>('SCHEDULE');
  const [activeDay, setActiveDay] = useState('周一');
  const [theme, setTheme] = useState(() => localStorage.getItem('kt_theme') || '');
  const [isEditingTheme, setIsEditingTheme] = useState(false);
  const [schedule, setSchedule] = useState<Record<string, ActivityItem[]>>(() => {
    const saved = localStorage.getItem('kt_schedule');
    return saved ? JSON.parse(saved) : EMPTY_SCHEDULE;
  });
  const [isAdding, setIsAdding] = useState(false);
  
  // AI相册
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<AlbumPhoto | null>(null);
  const [photoViewMode, setPhotoViewMode] = useState<'grid' | 'list'>('grid');
  const [photoFilter, setPhotoFilter] = useState<string>('all');
  
  // AI观察记录
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [selectedObservation, setSelectedObservation] = useState<ObservationRecord | null>(null);
  const [domainFilter, setDomainFilter] = useState<string>('all');

  useEffect(() => {
    localStorage.setItem('kt_schedule', JSON.stringify(schedule));
    localStorage.setItem('kt_theme', theme);
  }, [schedule, theme]);
  
  useEffect(() => {
    // 加载AI相册
    const savedPhotos = localStorage.getItem('kt_album_photos');
    if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
    
    // 加载观察记录
    const savedObservations = localStorage.getItem('kt_observations');
    if (savedObservations) setObservations(JSON.parse(savedObservations));
  }, []);

  const addActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newItem: ActivityItem = {
      id: Math.random().toString(36).substr(2, 9),
      time: formData.get('time') as string,
      activity: formData.get('activity') as string,
      type: formData.get('type') as any,
    };
    setSchedule(prev => ({
      ...prev,
      [activeDay]: [...(prev[activeDay] || []), newItem].sort((a, b) => a.time.localeCompare(b.time))
    }));
    setIsAdding(false);
  };

  const deleteActivity = (day: string, id: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day].filter(item => item.id !== id)
    }));
  };
  
  // 保存照片
  const savePhoto = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newPhoto: AlbumPhoto = {
      id: Date.now().toString(),
      url: fd.get('url') as string || `https://picsum.photos/seed/${Date.now()}/800/600`,
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      className: fd.get('className') as string,
      studentNames: (fd.get('students') as string).split(',').map(s => s.trim()).filter(Boolean),
      tags: (fd.get('tags') as string).split(',').map(s => s.trim()).filter(Boolean),
      activity: fd.get('activity') as string,
      capturedAt: fd.get('capturedAt') as string || new Date().toISOString(),
      uploadedBy: '当前用户',
      likes: 0,
      aiGenerated: false,
      aiDescription: '这是一张记录幼儿活动的精彩瞬间',
    };
    const updated = [newPhoto, ...photos];
    setPhotos(updated);
    localStorage.setItem('kt_album_photos', JSON.stringify(updated));
    setIsPhotoModalOpen(false);
  };
  
  // 保存观察记录
  const saveObservation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newRecord: ObservationRecord = {
      id: Date.now().toString(),
      studentId: fd.get('studentId') as string || Date.now().toString(),
      studentName: fd.get('studentName') as string,
      className: fd.get('className') as string,
      date: fd.get('date') as string || new Date().toISOString().split('T')[0],
      domain: fd.get('domain') as '健康' | '语言' | '社会' | '科学' | '艺术',
      title: fd.get('title') as string,
      observation: fd.get('observation') as string,
      analysis: fd.get('analysis') as string,
      tags: (fd.get('tags') as string).split(',').map(s => s.trim()).filter(Boolean),
      recordedBy: '当前用户',
      createdAt: new Date().toISOString(),
      sharedToParent: fd.get('shareToParent') === 'on',
      aiSuggestion: generateAISuggestion(fd.get('domain') as string, fd.get('observation') as string),
    };
    const updated = [newRecord, ...observations];
    setObservations(updated);
    localStorage.setItem('kt_observations', JSON.stringify(updated));
    setIsObservationModalOpen(false);
  };
  
  // AI生成教育建议
  const generateAISuggestion = (domain: string, observation: string): string => {
    const suggestions: Record<string, string[]> = {
      '健康': [
        '建议增加户外大肌肉运动时间，促进身体协调发展',
        '可以通过游戏方式引导正确的饮食习惯',
        '注意观察幼儿情绪变化，及时给予心理支持',
      ],
      '语言': [
        '鼓励幼儿多表达，可使用绘本进行语言拓展',
        '创设丰富的语言环境，增加词汇输入',
        '通过角色扮演游戏促进语言表达能力',
      ],
      '社会': [
        '提供更多合作游戏机会，培养社交技能',
        '通过小组活动增强集体意识和团队协作',
        '引导幼儿学习分享和轮流，建立社交规则意识',
      ],
      '科学': [
        '提供探索材料，支持幼儿的好奇心发展',
        '通过简单实验引导科学思维',
        '鼓励提问和假设，培养探究精神',
      ],
      '艺术': [
        '提供多样化的艺术材料，激发创造力',
        '欣赏不同风格的艺术作品，拓展审美视野',
        '鼓励自由创作，尊重个性化表达',
      ],
    };
    const domainSuggestions = suggestions[domain] || suggestions['健康'];
    return domainSuggestions[Math.floor(Math.random() * domainSuggestions.length)];
  };
  
  // 获取相册照片分类
  const allClasses = [...new Set(photos.map(p => p.className))];
  const filteredPhotos = photoFilter === 'all' ? photos : photos.filter(p => p.className === photoFilter);
  
  // 获取观察记录分类
  const filteredObservations = domainFilter === 'all' ? observations : observations.filter(o => o.domain === domainFilter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 页面标题和视图切换 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-brand">课程与教学</h1>
          <p className="text-slate-400 text-sm">课程计划 · AI相册 · 观察记录</p>
        </div>
        
        {/* 视图切换 */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100">
          <button 
            onClick={() => setViewMode('SCHEDULE')} 
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'SCHEDULE' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Calendar className="w-4 h-4" />课程计划
          </button>
          <button 
            onClick={() => setViewMode('ALBUM')} 
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'ALBUM' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Camera className="w-4 h-4" />AI相册
          </button>
          <button 
            onClick={() => setViewMode('OBSERVATION')} 
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'OBSERVATION' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Eye className="w-4 h-4" />AI观察记录
          </button>
        </div>
      </div>

      {/* 课程计划视图 */}
      {viewMode === 'SCHEDULE' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => !isEditingTheme && setIsEditingTheme(true)}>
              {isEditingTheme ? (
                <div className="flex items-center gap-2">
                  <input 
                    autoFocus
                    className="bg-white border-b-2 border-orange-500 font-bold text-orange-600 outline-none"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    onBlur={() => setIsEditingTheme(false)}
                    onKeyPress={(e) => e.key === 'Enter' && setIsEditingTheme(false)}
                  />
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
              ) : (
                <>
                  <p className="text-slate-500">本周主题: <span className="text-orange-600 font-bold">{theme}</span></p>
                  <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </div>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-orange-100 hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4" /> 添加活动
            </button>
          </div>

          <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            {['周一', '周二', '周三', '周四', '周五'].map((day) => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex-1 min-w-[80px] py-3 rounded-xl font-bold text-xs transition-all ${
                  activeDay === day 
                    ? 'bg-orange-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {(schedule[activeDay] || []).length === 0 && !isAdding && (
                <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">当日暂无教学安排。</p>
                  <button onClick={() => setIsAdding(true)} className="text-orange-600 font-bold mt-2 hover:underline">现在开始规划</button>
                </div>
              )}

              {isAdding && (
                <form onSubmit={addActivity} className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-200 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <input required name="time" type="time" className="px-3 py-2 rounded-lg border border-orange-200 outline-none focus:ring-2 focus:ring-orange-500" />
                    <input required name="activity" placeholder="活动名称..." className="px-3 py-2 rounded-lg border border-orange-200 outline-none focus:ring-2 focus:ring-orange-500 md:col-span-2" />
                    <select name="type" className="px-3 py-2 rounded-lg border border-orange-200 outline-none bg-white">
                      <option value="play">户外/游戏</option>
                      <option value="music">音乐/艺术</option>
                      <option value="arts">手工/美术</option>
                      <option value="reading">阅读/语言</option>
                      <option value="food">进餐/休息</option>
                    </select>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 font-bold text-sm">取消</button>
                    <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm">确认添加</button>
                  </div>
                </form>
              )}

              {(schedule[activeDay] || []).map((item) => {
                const style = iconMap[item.type];
                return (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 md:gap-6 group hover:border-orange-200 transition-all">
                    <div className="w-12 font-bold text-slate-400 text-xs">{item.time}</div>
                    <div className={`p-3 rounded-xl shrink-0 ${style.color}`}>
                      <style.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 font-bold text-slate-800 text-base">{item.activity}</div>
                    <button onClick={() => deleteActivity(activeDay, item.id)} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <Lightbulb className="w-6 h-6 text-amber-300" />
                  <h3 className="font-bold text-lg">AI 教学贴士</h3>
                </div>
                <p className="text-white/80 text-sm leading-relaxed">
                  本周主题：<b>{theme}</b>。建议在户外活动中加入 30 分钟的自然探索，引导幼儿寻找并收集不同颜色的落叶，培养观察力。
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI相册视图 */}
      {viewMode === 'ALBUM' && (
        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <select 
                value={photoFilter} 
                onChange={(e) => setPhotoFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold"
              >
                <option value="all">全部班级</option>
                {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-xl p-1">
                <button 
                  onClick={() => setPhotoViewMode('grid')}
                  className={`p-2 rounded-lg ${photoViewMode === 'grid' ? 'bg-pink-100 text-pink-600' : 'text-slate-400'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setPhotoViewMode('list')}
                  className={`p-2 rounded-lg ${photoViewMode === 'list' ? 'bg-pink-100 text-pink-600' : 'text-slate-400'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button 
              onClick={() => setIsPhotoModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />上传照片
            </button>
          </div>

          {/* 照片展示 */}
          {photoViewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map(photo => (
                <div 
                  key={photo.id} 
                  className="bg-white rounded-2xl overflow-hidden border border-slate-100 group cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <div className="aspect-square overflow-hidden relative">
                    <img src={photo.url} alt={photo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <div className="flex items-center gap-2 text-white">
                        <Heart className="w-4 h-4" />
                        <span className="text-sm font-bold">{photo.likes}</span>
                      </div>
                    </div>
                    {photo.aiGenerated && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded text-white text-xs font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />AI
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{photo.title}</h3>
                    <p className="text-xs text-slate-400">{photo.className}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPhotos.map(photo => (
                <div 
                  key={photo.id} 
                  className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img src={photo.url} alt={photo.title} className="w-20 h-20 rounded-xl object-cover" />
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">{photo.title}</h3>
                    <p className="text-sm text-slate-400">{photo.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400">{photo.className}</span>
                      <span className="text-xs text-slate-400">{new Date(photo.capturedAt).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1 text-pink-500">
                        <Heart className="w-3 h-3" />
                        <span className="text-xs font-bold">{photo.likes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {filteredPhotos.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <Camera className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">暂无照片</p>
              <button onClick={() => setIsPhotoModalOpen(true)} className="text-pink-600 font-bold mt-2 hover:underline">
                上传第一张照片
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI观察记录视图 */}
      {viewMode === 'OBSERVATION' && (
        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <select 
                value={domainFilter} 
                onChange={(e) => setDomainFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold"
              >
                <option value="all">全部领域</option>
                <option value="健康">健康领域</option>
                <option value="语言">语言领域</option>
                <option value="社会">社会领域</option>
                <option value="科学">科学领域</option>
                <option value="艺术">艺术领域</option>
              </select>
              <div className="bg-indigo-100 px-4 py-2 rounded-xl">
                <span className="text-indigo-700 font-bold text-sm">本月观察: {observations.length}条</span>
              </div>
            </div>
            <button 
              onClick={() => setIsObservationModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />添加观察记录
            </button>
          </div>

          {/* 观察记录列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredObservations.map(record => (
              <div key={record.id} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">{record.title}</h3>
                    <p className="text-sm text-slate-400">{record.studentName} · {record.className}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${DOMAIN_COLORS[record.domain]}`}>
                    {record.domain}
                  </span>
                </div>
                
                <p className="text-sm text-slate-600 mb-4 line-clamp-3">{record.observation}</p>
                
                {record.aiSuggestion && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-600">AI教育建议</span>
                    </div>
                    <p className="text-sm text-indigo-700">{record.aiSuggestion}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">{record.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.sharedToParent && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">已分享</span>
                    )}
                    <span className="text-xs text-slate-400">{record.recordedBy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredObservations.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <Eye className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">暂无观察记录</p>
              <button onClick={() => setIsObservationModalOpen(true)} className="text-indigo-600 font-bold mt-2 hover:underline">
                添加第一条观察记录
              </button>
            </div>
          )}
        </div>
      )}

      {/* 上传照片弹窗 */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={savePhoto} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Camera className="w-6 h-6 text-pink-500" />
              上传照片
            </h2>
            
            <div className="space-y-4">
              <input name="url" placeholder="照片URL（留空使用随机图片）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold" />
              <input required name="title" placeholder="照片标题 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold" />
              <textarea name="description" placeholder="照片描述" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold resize-none" />
              
              <div className="grid grid-cols-2 gap-4">
                <select required name="className" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold">
                  <option value="">选择班级 *</option>
                  <option>智狼班</option><option>勇熊班</option><option>灵狐班</option><option>幼狮班</option>
                  <option>小班</option><option>中班</option><option>大班</option>
                </select>
                <input name="activity" placeholder="活动名称" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold" />
              </div>
              
              <input name="students" placeholder="相关幼儿（逗号分隔）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold" />
              <input name="tags" placeholder="标签（逗号分隔，如：户外,游戏）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold" />
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-pink-600 text-white rounded-xl font-bold shadow-lg">上传</button>
            </div>
          </form>
        </div>
      )}

      {/* 观察记录弹窗 */}
      {isObservationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveObservation} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95 my-8">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Eye className="w-6 h-6 text-indigo-500" />
              添加观察记录
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required name="studentName" placeholder="幼儿姓名 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                <select required name="className" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                  <option value="">班级 *</option>
                  <option>智狼班</option><option>勇熊班</option><option>灵狐班</option><option>幼狮班</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                <select required name="domain" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                  <option value="">发展领域 *</option>
                  <option value="健康">健康领域</option>
                  <option value="语言">语言领域</option>
                  <option value="社会">社会领域</option>
                  <option value="科学">科学领域</option>
                  <option value="艺术">艺术领域</option>
                </select>
              </div>
              
              <input required name="title" placeholder="观察标题 *（如：学会分享玩具）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
              
              <textarea required name="observation" placeholder="观察内容 *（详细描述幼儿的行为表现）" rows={4} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold resize-none" />
              
              <textarea name="analysis" placeholder="教师分析（对观察到的行为进行专业分析）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold resize-none" />
              
              <input name="tags" placeholder="标签（逗号分隔）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="shareToParent" className="w-4 h-4 rounded text-indigo-600" />
                <span className="text-sm font-bold text-slate-600">分享给家长</span>
              </label>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsObservationModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">保存记录</button>
            </div>
          </form>
        </div>
      )}

      {/* 照片详情弹窗 */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="aspect-video overflow-hidden">
              <img src={selectedPhoto.url} alt={selectedPhoto.title} className="w-full h-full object-cover" />
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{selectedPhoto.title}</h2>
                  <p className="text-slate-400">{selectedPhoto.description}</p>
                </div>
                <button onClick={() => setSelectedPhoto(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              {selectedPhoto.aiDescription && (
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-xl mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-pink-600" />
                    <span className="text-xs font-bold text-pink-600">AI描述</span>
                  </div>
                  <p className="text-sm text-pink-700">{selectedPhoto.aiDescription}</p>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-400">{selectedPhoto.className}</span>
                  <span className="text-sm text-slate-400">{new Date(selectedPhoto.capturedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-pink-100 rounded-xl text-pink-600">
                    <Heart className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurriculumView;
