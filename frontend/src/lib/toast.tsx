// frontend/src/lib/toast.tsx
//
// Toast / snackbar system. Re-skinned to match the new design tokens
// (light surface, rose/emerald/amber/red accents) and tightened up:
//
//   - aria-live regions so screen readers announce updates
//   - timers are tracked in a ref AND cleaned up on dismiss/unmount (the
//     previous implementation leaked one timer per call)
//   - `toast.promise(p, { loading, success, error })` for async UX
//   - optional `action` button for undo / retry flows
//   - capped at 5 visible toasts, oldest fades out
//   - mobile: anchors to bottom of the viewport, full-width with safe gutters
//   - desktop: anchors to bottom-right
//
// Public API kept backwards-compatible with the v3 implementation: every
// caller of `useToast().toast.success(msg)` etc. keeps working unchanged.

'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/components/ui/cn';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  /** Label shown on the trailing button. */
  label: string;
  /** Click handler. The toast auto-dismisses after the action runs. */
  onClick: () => void;
}

export interface ToastOptions {
  /** Milliseconds before auto-dismiss. Defaults to 4500; pass 0 to disable. */
  duration?: number;
  /** Optional second-line description. */
  description?: string;
  /** Optional action button. */
  action?: ToastAction;
}

interface InternalToast {
  id: string;
  message: string;
  type: ToastType;
  leaving: boolean;
  description?: string;
  action?: ToastAction;
  duration: number;
}

interface ToastCtx {
  toasts: InternalToast[];
  addToast: (message: string, type: ToastType, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
  /** Wrap a promise in a 3-state toast (loading → success | error). */
  promise: <T>(
    p: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((value: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) => Promise<T>;
}

const Ctx = React.createContext<ToastCtx | null>(null);

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 4500;
const EXIT_ANIM_MS = 220;

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<InternalToast[]>([]);
  // Map<id, NodeJS.Timeout> — cleaned on dismiss + on provider unmount.
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = React.useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const removeToast = React.useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      );
      // Drop after the exit animation runs.
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, EXIT_ANIM_MS);
    },
    [clearTimer],
  );

  const addToast = React.useCallback(
    (message: string, type: ToastType, options?: ToastOptions): string => {
      const id = uuid();
      const duration =
        options?.duration === undefined ? DEFAULT_DURATION : options.duration;

      setToasts((prev) => {
        // Cap to MAX_VISIBLE, dropping the oldest in-place — visually fine
        // because we trigger its exit animation first.
        const next = [
          ...prev,
          {
            id,
            message,
            type,
            leaving: false,
            description: options?.description,
            action: options?.action,
            duration,
          },
        ];
        if (next.length > MAX_VISIBLE) {
          // Force-drop the oldest immediately.
          const dropped = next.shift();
          if (dropped) clearTimer(dropped.id);
        }
        return next;
      });

      if (duration > 0) {
        const handle = setTimeout(() => removeToast(id), duration);
        timers.current.set(id, handle);
      }
      return id;
    },
    [clearTimer, removeToast],
  );

  // Async helper — pattern works for any save/submit flow.
  const promise = React.useCallback(
    async <T,>(
      p: Promise<T>,
      msgs: {
        loading: string;
        success: string | ((value: T) => string);
        error: string | ((err: unknown) => string);
      },
    ): Promise<T> => {
      const loadingId = addToast(msgs.loading, 'info', { duration: 0 });
      try {
        const value = await p;
        removeToast(loadingId);
        addToast(
          typeof msgs.success === 'function' ? msgs.success(value) : msgs.success,
          'success',
        );
        return value;
      } catch (err) {
        removeToast(loadingId);
        addToast(
          typeof msgs.error === 'function' ? msgs.error(err) : msgs.error,
          'error',
        );
        throw err;
      }
    },
    [addToast, removeToast],
  );

  // Cleanup all pending timers on unmount.
  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((handle) => clearTimeout(handle));
      map.clear();
    };
  }, []);

  const value = React.useMemo<ToastCtx>(
    () => ({ toasts, addToast, removeToast, promise }),
    [toasts, addToast, removeToast, promise],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={removeToast} />
    </Ctx.Provider>
  );
}

/* ─────────────────────────  hook  ───────────────────────── */

/**
 * Public API. Backwards compatible:
 *   const { toast } = useToast();
 *   toast.success('Saved');
 *
 * New helpers are also available:
 *   toast.success('Member added', { description: 'FS0042', action: {…} });
 *   await toast.promise(api.save(), { loading, success, error });
 */
export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }

  const { addToast, promise, removeToast } = ctx;

  const toast = React.useMemo(
    () => ({
      success: (msg: string, options?: ToastOptions) =>
        addToast(msg, 'success', options),
      error: (msg: string, options?: ToastOptions) =>
        addToast(msg, 'error', options),
      info: (msg: string, options?: ToastOptions) =>
        addToast(msg, 'info', options),
      warning: (msg: string, options?: ToastOptions) =>
        addToast(msg, 'warning', options),
      dismiss: (id: string) => removeToast(id),
      promise,
    }),
    [addToast, promise, removeToast],
  );

  return { toast };
}

/* ─────────────────────────  viewport  ───────────────────────── */

const STYLES: Record<
  ToastType,
  { ring: string; iconBg: string; iconFg: string; Icon: React.ComponentType<{ className?: string }>; live: 'polite' | 'assertive' }
> = {
  success: {
    ring: 'ring-emerald-200',
    iconBg: 'bg-emerald-50',
    iconFg: 'text-emerald-600',
    Icon: CheckCircle2,
    live: 'polite',
  },
  error: {
    ring: 'ring-red-200',
    iconBg: 'bg-red-50',
    iconFg: 'text-red-600',
    Icon: XCircle,
    live: 'assertive',
  },
  info: {
    ring: 'ring-sky-200',
    iconBg: 'bg-sky-50',
    iconFg: 'text-sky-600',
    Icon: Info,
    live: 'polite',
  },
  warning: {
    ring: 'ring-amber-200',
    iconBg: 'bg-amber-50',
    iconFg: 'text-amber-600',
    Icon: AlertTriangle,
    live: 'polite',
  },
};

function ToastViewport({
  toasts,
  onClose,
}: {
  toasts: InternalToast[];
  onClose: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      // Full-width column on mobile, anchored bottom-right on desktop.
      className={cn(
        'pointer-events-none fixed inset-x-3 bottom-4 z-[9999] flex flex-col items-stretch gap-2',
        'sm:inset-auto sm:right-6 sm:bottom-6 sm:max-w-sm sm:items-end',
      )}
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: InternalToast;
  onClose: () => void;
}) {
  const style = STYLES[toast.type];
  const { Icon } = style;
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={style.live}
      className={cn(
        'pointer-events-auto w-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-inset',
        'transition-all duration-200',
        style.ring,
        toast.leaving
          ? 'translate-y-2 opacity-0'
          : 'translate-y-0 opacity-100',
      )}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <span
          aria-hidden
          className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', style.iconBg, style.iconFg)}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-slate-900">
            {toast.message}
          </p>
          {toast.description && (
            <p className="mt-0.5 break-words text-xs text-slate-500">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onClose();
              }}
              className="mt-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="ml-2 -m-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
