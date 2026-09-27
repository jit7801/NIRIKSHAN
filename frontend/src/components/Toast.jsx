import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div 
        aria-live="polite" 
        className="fixed bottom-4 right-4 z-[1100] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
      >
        {toasts.map((toast) => {
          let bg = 'bg-white border-[#E8E4DC] text-[#050505]';
          let Icon = CheckCircle2;
          let iconColor = 'text-[#2E8B57]';

          if (toast.type === 'error') {
            bg = 'bg-[#FDF2F2] border-[#F2C2C2] text-[#050505]';
            Icon = AlertCircle;
            iconColor = 'text-[#C94C4C]';
          } else if (toast.type === 'warning') {
            bg = 'bg-[#FFFBEB] border-[#E8E4DC] text-[#050505]';
            Icon = AlertTriangle;
            iconColor = 'text-[#E6A23C]';
          } else if (toast.type === 'info') {
            bg = 'bg-[#F7F7F1] border-[#C8BFB3] text-[#050505]';
            Icon = Info;
            iconColor = 'text-[#4B3C32]';
          } else {
            bg = 'bg-[#F0F8F4] border-[#C2E0D0] text-[#050505]';
            Icon = CheckCircle2;
            iconColor = 'text-[#2E8B57]';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${bg}`}
              role="alert"
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
              <p className="text-xs font-medium leading-relaxed flex-1 text-[#050505]">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[#5E5E5D] hover:text-[#050505] p-0.5 rounded transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: (msg) => console.log('Toast:', msg),
      removeToast: () => {}
    };
  }
  return context;
}
