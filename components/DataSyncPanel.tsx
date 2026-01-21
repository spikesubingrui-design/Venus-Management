/**
 * 数据同步面板组件
 * 显示阿里云OSS同步状态，提供手动同步功能
 */

import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw, Upload, Download, Check, AlertCircle } from 'lucide-react';
import { 
  isAliyunConfigured,
  getSyncStatus,
  uploadAllToAliyun,
  initializeFromAliyun,
  checkAliyunHealth
} from '../services/aliyunOssService';

interface DataSyncPanelProps {
  campus?: string;
  onSyncComplete?: () => void;
}

const DataSyncPanel: React.FC<DataSyncPanelProps> = ({ campus, onSyncComplete }) => {
  const [syncing, setSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState<'upload' | 'download' | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, key: '' });
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cloudHealth, setCloudHealth] = useState<{ isHealthy: boolean; latency?: number } | null>(null);

  useEffect(() => {
    const status = getSyncStatus();
    setLastSync(status.lastSyncTime);
    
    // 检查云端健康状态
    if (isAliyunConfigured) {
      checkAliyunHealth().then(setCloudHealth);
    }
  }, []);

  const handleUpload = async () => {
    setSyncing(true);
    setSyncDirection('upload');
    setResult(null);

    const { success, results } = await uploadAllToAliyun((current, total, key) => {
      setProgress({ current, total, key });
    });

    const totalCount = Object.values(results).reduce((sum: number, r: any) => sum + (r.count || 0), 0);
    const errors = Object.entries(results).filter(([_, r]: [string, any]) => r.error);

    setResult({
      success,
      message: success 
        ? `✅ 已上传 ${totalCount} 条数据到阿里云`
        : `⚠️ 上传完成，但有 ${errors.length} 个错误`
    });

    setLastSync(new Date().toISOString());
    setSyncing(false);
    setSyncDirection(null);
    onSyncComplete?.();
  };

  const handleDownload = async () => {
    setSyncing(true);
    setSyncDirection('download');
    setResult(null);

    const { success, results } = await initializeFromAliyun((current, total, key) => {
      setProgress({ current, total, key });
    });

    const totalCount = Object.values(results).reduce((sum: number, r: any) => sum + (r.count || 0), 0);
    const errors = Object.entries(results).filter(([_, r]: [string, any]) => r.error);

    setResult({
      success,
      message: success 
        ? `✅ 已从阿里云下载 ${totalCount} 条数据`
        : `⚠️ 下载完成，但有 ${errors.length} 个错误`
    });

    setLastSync(new Date().toISOString());
    setSyncing(false);
    setSyncDirection(null);
    onSyncComplete?.();
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '从未同步';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const keyLabels: Record<string, string> = {
    'kt_students': '学生数据',
    'kt_staff': '教职工数据',
    'kt_authorized_phones': '授权手机号',
    'kt_all_users': '用户数据',
    'kt_fee_payments': '缴费记录',
    'kt_meal_plans': '食谱数据',
    'kt_operation_logs': '操作日志',
    'kt_announcements': '公告通知',
    'kt_documents': '资料文档',
  };

  // 阿里云 OSS 始终可用
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-orange-600" />
          <span className="font-bold text-orange-800">阿里云 OSS 同步</span>
          {cloudHealth?.isHealthy && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              {cloudHealth.latency}ms
            </span>
          )}
        </div>
        <span className="text-xs text-orange-600">
          上次同步: {formatTime(lastSync)}
        </span>
      </div>

      {syncing && (
        <div className="mb-4 p-3 bg-white/50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-orange-600 animate-spin" />
            <span className="text-sm font-medium text-orange-700">
              {syncDirection === 'upload' ? '上传中...' : '下载中...'}
            </span>
          </div>
          <div className="text-xs text-orange-600">
            {progress.current}/{progress.total} - {keyLabels[progress.key] || progress.key}
          </div>
          <div className="mt-2 h-1.5 bg-orange-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${
          result.success ? 'bg-emerald-100' : 'bg-amber-100'
        }`}>
          {result.success ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600" />
          )}
          <span className={`text-sm font-medium ${
            result.success ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            {result.message}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={syncing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="w-4 h-4" />
          上传到云端
        </button>
        <button
          onClick={handleDownload}
          disabled={syncing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          从云端下载
        </button>
      </div>

      <p className="mt-3 text-[10px] text-orange-600 text-center">
        💡 上传：本地数据 → 云端 | 下载：云端数据 → 本地
      </p>
    </div>
  );
};

export default DataSyncPanel;
