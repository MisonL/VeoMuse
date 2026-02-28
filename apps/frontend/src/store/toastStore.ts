import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastAction {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export interface ToastOptions {
  actions?: ToastAction[];
  sticky?: boolean;
  durationMs?: number;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  actions?: ToastAction[];
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'info', options) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, message, type, actions: options?.actions || [] }
      ]
    }));
    if (!options?.sticky) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
      }, options?.durationMs ?? 3000);
    }
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}))
