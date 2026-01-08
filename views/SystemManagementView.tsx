
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Users, 
  PhoneCall, 
  Search,
  XCircle,
  AlertTriangle,
  Lock,
  History,
  Database,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { User, UserRole } from '../types';
import OperationLogsViewer from '../components/OperationLogsViewer';
import { checkAliyunHealth, isAliyunConfigured, initializeFromAliyun, getSyncStatus } from '../services/aliyunOssService';

interface SystemManagementViewProps {
  currentUser: User;
}

const SystemManagementView: React.FC<SystemManagementViewProps> = ({ currentUser }) => {
  const [authorizedPhones, setAuthorizedPhones] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'phones' | 'users' | 'logs' | 'cloud'>('phones');
  
  // 云同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, key: '' });
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cloudHealth, setCloudHealth] = useState<{ isHealthy: boolean; latency?: number } | null>(null);

  useEffect(() => {
    const phones = JSON.parse(localStorage.getItem('kt_authorized_phones') || '[]');
    const users = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
    setAuthorizedPhones(phones);
    setAllUsers(users);
    
    // 检查阿里云健康状态
    if (isAliyunConfigured) {
      checkAliyunHealth().then(setCloudHealth);
    }
  }, []);

  // 执行云同步
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      await initializeFromAliyun();
      setSyncResult({ success: true, message: '同步完成！数据已安全保存到阿里云。' });
    } catch (error) {
      setSyncResult({ success: false, message: '同步出错，请检查网络连接。' });
    } finally {
      setIsSyncing(false);
      // 刷新云端状态
      checkAliyunHealth().then(setCloudHealth);
    }
  };

  const handleAddPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || authorizedPhones.includes(newPhone)) return;
    const updated = [...authorizedPhones, newPhone];
    setAuthorizedPhones(updated);
    localStorage.setItem('kt_authorized_phones', JSON.stringify(updated));
    setNewPhone('');
  };

  const handleDeletePhone = (phone: string) => {
    const updated = authorizedPhones.filter(p => p !== phone);
    setAuthorizedPhones(updated);
    localStorage.setItem('kt_authorized_phones', JSON.stringify(updated));
  };

  const handleDeleteUser = (userId: string) => {
    const updated = allUsers.filter(u => u.id !== userId);
    setAllUsers(updated);
    localStorage.setItem('kt_all_users', JSON.stringify(updated));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-4 font-brand">
            <div className="p-2 bg-amber-600 rounded-2xl shadow-lg shadow-amber-200">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            系统总管中心
          </h1>
          <p className="text-slate-500 mt-2 italic flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-500" />
            生产环境安全加密连接已激活
          </p>
        </div>
        <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          {[
            { id: 'phones', label: '预授权', icon: PhoneCall },
            { id: 'users', label: '用户库', icon: Users },
            { id: 'logs', label: '操作日志', icon: History },
            { id: 'cloud', label: '云同步', icon: Cloud },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-amber-600 text-white shadow-lg shadow-amber-100 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {activeTab === 'phones' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">授权名单</h3>
                  <p className="text-slate-400 text-xs mt-1">仅限名单内的号码注册入园</p>
                </div>
                <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">{authorizedPhones.length} 个席位</span>
              </div>
              
              <div className="p-10">
                <form onSubmit={handleAddPhone} className="flex gap-4 mb-10">
                  <div className="relative flex-1">
                    <PhoneCall className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input 
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="录入手机号授权..."
                      className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 outline-none transition-all font-bold text-lg"
                    />
                  </div>
                  <select 
                    className="px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold text-slate-700 focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 outline-none transition-all"
                  >
                    <option value="总园">总园（集团总部）</option>
                    <option value="南江">南江园</option>
                    <option value="高新">高新园</option>
                    <option value="新市花园">新市花园园</option>
                    <option value="创越">创越园</option>
                    <option value="七幼">金星第七幼儿园</option>
                    <option value="八幼">金星第八幼儿园</option>
                    <option value="九幼">金星第九幼儿园</option>
                    <option value="十幼">金星第十幼儿园</option>
                    <option value="十二幼">金星第十二幼儿园</option>
                    <option value="十七幼">金星第十七幼儿园</option>
                  </select>
                  <button type="submit" className="bg-amber-600 text-white px-10 rounded-3xl font-black text-sm hover:bg-amber-700 shadow-xl shadow-amber-200 transition-all active:scale-95 flex items-center gap-3">
                    <UserPlus className="w-5 h-5" />
                    执行授权
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {authorizedPhones.map((p) => {
                    const isRegistered = allUsers.some(u => u.phone === p);
                    return (
                      <div key={p} className="flex items-center justify-between p-6 bg-white rounded-3xl border-2 border-slate-50 group hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/5 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${isRegistered ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <PhoneCall className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-black text-slate-800 tracking-wider text-base">{p}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest mt-1">
                              {isRegistered ? <span className="text-emerald-500">已激活注册</span> : <span className="text-slate-400">等待准入</span>}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => handleDeletePhone(p)} className="p-3 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-10 border-b border-slate-100 bg-slate-50/30">
                <h3 className="text-xl font-bold text-slate-800">活跃成员库</h3>
                <p className="text-slate-400 text-xs mt-1">管理当前已在系统内激活的教职工与家长</p>
              </div>
              <div className="p-10 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50">
                      <th className="pb-6">身份信息</th>
                      <th className="pb-6">联系方式</th>
                      <th className="pb-6">权限等级</th>
                      <th className="pb-6 text-right">管控</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="py-6">
                          <div className="flex items-center gap-4">
                            <img src={u.avatar} className="w-12 h-12 rounded-2xl object-cover shadow-sm ring-2 ring-white" />
                            <span className="font-black text-slate-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-6 font-bold text-slate-500">{u.phone}</td>
                        <td className="py-6">
                          <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                            u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 
                            u.role === 'TEACHER' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-6 text-right">
                          <button onClick={() => handleDeleteUser(u.id)} className="p-3 text-slate-200 hover:text-rose-600 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <OperationLogsViewer />
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-8">
              {/* 云端状态卡片 */}
              <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-[2.5rem] p-10 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white/10 rounded-2xl">
                      <Cloud className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">阿里云 OSS 云端存储</h3>
                      <p className="text-white/70 text-sm">国内高速访问，实时自动同步</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAliyunConfigured ? (
                      <>
                        <div className={`w-3 h-3 rounded-full ${cloudHealth?.isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-300'}`} />
                        <span className="text-sm font-bold text-white/80">
                          {cloudHealth?.isHealthy ? `已连接 (${cloudHealth.latency}ms)` : '检测中...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full bg-rose-300" />
                        <span className="text-sm font-bold text-rose-200">未配置</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 实时同步状态 */}
                {isAliyunConfigured && cloudHealth?.isHealthy && (
                  <div className="p-6 bg-white/20 rounded-2xl flex items-center gap-4 mb-6">
                    <div className="relative">
                      <RefreshCw className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    </div>
                    <div>
                      <p className="font-black text-white">实时同步已启用</p>
                      <p className="text-white/70 text-sm">数据变更将在0.5秒内自动同步到阿里云</p>
                    </div>
                  </div>
                )}

                {/* 同步特性说明 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 bg-white/10 rounded-2xl">
                    <CloudUpload className="w-8 h-8 text-white mb-3" />
                    <p className="font-black text-white mb-1">自动上传</p>
                    <p className="text-white/60 text-xs">本地数据变更时自动同步到阿里云</p>
                  </div>
                  <div className="p-6 bg-white/10 rounded-2xl">
                    <CloudDownload className="w-8 h-8 text-white mb-3" />
                    <p className="font-black text-white mb-1">启动同步</p>
                    <p className="text-white/60 text-xs">应用启动时自动拉取云端最新数据</p>
                  </div>
                  <div className="p-6 bg-white/10 rounded-2xl">
                    <RefreshCw className="w-8 h-8 text-white mb-3" />
                    <p className="font-black text-white mb-1">国内高速</p>
                    <p className="text-white/60 text-xs">华北2（北京）节点，无需VPN</p>
                  </div>
                </div>

                {/* 手动同步按钮（备用） */}
                <div className="mt-6 pt-6 border-t border-white/20">
                  <button
                    onClick={() => handleSync()}
                    disabled={isSyncing || !isAliyunConfigured}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-5 h-5 text-white/70 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="text-white/70 text-sm font-bold">
                      {isSyncing ? '同步中...' : '手动强制同步（一般无需使用）'}
                    </span>
                  </button>
                </div>

                {syncResult && (
                  <div className={`mt-4 p-4 rounded-2xl ${syncResult.success ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`}>
                    <p className="text-white text-sm font-bold">{syncResult.message}</p>
                  </div>
                )}
              </div>

              {/* 数据统计 */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200">
                <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
                  <Database className="w-5 h-5 text-amber-600" />
                  本地数据统计
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: '幼儿档案', key: 'kt_students', color: 'amber' },
                    { label: '教职工', key: 'kt_staff', color: 'blue' },
                    { label: '操作日志', key: 'kt_operation_logs', color: 'emerald' },
                    { label: '日历事件', key: 'kt_calendar_events', color: 'purple' },
                  ].map(item => {
                    const data = JSON.parse(localStorage.getItem(item.key) || '[]');
                    return (
                      <div key={item.key} className="text-center p-6 bg-slate-50 rounded-2xl">
                        <p className={`text-3xl font-black text-${item.color}-600`}>{data.length}</p>
                        <p className="text-slate-500 text-sm font-bold mt-1">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SystemManagementView;
