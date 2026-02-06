/**
 * 修改历史面板组件
 * 显示某条记录的完整修改历史，包括字段级变更详情
 */

import React, { useState, useEffect } from 'react';
import {
  History, Clock, User, ChevronDown, ChevronUp, X, FileText,
  Plus, Edit2, Trash2, Eye, Download, Upload, ArrowRight
} from 'lucide-react';
import {
  AuditLog, getEntityHistory, formatTimestamp, getActionInfo
} from '../services/auditService';

interface EditHistoryPanelProps {
  entityId: string;
  entityName?: string;
  onClose?: () => void;
  isModal?: boolean;
}

const EditHistoryPanel: React.FC<EditHistoryPanelProps> = ({
  entityId,
  entityName,
  onClose,
  isModal = false,
}) => {
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [entityId]);

  const loadHistory = () => {
    setLoading(true);
    const logs = getEntityHistory(entityId);
    setHistory(logs);
    setLoading(false);
  };

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getActionIcon = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE': return <Plus className="w-4 h-4" />;
      case 'UPDATE': return <Edit2 className="w-4 h-4" />;
      case 'DELETE': return <Trash2 className="w-4 h-4" />;
      case 'VIEW': return <Eye className="w-4 h-4" />;
      case 'EXPORT': return <Download className="w-4 h-4" />;
      case 'IMPORT': return <Upload className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">修改历史</h3>
            {entityName && <p className="text-sm text-gray-500">{entityName}</p>}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <History className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">暂无修改记录</p>
          </div>
        ) : (
          <div className="relative">
            {/* 时间线 */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            <div className="space-y-4">
              {history.map((log, index) => {
                const actionInfo = getActionInfo(log.action);
                const isExpanded = expandedLogs.has(log.id);
                const hasChanges = log.changes && log.changes.length > 0;

                return (
                  <div key={log.id} className="relative pl-12">
                    {/* 时间线节点 */}
                    <div
                      className="absolute left-3 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
                      style={{ backgroundColor: actionInfo.color }}
                    >
                      <span className="text-white scale-75">{getActionIcon(log.action)}</span>
                    </div>

                    {/* 日志卡片 */}
                    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${
                      index === 0 ? 'ring-2 ring-orange-200' : ''
                    }`}>
                      {/* 卡片头部 */}
                      <div
                        className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                          hasChanges ? '' : 'cursor-default'
                        }`}
                        onClick={() => hasChanges && toggleExpand(log.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: `${actionInfo.color}20`,
                                  color: actionInfo.color,
                                }}
                              >
                                {actionInfo.label}
                              </span>
                              {index === 0 && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-600">
                                  最新
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 font-medium truncate">
                              {log.summary}
                            </p>
                          </div>
                          {hasChanges && (
                            <button className="p-1 text-gray-400 hover:text-gray-600">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* 操作人和时间 */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{log.operatorName}</span>
                            <span className="text-gray-400">({log.operatorRole})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span title={log.timestamp}>{formatTimestamp(log.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 展开的字段变更详情 */}
                      {isExpanded && hasChanges && (
                        <div className="border-t border-gray-100 bg-gray-50 p-3">
                          <p className="text-xs text-gray-500 mb-2 font-medium">字段修改详情：</p>
                          <div className="space-y-2">
                            {log.changes!.map((change, i) => (
                              <div
                                key={i}
                                className="bg-white rounded-lg p-2 text-sm border border-gray-100"
                              >
                                <div className="font-medium text-gray-700 mb-1">
                                  {change.fieldLabel}
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-1 bg-red-50 text-red-600 rounded line-through">
                                    {change.oldValue || '(空)'}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-gray-400" />
                                  <span className="px-2 py-1 bg-green-50 text-green-600 rounded">
                                    {change.newValue || '(空)'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部统计 */}
      {history.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50 text-sm text-gray-500">
          共 <span className="font-medium text-gray-800">{history.length}</span> 条修改记录
          {history.length > 0 && (
            <>
              ，最近修改于 <span className="font-medium text-gray-800">
                {formatTimestamp(history[0].timestamp)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );

  // 模态框模式
  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
          {content}
        </div>
      </div>
    );
  }

  // 面板模式
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
      {content}
    </div>
  );
};

export default EditHistoryPanel;

// 简化版修改历史按钮组件
export const EditHistoryButton: React.FC<{
  entityId: string;
  entityName?: string;
  size?: 'sm' | 'md';
}> = ({ entityId, entityName, size = 'md' }) => {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowHistory(true)}
        className={`flex items-center gap-1 text-gray-500 hover:text-orange-600 transition-colors ${
          size === 'sm' ? 'text-xs' : 'text-sm'
        }`}
        title="查看修改历史"
      >
        <History className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span>历史</span>
      </button>

      {showHistory && (
        <EditHistoryPanel
          entityId={entityId}
          entityName={entityName}
          onClose={() => setShowHistory(false)}
          isModal
        />
      )}
    </>
  );
};



