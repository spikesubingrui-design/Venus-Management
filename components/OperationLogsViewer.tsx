/**
 * 操作日志查看器
 * 查看所有电子留存的操作记录
 */

import React, { useState, useMemo } from 'react';
import { 
  History, Search, Filter, Download, ChevronDown, ChevronUp,
  Plus, Edit, Trash2, CheckCircle, Upload, Eye, Calendar,
  User, FileText, Clock
} from 'lucide-react';
import { getOperationLogs, OperationLog, exportAllData, getStorageStats } from '../services/storageService';

const ACTION_CONFIG: Record<OperationLog['action'], { label: string; color: string; icon: React.ElementType }> = {
  CREATE: { label: '新增', color: 'bg-emerald-100 text-emerald-700', icon: Plus },
  UPDATE: { label: '更新', color: 'bg-amber-100 text-amber-700', icon: Edit },
  DELETE: { label: '删除', color: 'bg-rose-100 text-rose-700', icon: Trash2 },
  CONFIRM: { label: '确认', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  UPLOAD: { label: '上传', color: 'bg-purple-100 text-purple-700', icon: Upload },
};

const MODULE_NAMES: Record<string, string> = {
  students: '幼儿档案',
  health: '健康管理',
  attendance: '考勤管理',
  pickup: '接送管理',
  growth: '成长记录',
  kitchen: '营养厨房',
  staff: '教职工管理',
  schedule: '排班管理',
  communication: '家园共育',
  curriculum: '课程计划',
  safety: '安全工作',
  documents: '资料管理',
};

const OperationLogsViewer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const logs = useMemo(() => {
    let result = getOperationLogs();
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.targetName.toLowerCase().includes(term) ||
        log.userName.toLowerCase().includes(term) ||
        log.summary.toLowerCase().includes(term)
      );
    }
    
    if (selectedModule) {
      result = result.filter(log => log.module === selectedModule);
    }
    
    if (selectedAction) {
      result = result.filter(log => log.action === selectedAction);
    }
    
    if (dateRange.start) {
      result = result.filter(log => log.timestamp >= dateRange.start);
    }
    
    if (dateRange.end) {
      result = result.filter(log => log.timestamp <= dateRange.end + 'T23:59:59');
    }
    
    return result;
  }, [searchTerm, selectedModule, selectedAction, dateRange]);

  const stats = useMemo(() => getStorageStats(), []);

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `金星教育系统_数据备份_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-100 rounded-2xl">
            <History className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">操作日志 & 电子留存</h2>
            <p className="text-sm text-slate-500">共 {logs.length} 条记录</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-200"
          >
            <Eye className="w-4 h-4" />
            存储统计
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-amber-700"
          >
            <Download className="w-4 h-4" />
            导出全部数据
          </button>
        </div>
      </div>

      {/* 存储统计 */}
      {showStats && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-4">数据存储统计</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {stats.map(s => (
              <div key={s.key} className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 truncate">{s.key}</p>
                <p className="font-bold text-slate-700">{s.count} 条</p>
                <p className="text-xs text-slate-500">{s.size}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-3">
          {/* 搜索 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索操作对象、操作人..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-amber-500 text-sm font-bold"
            />
          </div>

          {/* 模块筛选 */}
          <select
            value={selectedModule}
            onChange={e => setSelectedModule(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-amber-500 text-sm font-bold"
          >
            <option value="">全部模块</option>
            {Object.entries(MODULE_NAMES).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>

          {/* 操作类型筛选 */}
          <select
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-amber-500 text-sm font-bold"
          >
            <option value="">全部操作</option>
            {Object.entries(ACTION_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          {/* 日期范围 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-amber-500 text-sm font-bold"
            />
            <span className="text-slate-400">至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-amber-500 text-sm font-bold"
            />
          </div>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">暂无操作记录</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.slice(0, 100).map(log => {
              const actionConfig = ACTION_CONFIG[log.action];
              const ActionIcon = actionConfig.icon;
              const isExpanded = expandedLogId === log.id;

              return (
                <div key={log.id} className="hover:bg-slate-50 transition-colors">
                  <div 
                    className="p-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    {/* 操作类型 */}
                    <div className={`p-2 rounded-xl ${actionConfig.color}`}>
                      <ActionIcon className="w-4 h-4" />
                    </div>

                    {/* 主要信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 truncate">{log.targetName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${actionConfig.color}`}>
                          {actionConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate">{log.summary}</p>
                    </div>

                    {/* 模块 */}
                    <div className="hidden md:block">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                        {MODULE_NAMES[log.module] || log.module}
                      </span>
                    </div>

                    {/* 操作人 */}
                    <div className="hidden sm:flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-slate-600">{log.userName}</span>
                    </div>

                    {/* 时间 */}
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span className="font-mono text-xs">{formatTime(log.timestamp)}</span>
                    </div>

                    {/* 展开按钮 */}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">操作ID</p>
                            <p className="text-xs font-mono text-slate-600 break-all">{log.id}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">对象ID</p>
                            <p className="text-xs font-mono text-slate-600 break-all">{log.targetId}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">对象类型</p>
                            <p className="text-sm font-bold text-slate-600">{log.targetType}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">操作人角色</p>
                            <p className="text-sm font-bold text-slate-600">{log.userRole}</p>
                          </div>
                        </div>

                        {/* 数据变更 */}
                        {(log.beforeData || log.afterData) && (
                          <div className="grid md:grid-cols-2 gap-4">
                            {log.beforeData && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 mb-2">修改前数据</p>
                                <pre className="p-3 bg-rose-50 rounded-lg text-xs text-rose-700 overflow-auto max-h-40">
                                  {JSON.stringify(log.beforeData, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.afterData && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 mb-2">修改后数据</p>
                                <pre className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-700 overflow-auto max-h-40">
                                  {JSON.stringify(log.afterData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {logs.length > 100 && (
        <p className="text-center text-sm text-slate-400">仅显示最近 100 条记录，共 {logs.length} 条</p>
      )}
    </div>
  );
};

export default OperationLogsViewer;








