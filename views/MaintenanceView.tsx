/**
 * 维修与资产报修分析视图
 * 记录报修频次与金额，反向评估班级维护情况及采购质量
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench, Package, AlertTriangle, TrendingUp, TrendingDown,
  Plus, Search, Filter, ChevronRight, ChevronDown, Clock,
  CheckCircle2, XCircle, DollarSign, BarChart3, PieChart,
  Calendar, MapPin, User, Star, ThumbsUp, ThumbsDown, Loader2
} from 'lucide-react';
import { User as UserType, Asset, MaintenanceRecord, AssetCategory, PurchaseQualityAnalysis } from '../types';
import { getData, saveData } from '../services/storageService';

interface MaintenanceViewProps {
  currentUser: UserType;
}

const STORAGE_KEYS = {
  ASSETS: 'kt_assets',
  MAINTENANCE: 'kt_maintenance_records',
  ANALYSIS: 'kt_purchase_analysis',
};

const CATEGORY_INFO: Record<AssetCategory, { label: string; icon: any; color: string }> = {
  furniture: { label: '家具', icon: Package, color: 'bg-amber-100 text-amber-600' },
  appliance: { label: '电器', icon: Package, color: 'bg-blue-100 text-blue-600' },
  toy: { label: '玩具', icon: Package, color: 'bg-pink-100 text-pink-600' },
  facility: { label: '设施', icon: Package, color: 'bg-emerald-100 text-emerald-600' },
  it_equipment: { label: 'IT设备', icon: Package, color: 'bg-purple-100 text-purple-600' },
  other: { label: '其他', icon: Package, color: 'bg-slate-100 text-slate-600' },
};

const URGENCY_INFO = {
  low: { label: '低', color: 'bg-slate-100 text-slate-600' },
  medium: { label: '中', color: 'bg-amber-100 text-amber-600' },
  high: { label: '高', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: '紧急', color: 'bg-rose-100 text-rose-600' },
};

const MaintenanceView: React.FC<MaintenanceViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'records' | 'assets' | 'analysis'>('records');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<MaintenanceRecord['status'] | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'asset' | 'maintenance'>('maintenance');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const campus = currentUser.campus || '金星第十七幼儿园';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setAssets(getData<Asset>(STORAGE_KEYS.ASSETS));
    setRecords(getData<MaintenanceRecord>(STORAGE_KEYS.MAINTENANCE));
  };

  // 统计数据
  const stats = useMemo(() => {
    const pending = records.filter(r => r.status === 'pending').length;
    const inProgress = records.filter(r => r.status === 'in_progress').length;
    const completed = records.filter(r => r.status === 'completed').length;
    const totalCost = records.filter(r => r.repairCost).reduce((sum, r) => sum + (r.repairCost || 0), 0);
    
    // 本月统计
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRecords = records.filter(r => r.reportedAt.startsWith(thisMonth));
    const monthCost = monthRecords.filter(r => r.repairCost).reduce((sum, r) => sum + (r.repairCost || 0), 0);

    return { pending, inProgress, completed, totalCost, monthRecords: monthRecords.length, monthCost };
  }, [records]);

  // 按类别统计报修
  const categoryStats = useMemo(() => {
    const result: Record<string, { count: number; cost: number }> = {};
    records.forEach(r => {
      if (!result[r.category]) {
        result[r.category] = { count: 0, cost: 0 };
      }
      result[r.category].count++;
      result[r.category].cost += r.repairCost || 0;
    });
    return result;
  }, [records]);

  // 采购质量分析
  const qualityAnalysis = useMemo(() => {
    const analysis: Record<AssetCategory, {
      totalAssets: number;
      totalRepairs: number;
      totalCost: number;
      avgRepairRate: number;
      quality: 'excellent' | 'good' | 'average' | 'poor';
    }> = {} as any;

    Object.keys(CATEGORY_INFO).forEach(cat => {
      const categoryAssets = assets.filter(a => a.category === cat);
      const categoryRecords = records.filter(r => r.category === cat);
      const totalPurchaseCost = categoryAssets.reduce((sum, a) => sum + a.purchasePrice, 0);
      const totalRepairCost = categoryRecords.reduce((sum, r) => sum + (r.repairCost || 0), 0);
      const avgRepairRate = categoryAssets.length > 0 
        ? categoryRecords.length / categoryAssets.length 
        : 0;

      let quality: 'excellent' | 'good' | 'average' | 'poor' = 'excellent';
      if (avgRepairRate > 2) quality = 'poor';
      else if (avgRepairRate > 1) quality = 'average';
      else if (avgRepairRate > 0.5) quality = 'good';

      analysis[cat as AssetCategory] = {
        totalAssets: categoryAssets.length,
        totalRepairs: categoryRecords.length,
        totalCost: totalRepairCost,
        avgRepairRate,
        quality,
      };
    });

    return analysis;
  }, [assets, records]);

  // 过滤记录
  const filteredRecords = useMemo(() => {
    let filtered = records;
    if (filterCategory !== 'all') {
      filtered = filtered.filter(r => r.category === filterCategory);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.assetName.includes(searchTerm) || r.issue.includes(searchTerm)
      );
    }
    return filtered.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [records, filterCategory, filterStatus, searchTerm]);

  // 新增报修
  const handleAddMaintenance = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const newRecord: MaintenanceRecord = {
      id: `maint_${Date.now()}`,
      assetName: formData.get('assetName') as string,
      category: formData.get('category') as AssetCategory,
      issue: formData.get('issue') as string,
      urgency: formData.get('urgency') as MaintenanceRecord['urgency'],
      location: formData.get('location') as string,
      campus,
      reportedBy: currentUser.name,
      reportedAt: new Date().toISOString(),
      status: 'pending',
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    saveData(STORAGE_KEYS.MAINTENANCE, updated);
    setIsModalOpen(false);
  };

  // 更新状态
  const updateRecordStatus = (recordId: string, status: MaintenanceRecord['status'], cost?: number) => {
    const updated = records.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          status,
          repairCost: cost ?? r.repairCost,
          repairEndAt: status === 'completed' ? new Date().toISOString() : r.repairEndAt,
        };
      }
      return r;
    });
    setRecords(updated);
    saveData(STORAGE_KEYS.MAINTENANCE, updated);
  };

  const getStatusStyle = (status: MaintenanceRecord['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusText = (status: MaintenanceRecord['status']) => {
    switch (status) {
      case 'pending': return '待处理';
      case 'in_progress': return '维修中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
    }
  };

  return (
    <div className="p-6 space-y-6 page-transition">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            维修与资产管理
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            记录报修频次与金额，评估采购质量
          </p>
        </div>
        <button
          onClick={() => { setModalType('maintenance'); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增报修
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">待处理</span>
          </div>
          <p className="text-3xl font-black">{stats.pending}</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">维修中</span>
          </div>
          <p className="text-3xl font-black">{stats.inProgress}</p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">本月完成</span>
          </div>
          <p className="text-3xl font-black">{stats.monthRecords}</p>
        </div>
        
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">本月费用</span>
          </div>
          <p className="text-3xl font-black">¥{stats.monthCost}</p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex border-b border-slate-200">
          {[
            { id: 'records', label: '报修记录', icon: Wrench },
            { id: 'assets', label: '资产管理', icon: Package },
            { id: 'analysis', label: '采购质量分析', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* 报修记录 */}
          {activeTab === 'records' && (
            <div className="space-y-4">
              {/* 筛选 */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜索资产名称或问题..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value as any)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm font-bold"
                >
                  <option value="all">全部类别</option>
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm font-bold"
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="in_progress">维修中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>

              {/* 记录列表 */}
              {filteredRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-bold">暂无报修记录</p>
                  <p className="text-sm mt-1">点击"新增报修"添加</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRecords.map(record => (
                    <div
                      key={record.id}
                      className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
                    >
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                      >
                        <div className="flex items-center gap-4">
                          {expandedRecord === record.id ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                          <div className={`p-2 rounded-lg ${CATEGORY_INFO[record.category].color}`}>
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{record.assetName}</p>
                            <p className="text-xs text-slate-500">
                              {record.location} · {new Date(record.reportedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${URGENCY_INFO[record.urgency].color}`}>
                            {URGENCY_INFO[record.urgency].label}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusStyle(record.status)}`}>
                            {getStatusText(record.status)}
                          </span>
                        </div>
                      </div>

                      {expandedRecord === record.id && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white">
                          <p className="text-slate-700 mb-4">{record.issue}</p>
                          
                          <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {record.reportedBy}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {record.location}
                            </span>
                            {record.repairCost && (
                              <span className="flex items-center gap-1 text-orange-600 font-bold">
                                <DollarSign className="w-4 h-4" />
                                ¥{record.repairCost}
                              </span>
                            )}
                          </div>

                          {record.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateRecordStatus(record.id, 'in_progress')}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                              >
                                开始维修
                              </button>
                              <button
                                onClick={() => updateRecordStatus(record.id, 'cancelled')}
                                className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-300"
                              >
                                取消
                              </button>
                            </div>
                          )}

                          {record.status === 'in_progress' && (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="维修费用"
                                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                id={`cost_${record.id}`}
                              />
                              <button
                                onClick={() => {
                                  const costInput = document.getElementById(`cost_${record.id}`) as HTMLInputElement;
                                  updateRecordStatus(record.id, 'completed', parseFloat(costInput.value) || 0);
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"
                              >
                                完成维修
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 采购质量分析 */}
          {activeTab === 'analysis' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white">
                <h3 className="text-xl font-black mb-2">采购质量分析报告</h3>
                <p className="text-white/60 text-sm">
                  基于报修频次和维修费用，评估各类资产的采购质量
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(qualityAnalysis).map(([category, data]) => {
                  const info = CATEGORY_INFO[category as AssetCategory];
                  const qualityColor = {
                    excellent: 'text-emerald-600 bg-emerald-50',
                    good: 'text-blue-600 bg-blue-50',
                    average: 'text-amber-600 bg-amber-50',
                    poor: 'text-rose-600 bg-rose-50',
                  }[data.quality];
                  const qualityText = {
                    excellent: '优秀',
                    good: '良好',
                    average: '一般',
                    poor: '较差',
                  }[data.quality];

                  return (
                    <div key={category} className="bg-white rounded-xl border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${info.color}`}>
                            <info.icon className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-800">{info.label}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${qualityColor}`}>
                          {qualityText}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">资产数量</span>
                          <span className="font-bold text-slate-700">{data.totalAssets} 件</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">报修次数</span>
                          <span className="font-bold text-slate-700">{data.totalRepairs} 次</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">维修费用</span>
                          <span className="font-bold text-orange-600">¥{data.totalCost}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">平均报修率</span>
                          <span className={`font-bold ${data.avgRepairRate > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {data.avgRepairRate.toFixed(2)} 次/件
                          </span>
                        </div>
                      </div>

                      {data.avgRepairRate > 1 && (
                        <div className="mt-4 p-3 bg-rose-50 rounded-lg">
                          <p className="text-xs text-rose-600 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            报修率较高，建议评估供应商质量或更换采购渠道
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 结论 */}
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                <h4 className="font-black text-amber-800 mb-3">📊 分析结论</h4>
                <ul className="space-y-2 text-sm text-amber-700">
                  <li>• 报修率 &lt; 0.5：采购质量优秀，建议继续选用当前供应商</li>
                  <li>• 报修率 0.5-1.0：采购质量良好，可适当关注</li>
                  <li>• 报修率 1.0-2.0：采购质量一般，建议评估是否"买便宜亏了"</li>
                  <li>• 报修率 &gt; 2.0：采购质量较差，强烈建议更换供应商或选购更高品质产品</li>
                </ul>
              </div>
            </div>
          )}

          {/* 资产管理 */}
          {activeTab === 'assets' && (
            <div className="text-center py-16 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-bold">资产管理功能开发中</p>
              <p className="text-sm mt-1">敬请期待</p>
            </div>
          )}
        </div>
      </div>

      {/* 新增报修弹窗 */}
      {isModalOpen && modalType === 'maintenance' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-black text-slate-800 mb-4">新增报修</h3>
            <form onSubmit={handleAddMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">资产名称</label>
                <input
                  name="assetName"
                  required
                  placeholder="如：教室空调、滑滑梯"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">类别</label>
                <select
                  name="category"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">问题描述</label>
                <textarea
                  name="issue"
                  required
                  placeholder="详细描述问题..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 h-24 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">紧急程度</label>
                  <select
                    name="urgency"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">位置</label>
                  <input
                    name="location"
                    required
                    placeholder="如：大一班教室"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700"
                >
                  提交报修
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceView;


