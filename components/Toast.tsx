import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = crypto.randomUUID();
      const newToast: Toast = { id, message, type };

      setToasts(prev => [...prev, newToast]);

      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, duration);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const icons = {
    success: <CheckCircle size={20} />,
    error: <XCircle size={20} />,
    warning: <AlertCircle size={20} />,
    info: <Info size={20} />,
  };

  const styles = {
    success: 'bg-green-500/10 border-green-500/20 text-green-500',
    error: 'bg-red-500/10 border-red-500/20 text-red-500',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
  };

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in ${styles[toast.type]}`}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <p className="text-sm font-medium text-white flex-1">{toast.message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
};
