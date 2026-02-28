import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../../store/toastStore';
import './ToastContainer.css';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`toast-item glass-panel-inner ${toast.type}`}
            onClick={() => removeToast(toast.id)}
          >
            <span className="toast-icon">{getIcon(toast.type)}</span>
            <span className="toast-message">{toast.message}</span>
            {toast.actions && toast.actions.length > 0 ? (
              <div className="toast-actions" onClick={(e) => e.stopPropagation()}>
                {toast.actions.map((action, index) => (
                  <button
                    key={`${toast.id}-${index}`}
                    className={`toast-action-btn ${action.variant || 'secondary'}`}
                    onClick={() => {
                      action.onClick?.();
                      removeToast(toast.id);
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
  );
};

export default ToastContainer;
