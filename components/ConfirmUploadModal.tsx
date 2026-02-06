/**
 * 确认上传弹窗组件
 * 用于所有数据提交前的确认
 */

import React from 'react';
import { CheckCircle, XCircle, Upload, AlertTriangle, FileText, Clock } from 'lucide-react';

interface ConfirmUploadModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  type: string;
  summary: string;
  details?: { label: string; value: string }[];
  isUpdate?: boolean;
  loading?: boolean;
}

const ConfirmUploadModal: React.FC<ConfirmUploadModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  type,
  summary,
  details = [],
  isUpdate = false,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* 头部 */}
        <div className={`p-6 ${isUpdate ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isUpdate ? 'bg-amber-100' : 'bg-emerald-100'}`}>
              <Upload className={`w-6 h-6 ${isUpdate ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">确认{isUpdate ? '更新' : '上传'}</h3>
              <p className="text-sm text-slate-500">{type}</p>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 提示 */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-700">请确认以下信息</p>
              <p className="text-xs text-slate-500 mt-1">确认后数据将被保存并记录操作日志</p>
            </div>
          </div>

          {/* 标题 */}
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-400">标题/名称</span>
            </div>
            <p className="font-bold text-slate-800">{title}</p>
          </div>

          {/* 摘要 */}
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-400">操作摘要</span>
            </div>
            <p className="text-sm text-slate-600">{summary}</p>
          </div>

          {/* 详情 */}
          {details.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 px-1">详细信息</p>
              <div className="grid grid-cols-2 gap-2">
                {details.map((d, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold">{d.label}</p>
                    <p className="text-sm font-bold text-slate-700 truncate">{d.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 按钮 */}
        <div className="p-6 bg-slate-50 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            <XCircle className="w-5 h-5" />
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
              isUpdate 
                ? 'bg-amber-600 text-white hover:bg-amber-700' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            确认{isUpdate ? '更新' : '上传'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmUploadModal;

/**
 * 上传成功提示组件
 */
export const UploadSuccessToast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300 z-50">
      <CheckCircle className="w-5 h-5" />
      <span className="font-bold">{message}</span>
    </div>
  );
};








