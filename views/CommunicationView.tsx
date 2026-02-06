
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Send, Paperclip, Image as ImageIcon, CheckCheck, User as UserIcon,
  Megaphone, Users, Bell, Pin, Trash2, Eye, Clock, Filter,
  ChevronRight, AlertTriangle, CheckCircle2, QrCode, X, Smartphone, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Announcement, Student, User } from '../types';
import { hasPermission } from '../services/permissionService';
import { saveAndSync } from '../services/storageService';

interface CommunicationViewProps {
  currentUser: User;
}

interface Message {
  id: string;
  sender: 'me' | 'parent';
  text: string;
  time: string;
  read?: boolean;
}

interface Contact {
  id: string;
  name: string;
  student: string;
  studentId: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
}

type ViewMode = 'CHAT' | 'ANNOUNCEMENTS' | 'CLASS_NOTIFY';

const CommunicationView: React.FC<CommunicationViewProps> = ({ currentUser }) => {
  // 权限检查
  const canCreateAnnouncement = hasPermission(currentUser.role, 'communication.create');
  const [viewMode, setViewMode] = useState<ViewMode>('ANNOUNCEMENTS');
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [histories, setHistories] = useState<Record<string, Message[]>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrType, setQrType] = useState<'class' | 'announcement' | 'parent'>('class');
  const [selectedAnnouncementForQR, setSelectedAnnouncementForQR] = useState<Announcement | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 加载学生数据生成联系人列表
    const savedStudents = localStorage.getItem('kt_students');
    if (savedStudents) {
      const studentList: Student[] = JSON.parse(savedStudents);
      setStudents(studentList);
      
      // 生成联系人列表
      const contactList: Contact[] = studentList.map(s => ({
        id: s.id,
        name: s.parent_name || '家长',
        student: s.name,
        studentId: s.id,
        lastMessage: '点击开始对话',
        time: '',
        unread: 0,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.parent_name || s.name}`
      }));
      setContacts(contactList);
    }
    
    // 加载公告
    const savedAnnouncements = localStorage.getItem('kt_announcements');
    if (savedAnnouncements) {
      setAnnouncements(JSON.parse(savedAnnouncements));
    }
    
    // 加载聊天记录
    const savedHistories = localStorage.getItem('kt_chat_histories');
    if (savedHistories) {
      setHistories(JSON.parse(savedHistories));
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [histories, activeContactId]);

  const activeContact = contacts.find(c => c.id === activeContactId);
  const currentHistory = activeContactId ? (histories[activeContactId] || []) : [];

  const handleSend = () => {
    if (!input.trim() || !activeContactId) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'me',
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true
    };

    const updatedHistories = {
      ...histories,
      [activeContactId]: [...(histories[activeContactId] || []), newMessage]
    };
    setHistories(updatedHistories);
    saveAndSync('kt_chat_histories', updatedHistories);

    setContacts(prev => prev.map(c => 
      c.id === activeContactId 
        ? { ...c, lastMessage: input, time: '刚刚', unread: 0 } 
        : c
    ));

    setInput('');
  };

  const saveAnnouncement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      title: fd.get('title') as string,
      content: fd.get('content') as string,
      type: fd.get('type') as any,
      targetClass: fd.get('targetClass') as string || undefined,
      createdBy: '管理员',
      createdAt: new Date().toISOString(),
      isPinned: fd.get('isPinned') === 'on',
      readBy: []
    };
    
    const updated = [newAnnouncement, ...announcements];
    setAnnouncements(updated);
    saveAndSync('kt_announcements', updated);
    setIsAnnouncementModalOpen(false);
  };

  const deleteAnnouncement = (id: string) => {
    if (!confirm('确定要删除该公告吗？')) return;
    const updated = announcements.filter(a => a.id !== id);
    setAnnouncements(updated);
    saveAndSync('kt_announcements', updated);
  };

  const togglePin = (id: string) => {
    const updated = announcements.map(a => 
      a.id === id ? { ...a, isPinned: !a.isPinned } : a
    );
    setAnnouncements(updated);
    saveAndSync('kt_announcements', updated);
  };

  // 按班级分组的联系人
  const groupedContacts = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    contacts.forEach(c => {
      const student = students.find(s => s.id === c.studentId);
      const className = student?.class || '未分班';
      if (!groups[className]) groups[className] = [];
      groups[className].push(c);
    });
    return groups;
  }, [contacts, students]);

  const classes = Object.keys(groupedContacts);

  // 筛选公告
  const filteredAnnouncements = useMemo(() => {
    let result = [...announcements];
    if (selectedClass !== 'all') {
      result = result.filter(a => a.type === 'all' || a.targetClass === selectedClass);
    }
    // 置顶的排前面
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [announcements, selectedClass]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 font-brand">家园共育中心</h1>
          <p className="text-slate-500 text-sm mt-1">与家长实时沟通，发布园所公告通知</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAnnouncementModalOpen(true)}
            className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-700 shadow-lg flex items-center gap-2"
          >
            <Megaphone className="w-4 h-4" />
            发布公告
          </button>
        </div>
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-2">
        <button onClick={() => setViewMode('ANNOUNCEMENTS')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'ANNOUNCEMENTS' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
          <Megaphone className="w-4 h-4 inline mr-1" />园所公告
        </button>
        <button onClick={() => setViewMode('CLASS_NOTIFY')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'CLASS_NOTIFY' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
          <Users className="w-4 h-4 inline mr-1" />班级通知
        </button>
        <button onClick={() => setViewMode('CHAT')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'CHAT' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
          <Send className="w-4 h-4 inline mr-1" />私信家长
        </button>
      </div>

      {/* 公告视图 */}
      {viewMode === 'ANNOUNCEMENTS' && (
        <div className="flex-1 space-y-4">
          {/* 筛选 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold"
              >
                <option value="all">全部公告</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button 
              onClick={() => { setQrType('class'); setShowQRModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all"
            >
              <QrCode className="w-4 h-4" />
              家长扫码入口
            </button>
          </div>
          
          {/* 公告列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAnnouncements.length > 0 ? filteredAnnouncements.map(announcement => (
              <div key={announcement.id} className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all ${announcement.isPinned ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {announcement.isPinned && (
                      <Pin className="w-4 h-4 text-orange-500 fill-current" />
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      announcement.type === 'all' ? 'bg-orange-100 text-orange-700' :
                      announcement.type === 'class' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {announcement.type === 'all' ? '全园' : announcement.type === 'class' ? announcement.targetClass : '个人'}
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-60 hover:opacity-100">
                    <button 
                      onClick={() => { setSelectedAnnouncementForQR(announcement); setQrType('announcement'); setShowQRModal(true); }} 
                      className="p-1 hover:text-blue-500"
                      title="生成二维码"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button onClick={() => togglePin(announcement.id)} className="p-1 hover:text-orange-500">
                      <Pin className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteAnnouncement(announcement.id)} className="p-1 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <h3 className="font-bold text-slate-800 text-lg mb-2">{announcement.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">{announcement.content}</p>
                
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {new Date(announcement.createdAt).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {announcement.readBy?.length || 0} 已读
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-2 py-16 text-center bg-slate-50 rounded-2xl">
                <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">暂无公告</p>
                <button onClick={() => setIsAnnouncementModalOpen(true)} className="text-orange-600 font-bold mt-2 hover:underline">
                  发布第一条公告
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 班级通知视图 */}
      {viewMode === 'CLASS_NOTIFY' && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(className => {
            const classContacts = groupedContacts[className] || [];
            const classStudents = students.filter(s => s.class === className);
            return (
              <div key={className} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      {className}
                    </h3>
                    <span className="text-xs bg-white px-2 py-1 rounded-full font-bold text-purple-600">
                      {classStudents.length}人
                    </span>
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <button 
                    onClick={() => {
                      setIsAnnouncementModalOpen(true);
                      // 可以预设目标班级
                    }}
                    className="w-full py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Bell className="w-4 h-4" />
                    发送班级通知
                  </button>
                  
                  <div className="text-xs text-slate-400 space-y-1">
                    {classStudents.slice(0, 5).map(s => (
                      <div key={s.id} className="flex items-center justify-between py-1">
                        <span>{s.name}</span>
                        <span className="text-slate-300">{s.parent_name}</span>
                      </div>
                    ))}
                    {classStudents.length > 5 && (
                      <p className="text-center text-slate-300">还有 {classStudents.length - 5} 位...</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {classes.length === 0 && (
            <div className="col-span-3 py-16 text-center bg-slate-50 rounded-2xl">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">暂无班级数据</p>
              <p className="text-xs text-slate-300 mt-1">请先在幼儿档案中录入学生</p>
            </div>
          )}
        </div>
      )}

      {/* 私信聊天视图 */}
      {viewMode === 'CHAT' && (
        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 min-h-[500px]">
          {/* 联系人列表 - 按班级分组 */}
          <div className="w-full md:w-1/3 flex flex-col h-1/2 md:h-auto overflow-hidden">
            <div className="p-4 border-b border-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="搜索家长..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {classes.length > 0 ? classes.map((className) => {
                const classContacts = groupedContacts[className] || [];
                const classStudents = students.filter(s => s.class === className);
                const hasUnread = classContacts.some(c => c.unread > 0);
                const isExpanded = expandedClasses.has(className) || classContacts.some(c => c.id === activeContactId);
                
                const toggleExpand = () => {
                  const newSet = new Set(expandedClasses);
                  if (newSet.has(className)) {
                    newSet.delete(className);
                  } else {
                    newSet.add(className);
                  }
                  setExpandedClasses(newSet);
                };
                
                return (
                  <div key={className} className="border-b border-slate-50 last:border-b-0">
                    {/* 班级标题 */}
                    <div 
                      onClick={toggleExpand}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{className}</h4>
                          <p className="text-[10px] text-slate-400">{classStudents.length}位家长</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasUnread && (
                          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        )}
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    
                    {/* 班级内的家长列表 */}
                    {isExpanded && (
                      <div className="bg-slate-50/50">
                        {classContacts.map((contact) => (
                          <div 
                            key={contact.id} 
                            onClick={() => setActiveContactId(contact.id)}
                            className={`p-3 pl-6 flex gap-3 hover:bg-white cursor-pointer transition-colors border-l-4 ${activeContactId === contact.id ? 'border-orange-500 bg-orange-50/50' : 'border-transparent'}`}
                          >
                            <img src={contact.avatar} className="w-10 h-10 rounded-xl object-cover bg-slate-100" alt={contact.name} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <h4 className="font-bold text-slate-700 text-sm truncate">{contact.name}</h4>
                                {contact.unread > 0 && (
                                  <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{contact.unread}</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{contact.student}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{contact.lastMessage}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="p-8 text-center text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无联系人</p>
                </div>
              )}
            </div>
          </div>

          {/* 聊天区域 */}
          <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden h-1/2 md:h-auto">
            {activeContact ? (
              <>
                <div className="p-4 bg-white border-b border-slate-50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <img src={activeContact.avatar} className="w-10 h-10 rounded-2xl object-cover shadow-sm bg-slate-100" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{activeContact.name}</h4>
                      <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">{activeContact.student} 的家长</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
                  {currentHistory.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 ${msg.sender === 'me' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        msg.sender === 'me' ? 'bg-orange-600 text-white' : 'bg-white border border-slate-100 text-slate-400 shadow-sm'
                      }`}>
                        {msg.sender === 'me' ? '我' : <UserIcon className="w-4 h-4" />}
                      </div>
                      <div className={`p-4 rounded-2xl shadow-sm max-w-[85%] md:max-w-[75%] ${
                        msg.sender === 'me' 
                          ? 'bg-orange-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <div className={`flex items-center gap-1 mt-1 justify-end ${msg.sender === 'me' ? 'text-white/70' : 'text-slate-400'}`}>
                          <span className="text-[10px]">{msg.time}</span>
                          {msg.sender === 'me' && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {currentHistory.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                      <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">开始与家长对话</p>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>

                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                  <div className="bg-slate-50 rounded-2xl p-2 flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-orange-600 transition-colors"><ImageIcon className="w-5 h-5" /></button>
                    <button className="p-2 text-slate-400 hover:text-orange-600 transition-colors"><Paperclip className="w-5 h-5" /></button>
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="输入消息..." 
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-2 text-slate-800"
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="bg-orange-600 text-white p-2.5 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-all shadow-md shadow-orange-100"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">选择联系人开始对话</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 发布公告弹窗 */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveAnnouncement} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-orange-500" />
              发布公告
            </h2>
            
            <div className="space-y-4">
              <input required name="title" placeholder="公告标题 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold" />
              
              <textarea required name="content" placeholder="公告内容 *" rows={5} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold resize-none" />
              
              <div className="grid grid-cols-2 gap-4">
                <select required name="type" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold">
                  <option value="all">全园公告</option>
                  <option value="class">班级通知</option>
                </select>
                
                <select name="targetClass" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold">
                  <option value="">选择班级（班级通知）</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="isPinned" className="w-4 h-4 rounded text-orange-600" />
                <span className="text-sm font-bold text-slate-600">置顶公告</span>
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold shadow-lg">发布公告</button>
            </div>
          </form>
        </div>
      )}

      {/* 二维码弹窗 */}
      {showQRModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-blue-600" />
                {qrType === 'class' ? '家长扫码入口' : qrType === 'announcement' ? '公告二维码' : '家长端入口'}
              </h2>
              <button onClick={() => { setShowQRModal(false); setSelectedAnnouncementForQR(null); }} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              {qrType === 'class' && (
                <>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl inline-block">
                    <QRCodeSVG 
                      value={`${window.location.origin}/parent-portal?source=qr`}
                      size={200}
                      level="H"
                      includeMargin
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-600 font-bold">📱 金星幼儿园家长端</p>
                    <p className="text-sm text-slate-400">
                      家长扫码后可查看：
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">📢 园所公告</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">👶 孩子动态</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">🍽️ 每日食谱</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">📊 成长档案</span>
                    </div>
                  </div>
                </>
              )}
              
              {qrType === 'announcement' && selectedAnnouncementForQR && (
                <>
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-8 rounded-2xl inline-block">
                    <QRCodeSVG 
                      value={`${window.location.origin}/announcement/${selectedAnnouncementForQR.id}?title=${encodeURIComponent(selectedAnnouncementForQR.title)}`}
                      size={200}
                      level="H"
                      includeMargin
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-600 font-bold">📢 {selectedAnnouncementForQR.title}</p>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {selectedAnnouncementForQR.content}
                    </p>
                    <p className="text-xs text-slate-300">
                      扫码查看公告详情
                    </p>
                  </div>
                </>
              )}
              
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-3">将二维码发送给家长或打印张贴</p>
                <button 
                  onClick={() => {
                    // 下载二维码图片
                    const svg = document.querySelector('#qr-code-svg');
                    if (svg) {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      const img = new Image();
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                      const url = URL.createObjectURL(svgBlob);
                      img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx?.drawImage(img, 0, 0);
                        const pngUrl = canvas.toDataURL('image/png');
                        const a = document.createElement('a');
                        a.href = pngUrl;
                        a.download = '金星幼儿园二维码.png';
                        a.click();
                        URL.revokeObjectURL(url);
                      };
                      img.src = url;
                    }
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> 下载二维码
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunicationView;
