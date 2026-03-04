import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '../../store/toastStore'
import './ToastContainer.css'

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore()

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      default:
        return 'ℹ️'
    }
  }

  return (
    <div
      className="toast-container"
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`toast-item glass-panel-inner ${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <span className="toast-icon" aria-hidden="true">
              {getIcon(toast.type)}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss-btn"
              aria-label={`关闭通知：${toast.message}`}
              onClick={() => removeToast(toast.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  removeToast(toast.id)
                }
              }}
            >
              关闭
            </button>
            {toast.actions && toast.actions.length > 0 ? (
              <div className="toast-actions">
                {toast.actions.map((action, index) => (
                  <button
                    key={`${toast.id}-${index}`}
                    className={`toast-action-btn ${action.variant || 'secondary'}`}
                    onClick={() => {
                      action.onClick?.()
                      removeToast(toast.id)
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer
