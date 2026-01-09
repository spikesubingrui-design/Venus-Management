import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

// Toast 类型
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast 提供者组件
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration = 3000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastItem = { id, type, title, message, duration };
    
    setToasts(prev => [...prev, newToast]);

    // 自动移除
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => {
    showToast('success', title, message);
  }, [showToast]);

  const error = useCallback((title: string, message?: string) => {
    showToast('error', title, message, 5000); // 错误显示更长时间
  }, [showToast]);

  const warning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message, 4000);
  }, [showToast]);

  const info = useCallback((title: string, message?: string) => {
    showToast('info', title, message);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/* Toast 容器 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// 单个 Toast 项
const ToastItem: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconStyles = {
    success: 'text-emerald-500 bg-emerald-100',
    error: 'text-rose-500 bg-rose-100',
    warning: 'text-amber-500 bg-amber-100',
    info: 'text-blue-500 bg-blue-100',
  };

  return (
    <div
      className={`
        pointer-events-auto min-w-[280px] max-w-[400px] p-4 rounded-2xl border-2 shadow-xl
        transform transition-all duration-300 ease-out
        ${styles[toast.type]}
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${iconStyles[toast.type]}`}>
          {icons[toast.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{toast.title}</p>
          {toast.message && (
            <p className="text-xs mt-1 opacity-80">{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded-lg hover:bg-black/5 transition-colors opacity-50 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Hook 用于在组件中使用 Toast
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastProvider;
