import React, { createContext, useContext, useState } from "react";

const ToastCtx = createContext(null);

export const ToastProvider = ({ children }) => {
  const [ts, setTs] = useState([]);
  
  const show = (msg, type = "success") => {
    const id = Date.now();
    setTs((p) => [...p, { id, msg, type }]);
    setTimeout(() => setTs((p) => p.filter((t) => t.id !== id)), 3500);
  };
  
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-container">
        {ts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>
              {t.type === "success" ? "✓" : t.type === "error" ? "❌" : t.type === "warning" ? "⚠️" : "ℹ️"}
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => useContext(ToastCtx);
