/**
 * 异常监控机制视图
 * 对比历史月份数据，自动监控物资消耗异常波动（如某月用纸量激增），可追溯原因
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle, TrendingUp, TrendingDown, Search, Filter,
  Calendar, ChevronRight, ChevronDown, CheckCircle2, Clock,
  Eye, FileText, Package, Zap, Droplet, Coffee, Printer,
  ShoppingCart, Plus, BarChart3, Activity, AlertCircle, X
} from 'lucide-react';
import { User, ConsumptionRecord, AnomalyAlert } from '../types';
import { getData, saveData } from '../services/storageService';

interface AnomalyMonitorViewProps {
  currentUser: User;
}

const STORAGE_KEYS = {
  CONSUMPTION: 'kt_consumption_records',
  ALERTS: 'kt_anomaly_alerts',
};

const CATEGORY_INFO: Record<string, { label: string; icon: any; color: string; unit: string }> = {
  paper: { label: '纸张', icon: FileText, color: 'bg-amber-100 text-amber-600', unit: '箱' },
  cleaning: { label: '清洁用品', icon: Droplet, color: 'bg-blue-100 text-blue-600', unit: '件' },
  food: { label: '食材', icon: Coffee, color: 'bg-emerald-100 text-emerald-600', unit: 'kg' },
  office: { label: '办公用品', icon: Printer, color: 'bg-purple-100 text-purple-600', unit: '件' },
  teaching: { label: '教学用品', icon: Package, color: 'bg-pink-100 text-pink-600', unit: '套' },
  other: { label: '其他', icon: ShoppingCart, color: 'bg-slate-100 text-slate-600', unit: '件' },
};

const SEVERITY_INFO = {
  info: { label: '提示', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertCircle },
  warning: { label: '警告', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  critical: { label: '严重', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertTriangle },
};

// 示例历史数据
const generateSampleData = (): ConsumptionRecord[] => {
  const categories = Object.keys(CATEGORY_INFO);
  const items: Record<string, { name: string; avgQty: number; avgCost: number }[]> = {
    paper: [{ name: 'A4打印纸', avgQty: 5, avgCost: 150 }, { name: '卫生纸', avgQty: 20, avgCost: 200 }],
    cleaning: [{ name: '洗手液', avgQty: 10, avgCost: 100 }, { name: '消毒液', avgQty: 8, avgCost: 160 }],
    food: [{ name: '大米', avgQty: 100, avgCost: 500 }, { name: '食用油', avgQty: 20, avgCost: 400 }],
    office: [{ name: '打印耗材', avgQty: 3, avgCost: 300 }, { name: '文具', avgQty: 50, avgCost: 200 }],
    teaching: [{ name: '美术用品', avgQty: 30, avgCost: 500 }, { name: '玩具', avgQty: 10, avgCost: 800 }],
    other: [{ name: '其他物资', avgQty: 15, avgCost: 300 }],
  };

  const records: ConsumptionRecord[] = [];
  const now = new Date();
  
  // 生成最近6个月的数据
  for (let m = 5; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);
    const period = date.toISOString().slice(0, 7);

    categories.forEach(cat => {
      items[cat]?.forEach(item => {
        // 添加一些随机波动，某些月份有异常
        let multiplier = 0.8 + Math.random() * 0.4; // 正常波动 ±20%
        
        // 模拟异常：当前月份的纸张消耗异常高
        if (m === 0 && cat === 'paper' && item.name === 'A4打印纸') {
          multiplier = 2.5; // 激增150%
        }
        // 模拟异常：上个月清洁用品异常高
        if (m === 1 && cat === 'cleaning') {
          multiplier = 1.8;
        }

        records.push({
          id: `consumption_${cat}_${item.name}_${period}`,
          itemName: item.name,
          category: cat as any,
          quantity: Math.round(item.avgQty * multiplier),
          unit: CATEGORY_INFO[cat].unit,
          cost: Math.round(item.avgCost * multiplier),
          period,
          campus: '金星第十七幼儿园',
          recordedBy: '系统',
          recordedAt: date.toISOString(),
        });
      });
    });
  }

  return records;
};

const AnomalyMonitorView: React.FC<AnomalyMonitorViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'consumption' | 'analysis'>('alerts');
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const campus = currentUser.campus || '金星第十七幼儿园';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    let savedConsumptions = getData<ConsumptionRecord>(STORAGE_KEYS.CONSUMPTION);
    if (savedConsumptions.length === 0) {
      // 如果没有数据，生成示例数据
      savedConsumptions = generateSampleData();
      saveData(STORAGE_KEYS.CONSUMPTION, savedConsumptions);
    }
    setConsumptions(savedConsumptions);

    // 检测异常并生成警报
    const detectedAlerts = detectAnomalies(savedConsumptions);
    setAlerts(detectedAlerts);
    saveData(STORAGE_KEYS.ALERTS, detectedAlerts);
  };

  // 异常检测算法
  const detectAnomalies = (records: ConsumptionRecord[]): AnomalyAlert[] => {
    const alerts: AnomalyAlert[] = [];
    const currentMonth = thisMonth;
    
    // 按物品分组
    const itemGroups: Record<string, ConsumptionRecord[]> = {};
    records.forEach(r => {
      const key = `${r.itemName}_${r.category}`;
      if (!itemGroups[key]) itemGroups[key] = [];
      itemGroups[key].push(r);
    });

    // 对每个物品检测异常
    Object.entries(itemGroups).forEach(([key, items]) => {
      const sorted = items.sort((a, b) => a.period.localeCompare(b.period));
      const currentRecord = sorted.find(r => r.period === currentMonth);
      
      if (!currentRecord) return;

      // 计算历史平均值（排除当月）
      const historicalRecords = sorted.filter(r => r.period !== currentMonth);
      if (historicalRecords.length < 2) return; // 需要至少2个月历史数据

      const avgQuantity = historicalRecords.reduce((sum, r) => sum + r.quantity, 0) / historicalRecords.length;
      const avgCost = historicalRecords.reduce((sum, r) => sum + r.cost, 0) / historicalRecords.length;

      // 检测数量异常
      const quantityDeviation = ((currentRecord.quantity - avgQuantity) / avgQuantity) * 100;
      const costDeviation = ((currentRecord.cost - avgCost) / avgCost) * 100;

      // 判断异常级别
      let severity: 'info' | 'warning' | 'critical' | null = null;
      let type: AnomalyAlert['type'] = 'consumption_spike';

      if (quantityDeviation > 100) {
        severity = 'critical';
      } else if (quantityDeviation > 50) {
        severity = 'warning';
      } else if (quantityDeviation > 30) {
        severity = 'info';
      }

      if (severity) {
        const possibleReasons = [
          quantityDeviation > 80 ? '可能存在浪费或异常损耗' : '',
          quantityDeviation > 50 ? '建议核查领用记录' : '',
          '季节性因素（如开学季）',
          '特殊活动需求增加',
          '库存盘点误差',
        ].filter(Boolean);

        const suggestedActions = [
          '核查本月领用明细',
          '与上月同比分析',
          '确认是否有特殊活动',
          '检查是否存在浪费',
        ];

        alerts.push({
          id: `alert_${key}_${currentMonth}`,
          type,
          severity,
          itemName: currentRecord.itemName,
          category: currentRecord.category,
          currentValue: currentRecord.quantity,
          historicalAvg: Math.round(avgQuantity * 10) / 10,
          deviation: Math.round(quantityDeviation),
          period: currentMonth,
          campus,
          possibleReasons,
          suggestedActions,
          status: 'new',
          createdAt: new Date().toISOString(),
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };

  // 确认警报
  const acknowledgeAlert = (alertId: string) => {
    const updated = alerts.map(a => 
      a.id === alertId 
        ? { ...a, status: 'acknowledged' as const, acknowledgedBy: currentUser.name, acknowledgedAt: new Date().toISOString() }
        : a
    );
    setAlerts(updated);
    saveData(STORAGE_KEYS.ALERTS, updated);
  };

  // 解决警报
  const resolveAlert = (alertId: string, resolution: string) => {
    const updated = alerts.map(a => 
      a.id === alertId 
        ? { ...a, status: 'resolved' as const, resolution, resolvedAt: new Date().toISOString() }
        : a
    );
    setAlerts(updated);
    saveData(STORAGE_KEYS.ALERTS, updated);
  };

  // 按类别统计消耗
  const consumptionByCategory = useMemo(() => {
    const currentRecords = consumptions.filter(c => c.period === thisMonth);
    const result: Record<string, { quantity: number; cost: number }> = {};
    
    currentRecords.forEach(r => {
      if (!result[r.category]) {
        result[r.category] = { quantity: 0, cost: 0 };
      }
      result[r.category].quantity += r.quantity;
      result[r.category].cost += r.cost;
    });

    return result;
  }, [consumptions, thisMonth]);

  // 过滤警报
  const filteredAlerts = useMemo(() => {
    let filtered = alerts;
    if (filterCategory !== 'all') {
      filtered = filtered.filter(a => a.category === filterCategory);
    }
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(a => a.severity === filterSeverity);
    }
    return filtered;
  }, [alerts, filterCategory, filterSeverity]);

  // 添加消耗记录
  const handleAddConsumption = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const newRecord: ConsumptionRecord = {
      id: `consumption_${Date.now()}`,
      itemName: formData.get('itemName') as string,
      category: formData.get('category') as any,
      quantity: parseFloat(formData.get('quantity') as string),
      unit: CATEGORY_INFO[formData.get('category') as string].unit,
      cost: parseFloat(formData.get('cost') as string),
      period: thisMonth,
      campus,
      recordedBy: currentUser.name,
      recordedAt: new Date().toISOString(),
    };

    const updated = [newRecord, ...consumptions];
    setConsumptions(updated);
    saveData(STORAGE_KEYS.CONSUMPTION, updated);
    setIsAddModalOpen(false);

    // 重新检测异常
    const detectedAlerts = detectAnomalies(updated);
    setAlerts(detectedAlerts);
    saveData(STORAGE_KEYS.ALERTS, detectedAlerts);
  };

  return (
    <div className="p-6 space-y-6 page-transition">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            异常监控
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            自动监控物资消耗异常波动，对比历史数据追溯原因
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          记录消耗
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">严重异常</span>
          </div>
          <p className="text-3xl font-black">
            {alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">警告</span>
          </div>
          <p className="text-3xl font-black">
            {alerts.filter(a => a.severity === 'warning' && a.status !== 'resolved').length}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">提示</span>
          </div>
          <p className="text-3xl font-black">
            {alerts.filter(a => a.severity === 'info' && a.status !== 'resolved').length}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">已解决</span>
          </div>
          <p className="text-3xl font-black">
            {alerts.filter(a => a.status === 'resolved').length}
          </p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex border-b border-slate-200">
          {[
            { id: 'alerts', label: '异常警报', icon: AlertTriangle },
            { id: 'consumption', label: '消耗记录', icon: Package },
            { id: 'analysis', label: '趋势分析', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* 异常警报 */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              {/* 筛选 */}
              <div className="flex gap-3 mb-6">
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm font-bold"
                >
                  <option value="all">全部类别</option>
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
                <select
                  value={filterSeverity}
                  onChange={e => setFilterSeverity(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm font-bold"
                >
                  <option value="all">全部级别</option>
                  <option value="critical">严重</option>
                  <option value="warning">警告</option>
                  <option value="info">提示</option>
                </select>
              </div>

              {/* 警报列表 */}
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                  <p className="font-bold text-emerald-600">暂无异常</p>
                  <p className="text-sm mt-1">所有物资消耗在正常范围内</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAlerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`rounded-xl border overflow-hidden ${SEVERITY_INFO[alert.severity].color}`}
                    >
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                      >
                        <div className="flex items-center gap-4">
                          {expandedAlert === alert.id ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                          <div className={`p-2 rounded-lg ${CATEGORY_INFO[alert.category].color}`}>
                            {React.createElement(CATEGORY_INFO[alert.category].icon, { className: 'w-4 h-4' })}
                          </div>
                          <div>
                            <p className="font-bold">{alert.itemName}</p>
                            <p className="text-xs opacity-70">
                              {CATEGORY_INFO[alert.category].label} · {alert.period}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold flex items-center gap-1">
                              {alert.deviation > 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {alert.deviation > 0 ? '+' : ''}{alert.deviation}%
                            </p>
                            <p className="text-xs opacity-70">
                              当前 {alert.currentValue} / 平均 {alert.historicalAvg}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            alert.status === 'resolved' ? 'bg-emerald-200 text-emerald-700' :
                            alert.status === 'acknowledged' ? 'bg-blue-200 text-blue-700' :
                            'bg-white/50'
                          }`}>
                            {alert.status === 'resolved' ? '已解决' :
                             alert.status === 'acknowledged' ? '已确认' : '待处理'}
                          </span>
                        </div>
                      </div>

                      {expandedAlert === alert.id && (
                        <div className="px-4 pb-4 pt-2 border-t border-current/10 bg-white/50">
                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-xs font-bold mb-2 opacity-70">可能原因</p>
                              <ul className="space-y-1 text-sm">
                                {alert.possibleReasons.map((reason, idx) => (
                                  <li key={idx}>• {reason}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-bold mb-2 opacity-70">建议操作</p>
                              <ul className="space-y-1 text-sm">
                                {alert.suggestedActions.map((action, idx) => (
                                  <li key={idx}>• {action}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {alert.status === 'new' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => acknowledgeAlert(alert.id)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                              >
                                确认已知悉
                              </button>
                              <button
                                onClick={() => resolveAlert(alert.id, '已核查，属于正常波动')}
                                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"
                              >
                                标记已解决
                              </button>
                            </div>
                          )}

                          {alert.status === 'acknowledged' && (
                            <button
                              onClick={() => resolveAlert(alert.id, '已处理完成')}
                              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"
                            >
                              标记已解决
                            </button>
                          )}

                          {alert.resolution && (
                            <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                              <p className="text-xs text-emerald-600">
                                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                解决说明：{alert.resolution}
                              </p>
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

          {/* 消耗记录 */}
          {activeTab === 'consumption' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {Object.entries(CATEGORY_INFO).map(([key, info]) => {
                  const data = consumptionByCategory[key] || { quantity: 0, cost: 0 };
                  return (
                    <div key={key} className={`${info.color} rounded-xl p-4 text-center`}>
                      {React.createElement(info.icon, { className: 'w-6 h-6 mx-auto mb-2' })}
                      <p className="text-xs font-bold">{info.label}</p>
                      <p className="text-lg font-black">{data.quantity} {info.unit}</p>
                      <p className="text-xs opacity-70">¥{data.cost}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="font-bold text-slate-700 mb-3">本月消耗明细 ({thisMonth})</h4>
                <div className="space-y-2">
                  {consumptions
                    .filter(c => c.period === thisMonth)
                    .map(record => (
                      <div key={record.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${CATEGORY_INFO[record.category].color}`}>
                            {React.createElement(CATEGORY_INFO[record.category].icon, { className: 'w-4 h-4' })}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{record.itemName}</p>
                            <p className="text-xs text-slate-500">{CATEGORY_INFO[record.category].label}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-700">{record.quantity} {record.unit}</p>
                          <p className="text-xs text-slate-500">¥{record.cost}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* 趋势分析 */}
          {activeTab === 'analysis' && (
            <div className="text-center py-16 text-slate-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-bold">趋势分析功能开发中</p>
              <p className="text-sm mt-1">敬请期待</p>
            </div>
          )}
        </div>
      </div>

      {/* 添加消耗记录弹窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800">记录物资消耗</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddConsumption} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">物资名称</label>
                <input
                  name="itemName"
                  required
                  placeholder="如：A4打印纸"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">类别</label>
                <select
                  name="category"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">数量</label>
                  <input
                    name="quantity"
                    type="number"
                    required
                    placeholder="10"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">金额 (元)</label>
                  <input
                    name="cost"
                    type="number"
                    required
                    placeholder="200"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700"
                >
                  保存记录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnomalyMonitorView;


