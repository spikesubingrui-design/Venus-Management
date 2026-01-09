/**
 * AI观察记录视图
 * 教师记录流水账/拍摄照片，AI基于《3-6岁指南》自动润色生成专业观察记录
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BookOpen, Camera, Video, Sparkles, Send, FileText, Users,
  ChevronRight, ChevronDown, Clock, CheckCircle2, Share2,
  Loader2, Search, Filter, Eye, Edit3, Trash2, Star,
  Brain, Lightbulb, Heart, MessageCircle, Plus, Upload, X, Image
} from 'lucide-react';
import { User, Student, ObservationDraft, ProfessionalObservation } from '../types';
import {
  saveDraft,
  getDrafts,
  getProfessionalObservations,
  generateProfessionalObservation,
  shareToParent,
  deleteDraft,
  saveProfessionalObservation
} from '../services/observationService';

interface ObservationViewProps {
  currentUser: User;
}

const DOMAINS = ['健康', '语言', '社会', '科学', '艺术'] as const;
const ACTIVITIES = ['晨间活动', '集体教学', '区域活动', '户外活动', '进餐', '午睡', '离园', '自由游戏', '其他'];

const ObservationView: React.FC<ObservationViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'record' | 'drafts' | 'professional'>('record');
  const [students, setStudents] = useState<Student[]>([]);
  const [drafts, setDrafts] = useState<ObservationDraft[]>([]);
  const [professionalObs, setProfessionalObs] = useState<ProfessionalObservation[]>([]);
  
  // 新记录表单
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [rawContent, setRawContent] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<typeof DOMAINS[number] | ''>('');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AI生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingText, setGeneratingText] = useState('');
  const [selectedDraft, setSelectedDraft] = useState<ObservationDraft | null>(null);
  
  // 编辑状态
  const [editingObs, setEditingObs] = useState<ProfessionalObservation | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProfessionalObservation>>({});
  
  // 筛选
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [expandedObs, setExpandedObs] = useState<string | null>(null);

  // 处理图片文件转换为 base64
  const handleFileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('请上传图片文件'));
        return;
      }
      
      // 限制文件大小 5MB
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('图片大小不能超过5MB'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        // 压缩图片
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 1200; // 最大尺寸
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }, []);

  // 处理文件上传
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newPhotos: string[] = [];
    for (let i = 0; i < Math.min(files.length, 9 - uploadedPhotos.length); i++) {
      try {
        const base64 = await handleFileToBase64(files[i]);
        newPhotos.push(base64);
      } catch (error) {
        console.error('图片处理失败:', error);
        alert(error instanceof Error ? error.message : '图片处理失败');
      }
    }
    
    if (newPhotos.length > 0) {
      setUploadedPhotos(prev => [...prev, ...newPhotos]);
    }
  }, [uploadedPhotos.length, handleFileToBase64]);

  // 拖拽处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  // 删除已上传的图片
  const removePhoto = useCallback((index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const savedStudents = localStorage.getItem('kt_students_local');
    if (savedStudents) setStudents(JSON.parse(savedStudents));
    
    setDrafts(getDrafts());
    setProfessionalObs(getProfessionalObservations());
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

  // 保存草稿
  const handleSaveDraft = () => {
    if (!selectedStudent || (!rawContent.trim() && uploadedPhotos.length === 0)) return;

    const draft: ObservationDraft = {
      id: `draft_${selectedStudent.id}_${Date.now()}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      class: selectedStudent.class,
      rawContent: rawContent.trim(),
      recordType: uploadedPhotos.length > 0 ? 'photo' : 'text',
      photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
      observedAt: new Date().toISOString(),
      domain: selectedDomain || undefined,
      activity: selectedActivity || undefined,
      recordedBy: currentUser.name,
      recordedAt: new Date().toISOString(),
      aiProcessed: false,
    };

    saveDraft(draft);
    setDrafts(getDrafts());
    
    // 清空表单
    setRawContent('');
    setSelectedDomain('');
    setSelectedActivity('');
    setSelectedStudent(null);
    setUploadedPhotos([]);
    
    // 切换到草稿列表
    setActiveTab('drafts');
  };

  // AI润色生成
  const handleGenerateAI = async (draft: ObservationDraft) => {
    const student = students.find(s => s.id === draft.studentId);
    if (!student) return;

    setSelectedDraft(draft);
    setIsGenerating(true);
    setGeneratingText('');

    try {
      await generateProfessionalObservation(draft, student, (text) => {
        setGeneratingText(text);
      });
      
      // 刷新数据
      setDrafts(getDrafts());
      setProfessionalObs(getProfessionalObservations());
      setActiveTab('professional');
    } catch (error) {
      console.error('AI生成失败:', error);
    } finally {
      setIsGenerating(false);
      setSelectedDraft(null);
    }
  };

  // 分享给家长
  const handleShare = (obsId: string) => {
    shareToParent(obsId);
    setProfessionalObs(getProfessionalObservations());
  };

  // 删除草稿
  const handleDeleteDraft = (draftId: string) => {
    if (confirm('确定删除这条记录吗？')) {
      deleteDraft(draftId);
      setDrafts(getDrafts());
    }
  };

  // 开始编辑专业观察记录
  const handleStartEdit = (obs: ProfessionalObservation) => {
    setEditingObs(obs);
    setEditForm({
      title: obs.title,
      background: obs.background,
      behavior: obs.behavior,
      analysis: obs.analysis,
      developmentLevel: obs.developmentLevel,
      suggestions: [...obs.suggestions],
      parentTips: obs.parentTips || '',
    });
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingObs) return;
    
    const updatedObs: ProfessionalObservation = {
      ...editingObs,
      ...editForm,
      suggestions: editForm.suggestions || [],
      updatedAt: new Date().toISOString(),
    };
    
    saveProfessionalObservation(updatedObs);
    setProfessionalObs(getProfessionalObservations());
    setEditingObs(null);
    setEditForm({});
  };

  // 更新建议列表
  const handleUpdateSuggestion = (index: number, value: string) => {
    const newSuggestions = [...(editForm.suggestions || [])];
    newSuggestions[index] = value;
    setEditForm({ ...editForm, suggestions: newSuggestions });
  };

  // 添加建议
  const handleAddSuggestion = () => {
    const newSuggestions = [...(editForm.suggestions || []), ''];
    setEditForm({ ...editForm, suggestions: newSuggestions });
  };

  // 删除建议
  const handleRemoveSuggestion = (index: number) => {
    const newSuggestions = (editForm.suggestions || []).filter((_, i) => i !== index);
    setEditForm({ ...editForm, suggestions: newSuggestions });
  };

  return (
    <div className="p-6 space-y-6 page-transition">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            AI观察记录
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            记录流水账，AI基于《3-6岁指南》自动生成专业观察记录
          </p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex border-b border-slate-200">
          {[
            { id: 'record', label: '快速记录', icon: Edit3 },
            { id: 'drafts', label: '草稿箱', icon: FileText, count: drafts.filter(d => !d.aiProcessed).length },
            { id: 'professional', label: '专业记录', icon: Star, count: professionalObs.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* 快速记录 */}
          {activeTab === 'record' && (
            <div className="space-y-6">
              {/* 选择学生 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">
                  选择观察对象
                </label>
                <div className="flex gap-3 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="搜索学生姓名..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>
                  <select
                    value={filterClass}
                    onChange={e => setFilterClass(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                  >
                    <option value="all">全部班级</option>
                    {classes.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                
                {selectedStudent ? (
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <img
                      src={selectedStudent.avatar}
                      alt={selectedStudent.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-bold text-slate-800">{selectedStudent.name}</p>
                      <p className="text-xs text-slate-500">{selectedStudent.class} · {selectedStudent.age}岁</p>
                    </div>
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="ml-auto text-purple-600 hover:text-purple-800 text-sm font-bold"
                    >
                      重新选择
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
                    {filteredStudents.slice(0, 24).map(student => (
                      <button
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className="flex flex-col items-center p-2 rounded-xl hover:bg-purple-50 transition-colors"
                      >
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-10 h-10 rounded-full mb-1"
                        />
                        <span className="text-xs font-bold text-slate-700 truncate w-full text-center">
                          {student.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 观察内容 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  观察记录（流水账即可）
                </label>
                <textarea
                  value={rawContent}
                  onChange={e => setRawContent(e.target.value)}
                  placeholder="例如：今天区域活动时，小明在建构区搭了一个很高的塔，倒了3次都没放弃，最后成功搭了8层..."
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* 照片上传区域 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  上传照片（可选，最多9张）
                </label>
                
                {/* 拖拽上传区域 */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-300 hover:border-purple-400 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => handleFileUpload(e.target.files)}
                    className="hidden"
                  />
                  
                  <div className="flex flex-col items-center gap-2">
                    {isDragging ? (
                      <>
                        <Upload className="w-10 h-10 text-purple-500 animate-bounce" />
                        <p className="text-purple-600 font-bold">松开鼠标上传照片</p>
                      </>
                    ) : (
                      <>
                        <Camera className="w-10 h-10 text-slate-400" />
                        <p className="text-slate-600 font-bold">拖拽照片到此处上传</p>
                        <p className="text-slate-400 text-sm">或点击选择照片 · 支持 JPG、PNG · 单张最大 5MB</p>
                      </>
                    )}
                  </div>
                </div>

                {/* 已上传的照片预览 */}
                {uploadedPhotos.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 md:grid-cols-5 gap-3">
                    {uploadedPhotos.map((photo, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img
                          src={photo}
                          alt={`照片 ${index + 1}`}
                          className="w-full h-full object-cover rounded-xl border border-slate-200"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhoto(index);
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {/* 添加更多照片按钮 */}
                    {uploadedPhotos.length < 9 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-purple-400 hover:bg-purple-50 transition-all"
                      >
                        <Plus className="w-6 h-6 text-slate-400" />
                        <span className="text-xs text-slate-400">添加</span>
                      </button>
                    )}
                  </div>
                )}
                
                {uploadedPhotos.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    已上传 {uploadedPhotos.length}/9 张照片
                  </p>
                )}
              </div>

              {/* 领域和活动 */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    发展领域（可选）
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DOMAINS.map(domain => (
                      <button
                        key={domain}
                        onClick={() => setSelectedDomain(selectedDomain === domain ? '' : domain)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          selectedDomain === domain
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {domain}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    活动场景（可选）
                  </label>
                  <select
                    value={selectedActivity}
                    onChange={e => setSelectedActivity(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                  >
                    <option value="">请选择活动场景</option>
                    {ACTIVITIES.map(act => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={!selectedStudent || (!rawContent.trim() && uploadedPhotos.length === 0)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-5 h-5" />
                  保存到草稿
                </button>
              </div>

              {/* 提示 */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-sm text-amber-700">
                  <Lightbulb className="w-4 h-4 inline mr-2" />
                  <strong>小贴士：</strong>只需记录您观察到的现象，AI会自动润色成专业的观察记录，并关联《3-6岁儿童学习与发展指南》给出教育建议。
                </p>
              </div>
            </div>
          )}

          {/* 草稿箱 */}
          {activeTab === 'drafts' && (
            <div className="space-y-4">
              {drafts.filter(d => !d.aiProcessed).length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-bold">暂无草稿</p>
                  <p className="text-sm mt-1">快去记录一条观察吧！</p>
                </div>
              ) : (
                drafts.filter(d => !d.aiProcessed).map(draft => (
                  <div
                    key={draft.id}
                    className="bg-slate-50 rounded-xl p-5 border border-slate-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="font-bold text-purple-600">{draft.studentName[0]}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 flex items-center gap-2">
                            {draft.studentName}
                            {draft.photos && draft.photos.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                                <Image className="w-3 h-3" />
                                {draft.photos.length}张照片
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {draft.class} · {draft.domain || '未分类'} · {draft.activity || '未指定场景'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(draft.recordedAt).toLocaleString()}
                      </span>
                    </div>

                    {/* 显示照片 */}
                    {draft.photos && draft.photos.length > 0 && (
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mb-3">
                        {draft.photos.slice(0, 6).map((photo, idx) => (
                          <div key={idx} className="relative aspect-square">
                            <img
                              src={photo}
                              alt={`观察照片 ${idx + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                            {idx === 5 && draft.photos!.length > 6 && (
                              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">+{draft.photos!.length - 6}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {draft.rawContent && (
                      <p className="text-slate-700 mb-4 line-clamp-3">{draft.rawContent}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateAI(draft)}
                        disabled={isGenerating}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {isGenerating && selectedDraft?.id === draft.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            AI生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI润色生成
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* AI生成中的预览 */}
              {isGenerating && generatingText && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-100 rounded-xl">
                        <Brain className="w-6 h-6 text-purple-600 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">AI正在生成专业观察记录...</h3>
                        <p className="text-xs text-slate-500">基于《3-6岁儿童学习与发展指南》分析</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono">
                      {generatingText}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 专业记录 */}
          {activeTab === 'professional' && (
            <div className="space-y-4">
              {professionalObs.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-bold">暂无专业记录</p>
                  <p className="text-sm mt-1">先在草稿箱中使用AI生成</p>
                </div>
              ) : (
                professionalObs.map(obs => (
                  <div
                    key={obs.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                  >
                    {/* 头部 */}
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedObs(expandedObs === obs.id ? null : obs.id)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedObs === obs.id ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                        <div>
                          <p className="font-bold text-slate-800">{obs.title}</p>
                          <p className="text-xs text-slate-500">
                            {obs.studentName} · {obs.class} · {new Date(obs.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {obs.sharedToParent ? (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                            已分享
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                            未分享
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 展开内容 */}
                    {expandedObs === obs.id && (
                      <div className="px-4 pb-4 border-t border-slate-100">
                        <div className="space-y-4 mt-4">
                          {/* 观察背景 */}
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">观察背景</h4>
                            <p className="text-slate-700">{obs.background}</p>
                          </div>

                          {/* 行为描述 */}
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">行为描述</h4>
                            <p className="text-slate-700">{obs.behavior}</p>
                          </div>

                          {/* 行为分析 */}
                          <div className="bg-purple-50 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-purple-600 uppercase mb-1 flex items-center gap-1">
                              <Brain className="w-3 h-3" />
                              行为分析
                            </h4>
                            <p className="text-slate-700">{obs.analysis}</p>
                          </div>

                          {/* 发展水平 */}
                          <div className="bg-blue-50 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-blue-600 uppercase mb-1">发展水平评估</h4>
                            <p className="text-slate-700">{obs.developmentLevel}</p>
                          </div>

                          {/* 教育建议 */}
                          <div className="bg-emerald-50 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3" />
                              教育建议
                            </h4>
                            <ul className="space-y-1">
                              {obs.suggestions.map((suggestion, idx) => (
                                <li key={idx} className="text-slate-700 flex items-start gap-2">
                                  <span className="text-emerald-500 font-bold">{idx + 1}.</span>
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* 家长沟通建议 */}
                          {obs.parentTips && (
                            <div className="bg-amber-50 rounded-xl p-4">
                              <h4 className="text-xs font-bold text-amber-600 uppercase mb-1 flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                家长沟通建议
                              </h4>
                              <p className="text-slate-700">{obs.parentTips}</p>
                            </div>
                          )}

                          {/* 指南关联 */}
                          {obs.guidelineRefs && obs.guidelineRefs.length > 0 && (
                            <div className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                              <p className="font-bold mb-1">《3-6岁指南》关联：</p>
                              {obs.guidelineRefs.map((ref, idx) => (
                                <p key={idx}>• {ref.domain} - {ref.goal}</p>
                              ))}
                            </div>
                          )}

                          {/* 操作按钮 */}
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(obs);
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              编辑修改
                            </button>
                            {!obs.sharedToParent && (
                              <button
                                onClick={() => handleShare(obs.id)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                              >
                                <Share2 className="w-4 h-4" />
                                分享给家长
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 编辑观察记录模态框 */}
          {editingObs && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 头部 */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-xl">
                      <Edit3 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">编辑观察记录</h3>
                      <p className="text-xs text-slate-500">{editingObs.studentName} · {editingObs.class}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingObs(null); setEditForm({}); }}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* 表单内容 */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {/* 标题 */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">观察标题</label>
                    <input
                      type="text"
                      value={editForm.title || ''}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                      placeholder="例如：小明在建构区的专注力表现"
                    />
                  </div>

                  {/* 观察背景 */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">观察背景</label>
                    <textarea
                      value={editForm.background || ''}
                      onChange={(e) => setEditForm({ ...editForm, background: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none h-20"
                      placeholder="描述观察的时间、地点、活动背景"
                    />
                  </div>

                  {/* 行为描述 */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">行为描述</label>
                    <textarea
                      value={editForm.behavior || ''}
                      onChange={(e) => setEditForm({ ...editForm, behavior: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none h-28"
                      placeholder="客观详细描述观察到的行为"
                    />
                  </div>

                  {/* 行为分析 */}
                  <div>
                    <label className="block text-sm font-bold text-purple-700 mb-2 flex items-center gap-1">
                      <Brain className="w-4 h-4" />
                      行为分析
                    </label>
                    <textarea
                      value={editForm.analysis || ''}
                      onChange={(e) => setEditForm({ ...editForm, analysis: e.target.value })}
                      className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none h-28"
                      placeholder="基于《3-6岁指南》分析行为背后的发展意义"
                    />
                  </div>

                  {/* 发展水平评估 */}
                  <div>
                    <label className="block text-sm font-bold text-blue-700 mb-2">发展水平评估</label>
                    <textarea
                      value={editForm.developmentLevel || ''}
                      onChange={(e) => setEditForm({ ...editForm, developmentLevel: e.target.value })}
                      className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
                      placeholder="与指南对照的发展水平判断"
                    />
                  </div>

                  {/* 教育建议 */}
                  <div>
                    <label className="block text-sm font-bold text-emerald-700 mb-2 flex items-center gap-1">
                      <Lightbulb className="w-4 h-4" />
                      教育建议
                    </label>
                    <div className="space-y-2">
                      {(editForm.suggestions || []).map((suggestion, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-emerald-600 font-bold py-3">{idx + 1}.</span>
                          <input
                            type="text"
                            value={suggestion}
                            onChange={(e) => handleUpdateSuggestion(idx, e.target.value)}
                            className="flex-1 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="具体可操作的教育建议"
                          />
                          <button
                            onClick={() => handleRemoveSuggestion(idx)}
                            className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={handleAddSuggestion}
                        className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors text-sm font-bold"
                      >
                        <Plus className="w-4 h-4" />
                        添加建议
                      </button>
                    </div>
                  </div>

                  {/* 家长沟通建议 */}
                  <div>
                    <label className="block text-sm font-bold text-amber-700 mb-2 flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      家长沟通建议（可选）
                    </label>
                    <textarea
                      value={editForm.parentTips || ''}
                      onChange={(e) => setEditForm({ ...editForm, parentTips: e.target.value })}
                      className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none h-20"
                      placeholder="告诉家长可以如何在家配合"
                    />
                  </div>
                </div>

                {/* 底部按钮 */}
                <div className="p-4 border-t border-slate-200 flex gap-3 bg-slate-50">
                  <button
                    onClick={() => { setEditingObs(null); setEditForm({}); }}
                    className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    保存修改
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObservationView;

