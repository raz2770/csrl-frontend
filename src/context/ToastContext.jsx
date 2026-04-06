import { createContext, useContext, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const ToastCtx = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = (msg, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-container">
        {toasts.map(({ id, msg, type }) => {
          const Icon = ICONS[type] ?? Info;
          return (
            <div key={id} className={`toast toast-${type}`}>
              <Icon size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
              {msg}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
