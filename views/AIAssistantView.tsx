
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Wand2, RefreshCcw, User, BookOpen, FileText, ClipboardList, AlertCircle } from 'lucide-react';
import { chatWithAssistant, generateDailyReport } from '../services/geminiService';
import { initializeKnowledgeBase } from '../services/knowledgeBaseService';

const AIAssistantView: React.FC = () => {
  // 初始化知识库
  useEffect(() => {
    initializeKnowledgeBase();
  }, []);

  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', text: '你好！我是金星AI助手 🌟\n\n我会**优先查阅学校内部资料**（退费准则、备课模板、工作规范等）来回答您的问题。\n\n您可以问我：\n• 退费怎么计算？\n• 帮我写今天的工作总结\n• 明天的备课计划怎么写？\n• 新生入园流程是什么？\n\n今天有什么可以帮你的吗？' }
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

  return (
    <div className="h-full flex flex-col space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-orange-500" />
            金星AI助手
          </h1>
          <p className="text-slate-500">优先查阅学校内部资料，帮您解答政策、生成模板、辅助备课。</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full">
          <BookOpen className="w-4 h-4" />
          <span>内部知识库已加载</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
        {/* 快捷工具 */}
        <div className="space-y-6 overflow-y-auto pr-2">
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-6 text-white shadow-lg shadow-orange-100">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              快速报告生成器
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider opacity-80 block mb-1">幼儿姓名</label>
                <input 
                  type="text" 
                  value={reportData.name}
                  onChange={(e) => setReportData({...reportData, name: e.target.value})}
                  placeholder="例如：李子轩"
                  className="w-full bg-white/20 border-white/30 rounded-xl px-4 py-2 text-sm placeholder:text-white/60 focus:bg-white/30 transition-all outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider opacity-80 block mb-1">当日观察点</label>
                <textarea 
                  rows={4}
                  value={reportData.points}
                  onChange={(e) => setReportData({...reportData, points: e.target.value})}
                  placeholder="例如：乐于分享玩具，午餐全部吃完，认识了蝴蝶..."
                  className="w-full bg-white/20 border-white/30 rounded-xl px-4 py-2 text-sm placeholder:text-white/60 focus:bg-white/30 transition-all outline-none resize-none"
                />
              </div>
              <button 
                onClick={handleGenerateReport}
                disabled={isGeneratingReport || !reportData.name || !reportData.points}
                className="w-full bg-white text-orange-600 font-bold py-3 rounded-xl hover:bg-orange-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {isGeneratingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : "生成家长汇报"}
              </button>
            </div>
          </div>

          {/* 内部资料查询 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              查阅内部资料
            </h3>
            <p className="text-xs text-blue-600 mb-4">AI会优先从学校知识库查找答案</p>
            <div className="space-y-2">
              {[
                { icon: '💰', text: '退费怎么计算？有什么标准？', category: '财务' },
                { icon: '📋', text: '帮我写今天的工作总结', category: '模板' },
                { icon: '👶', text: '新生入园流程是什么？', category: '政策' },
                { icon: '🏥', text: '幼儿发烧怎么处理？', category: '健康' },
                { icon: '📝', text: '请假需要什么手续？', category: '人事' },
              ].map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => setInput(item.text)}
                  className="w-full text-left text-sm p-3 rounded-xl bg-white text-slate-700 hover:bg-blue-100 hover:text-blue-700 transition-all border border-blue-100 font-medium flex items-center gap-2"
                >
                  <span>{item.icon}</span>
                  <span className="flex-1">{item.text}</span>
                  <span className="text-[10px] text-blue-400 bg-blue-50 px-2 py-0.5 rounded">{item.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 工作模板 */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              使用模板生成
            </h3>
            <div className="space-y-2">
              {[
                { icon: '📚', text: '帮我生成明天的备课计划，主题是认识颜色' },
                { icon: '📢', text: '写一份元旦放假通知给家长' },
                { icon: '🎉', text: '策划一个六一儿童节活动方案' },
                { icon: '📊', text: '写一份幼儿发展评估报告，基本情况是...' },
              ].map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => setInput(item.text)}
                  className="w-full text-left text-sm p-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-all border border-transparent hover:border-amber-100 font-medium flex items-center gap-2"
                >
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 聊天界面 */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden h-[500px] md:h-[600px]">
          <div className="p-4 border-b border-slate-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">金星AI助手</h4>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">金星教育智库支持</p>
              </div>
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600" onClick={() => setMessages([{ role: 'ai', text: '对话已重置。有什么我可以帮你的？' }])}>
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-orange-100 text-orange-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div className={`max-w-[80%] p-4 rounded-2xl whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-orange-600 text-white rounded-tr-none' 
                    : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'
                } ${msg.isReport ? 'border-l-4 border-l-orange-500 bg-orange-50/30 shadow-sm' : ''}`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 animate-pulse">
                  <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-slate-50/50 border-t border-slate-100 shrink-0">
            <div className="relative flex items-center gap-2">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="在此输入您的问题..."
                className="flex-1 bg-white border border-slate-200 rounded-2xl px-6 py-4 pr-14 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-all shadow-md shadow-orange-100 active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 text-center font-medium">
              AI 内容仅供参考，发送给家长前请仔细审核。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantView;
