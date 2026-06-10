import { useCallback, useEffect, useState } from "react";
import {
  consumePendingFlash,
  normalizeFlashMessage,
  type PendingFlash,
} from "@/lib/portal-auth";

type FlashType = "success" | "error" | "warning" | "info";

interface FlashToast extends PendingFlash {
  id: number;
}

const flashConfig: Record<
  FlashType,
  { icon: string; title: string; className: string; duration: number }
> = {
  success: { icon: "✓", title: "Success", className: "is-success", duration: 3200 },
  error: { icon: "!", title: "Error", className: "is-error", duration: 4500 },
  warning: { icon: "!", title: "Warning", className: "is-warning", duration: 4200 },
  info: { icon: "i", title: "Notice", className: "is-info", duration: 3200 },
};

export function AuthFlashContainer() {
  const [toasts, setToasts] = useState<FlashToast[]>([]);

  const showFlash = useCallback(
    (
      message: unknown,
      type: FlashType = "info",
      options: { title?: string; duration?: number } = {},
    ) => {
      const text = normalizeFlashMessage(message);
      if (!text) return;

      const config = flashConfig[type];
      const id = Date.now() + Math.random();
      setToasts((prev) => [
        ...prev,
        { id, message: text, type, options },
      ]);

      const duration = options.duration ?? config.duration;
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    [],
  );

  useEffect(() => {
    const pending = consumePendingFlash();
    if (pending) {
      showFlash(pending.message, pending.type, pending.options ?? {});
    }

    (
      window as Window & { showAuthFlash?: typeof showFlash }
    ).showAuthFlash = showFlash;

    return () => {
      delete (window as Window & { showAuthFlash?: typeof showFlash }).showAuthFlash;
    };
  }, [showFlash]);

  if (toasts.length === 0) return null;

  return (
    <div className="flash-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const config = flashConfig[toast.type];
        return (
          <div
            key={toast.id}
            className={`flash-toast ${config.className}`}
            role="status"
          >
            <div className="flash-icon">{config.icon}</div>
            <div className="flash-body">
              <div className="flash-title">
                {toast.options?.title ?? config.title}
              </div>
              <div className="flash-message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="flash-close"
              aria-label="Close notification"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function showAuthFlash(
  message: unknown,
  type: FlashType = "info",
  options: { title?: string; duration?: number } = {},
) {
  const fn = (window as Window & { showAuthFlash?: typeof showAuthFlash })
    .showAuthFlash;
  fn?.(message, type, options);
}
