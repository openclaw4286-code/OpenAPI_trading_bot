import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Toast from '../components/Toast.jsx';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 2600;
const EXIT_DURATION = 280;

export function ToastProvider({ children, position = 'top' }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const exit = setTimeout(() => {
      setItems((list) => list.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, EXIT_DURATION);
    timers.current.set(`${id}:exit`, exit);
  }, []);

  const push = useCallback(
    (message, { tone = 'success', duration = DEFAULT_DURATION } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((list) => [...list, { id, tone, message, leaving: false }]);
      const t = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, t);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const api = useMemo(
    () => ({
      show: (msg, opts) => push(msg, opts),
      success: (msg, opts) => push(msg, { ...opts, tone: 'success' }),
      error: (msg, opts) => push(msg, { ...opts, tone: 'error' }),
      warning: (msg, opts) => push(msg, { ...opts, tone: 'warning' }),
      info: (msg, opts) => push(msg, { ...opts, tone: 'info' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
            style={position === 'bottom' ? { bottom: 24 } : { top: 20 }}
          >
            {items.map((t) => (
              <Toast
                key={t.id}
                tone={t.tone}
                message={t.message}
                leaving={t.leaving}
                onDismiss={() => dismiss(t.id)}
              />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
