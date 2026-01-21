
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Wand2, RefreshCcw, User, BookOpen, FileText, ClipboardList, AlertCircle, Leaf, TreeDeciduous } from 'lucide-react';
import { chatWithAssistant, generateDailyReport } from '../services/geminiService';
import { initializeKnowledgeBase } from '../services/knowledgeBaseService';

const AIAssistantView: React.FC = () => {
  // 初始化知识库
  useEffect(() => {
    initializeKnowledgeBase();
  }, []);

  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', text: '你好！我是金星AI助手 🌿\n\n我会**优先查阅学校内部资料**（退费准则、备课模板、工作规范等）来回答您的问题。\n\n您可以问我：\n• 退费怎么计算？\n• 帮我写今天的工作总结\n• 明天的备课计划怎么写？\n• 新生入园流程是什么？\n\n今天有什么可以帮你的吗？' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState({ name: '', points: '' });
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const result = await chatWithAssistant(userMsg);
      setMessages(prev => [...prev, { role: 'ai', text: result }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: '抱歉，系统遇到了一点问题，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!reportData.name || !reportData.points || isGeneratingReport) return;
    
    setIsGeneratingReport(true);
    try {
      const result = await generateDailyReport(reportData.name, reportData.points);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: `这是为您生成的 ${reportData.name} 今日表现报告：\n\n${result}`,
        isReport: true
      }]);
      setReportData({ name: '', points: '' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const [showTools, setShowTools] = useState(false);

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      {/* 顶部标题栏 - 自然有机风格 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full shadow-lg" style={{ backgroundColor: '#4a5d3a' }}>
            <Leaf className="w-6 h-6 text-[#c9dbb8]" />
          </div>
        <div>
            <h1 className="text-xl font-bold" style={{ color: '#4a5d3a', fontFamily: "'Noto Serif SC', serif" }}>金星AI助手</h1>
            <p className="text-xs" style={{ color: '#8b7355' }}>优先查阅学校内部资料，帮您解答政策、生成模板</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border-2 border-dashed" style={{ backgroundColor: '#4a5d3a10', borderColor: '#4a5d3a30', color: '#4a5d3a' }}>
            <TreeDeciduous className="w-3 h-3" />
            <span>知识库已加载</span>
          </div>
          <button 
            onClick={() => setShowTools(!showTools)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 border-2 ${
              showTools 
                ? 'text-white border-transparent' 
                : 'border-[#4a5d3a]/20 hover:border-[#4a5d3a]/40'
            }`}
            style={{ 
              backgroundColor: showTools ? '#4a5d3a' : '#f5f2ed',
              color: showTools ? 'white' : '#4a5d3a'
            }}
          >
            <Wand2 className="w-4 h-4" />
            {showTools ? '收起工具' : '快捷工具'}
          </button>
        </div>
      </div>

      {/* 快捷工具面板 - 自然风格 */}
      {showTools && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 animate-in slide-in-from-top duration-300">
          {/* 快速报告生成器 */}
          <div className="rounded-2xl p-4 text-white shadow-lg" style={{ backgroundColor: '#4a5d3a' }}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-[#c9dbb8]">
              <Wand2 className="w-4 h-4" />
              快速报告生成器
            </h3>
            <div className="space-y-2">
                <input 
                  type="text" 
                  value={reportData.name}
                  onChange={(e) => setReportData({...reportData, name: e.target.value})}
                placeholder="幼儿姓名"
                className="w-full bg-white/15 rounded-lg px-3 py-2 text-sm placeholder:text-white/50 outline-none border border-white/10 focus:border-white/30"
                />
                <textarea 
                rows={2}
                  value={reportData.points}
                  onChange={(e) => setReportData({...reportData, points: e.target.value})}
                placeholder="当日观察点..."
                className="w-full bg-white/15 rounded-lg px-3 py-2 text-sm placeholder:text-white/50 outline-none resize-none border border-white/10 focus:border-white/30"
                />
              <button 
                onClick={handleGenerateReport}
                disabled={isGeneratingReport || !reportData.name || !reportData.points}
                className="w-full font-semibold py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                style={{ backgroundColor: '#c9a962', color: '#3d4a32' }}
              >
                {isGeneratingReport ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "生成报告"}
              </button>
            </div>
          </div>

          {/* 常用问题 */}
          <div className="rounded-2xl p-4 border-2" style={{ backgroundColor: '#f5f2ed', borderColor: '#e8e4dc' }}>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: '#4a5d3a' }}>
              <BookOpen className="w-4 h-4" />
              常用问题
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { icon: '🌱', text: '退费怎么计算？' },
                { icon: '📝', text: '帮我写工作总结' },
                { icon: '🌿', text: '新生入园流程' },
              ].map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => { setInput(item.text); setShowTools(false); }}
                  className="text-left text-xs p-2 rounded-lg transition-all flex items-center gap-2"
                  style={{ backgroundColor: 'white', color: '#5c6b4d' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4a5d3a'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#5c6b4d'; }}
                >
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 模板生成 */}
          <div className="rounded-2xl p-4 border-2" style={{ backgroundColor: '#faf6f0', borderColor: '#e8dfd4' }}>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: '#8b6f47' }}>
              <FileText className="w-4 h-4" />
              模板生成
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { icon: '📚', text: '备课计划' },
                { icon: '📮', text: '家长通知' },
                { icon: '🎊', text: '活动方案' },
              ].map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => { setInput(`帮我生成${item.text}`); setShowTools(false); }}
                  className="text-left text-xs p-2 rounded-lg transition-all flex items-center gap-2"
                  style={{ backgroundColor: 'white', color: '#8b6f47' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#c9a962'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#8b6f47'; }}
                >
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 主聊天区域 - 自然有机风格 */}
      <div className="flex-1 rounded-3xl shadow-xl flex flex-col overflow-hidden min-h-0 border-2" style={{ backgroundColor: '#fffcf8', borderColor: '#e8e4dc' }}>
        {/* 聊天头部 - 波浪装饰 */}
        <div className="p-4 flex items-center justify-between shrink-0 relative" style={{ backgroundColor: '#4a5d3a' }}>
            <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: '#c9dbb8' }}>
              <Leaf className="w-6 h-6" style={{ color: '#4a5d3a' }} />
              </div>
              <div>
              <h4 className="font-bold text-white">金星AI助手</h4>
              <p className="text-[10px] font-medium" style={{ color: '#a8c896' }}>● 在线 · 金星教育智库支持</p>
            </div>
          </div>
          <button 
            className="p-2 rounded-full transition-all" 
            style={{ color: '#c9dbb8' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={() => setMessages([{ role: 'ai', text: '对话已重置 🌿\n\n有什么我可以帮你的？\n\n您可以：\n• 询问学校政策和规定\n• 生成工作文档和模板\n• 获取幼儿教育相关建议' }])}
            title="重置对话"
          >
            <RefreshCcw className="w-5 h-5" />
            </button>
          {/* 波浪装饰 */}
          <svg className="absolute bottom-0 left-0 right-0 w-full h-4 translate-y-full" viewBox="0 0 100 10" preserveAspectRatio="none">
            <path d="M0,0 Q25,10 50,5 T100,8 L100,0 Z" fill="#4a5d3a" />
          </svg>
          </div>

        {/* 聊天消息区域 */}
        <div className="flex-1 overflow-y-auto p-6 pt-8 space-y-6" style={{ 
          background: 'linear-gradient(180deg, #fffcf8 0%, #f8f5f0 100%)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%234a5d3a' fill-opacity='0.02'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10zm10 0c0 5.5 4.5 10 10 10s10-4.5 10-10-4.5-10-10-10-10 4.5-10 10z'/%3E%3C/g%3E%3C/svg%3E")`
        }}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-md ${
                msg.role === 'user' ? '' : ''
              }`} style={{ 
                backgroundColor: msg.role === 'user' ? '#8b6f47' : '#c9dbb8',
                color: msg.role === 'user' ? 'white' : '#4a5d3a'
              }}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Leaf className="w-5 h-5" />}
                </div>
              <div className={`max-w-[75%] p-4 rounded-2xl whitespace-pre-wrap shadow-md ${
                msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'
              }`} style={{ 
                backgroundColor: msg.role === 'user' ? '#4a5d3a' : 'white',
                color: msg.role === 'user' ? 'white' : '#3d4a32',
                borderLeft: msg.isReport ? '4px solid #c9a962' : undefined,
                background: msg.isReport ? 'linear-gradient(to right, #faf6f0, white)' : undefined
              }}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: '#c9dbb8', color: '#4a5d3a' }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              <div className="p-4 rounded-2xl rounded-tl-sm shadow-md" style={{ backgroundColor: 'white' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#4a5d3a' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#6b7c5c', animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#8b9d7c', animationDelay: '0.2s' }}></div>
                  <span className="text-sm ml-2" style={{ color: '#8b7355' }}>正在思考...</span>
                </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

        {/* 输入区域 */}
        <div className="p-4 shrink-0 border-t" style={{ backgroundColor: '#f5f2ed', borderColor: '#e8e4dc' }}>
          <div className="relative flex items-center gap-3">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="在此输入您的问题，按 Enter 发送..."
              className="flex-1 rounded-full px-6 py-4 pr-16 text-base outline-none transition-all border-2"
              style={{ 
                backgroundColor: 'white', 
                borderColor: '#e8e4dc',
                color: '#3d4a32'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#4a5d3a'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e8e4dc'}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              className="absolute right-2 p-3 text-white rounded-full disabled:opacity-50 transition-all shadow-lg active:scale-95"
              style={{ backgroundColor: '#4a5d3a' }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          <p className="text-[10px] mt-3 text-center" style={{ color: '#8b7355' }}>
            AI 内容仅供参考，<span className="font-medium" style={{ color: '#8b6f47' }}>发送给家长前请仔细审核</span>。
            </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantView;
