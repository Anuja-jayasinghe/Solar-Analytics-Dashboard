import React, { useEffect, useRef, useState } from 'react';

let externalAdd;

export function useToast() {
  const add = (msg, type = 'info') => externalAdd?.({ id: Date.now(), msg, type });
  return {
    info: (m) => add(m, 'info'),
    success: (m) => add(m, 'success'),
    error: (m) => add(m, 'error'),
  };
}

export default function ToastManager() {
  const [toasts, setToasts] = useState([]);
  const timerRef = useRef(null);

  externalAdd = (t) => {
    setToasts((prev) => [...prev, t]);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3500);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} role="status">
          {t.msg}
        </div>
      ))}
    </div>
  );
}
