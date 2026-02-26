import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={`glass-panel ${className}`}
  >
    {children}
  </motion.div>
);

interface ProButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export const ProButton: React.FC<ProButtonProps> = ({ 
  onClick, children, variant = 'primary', disabled, isLoading, className = '' 
}) => (
  <button 
    onClick={onClick} 
    disabled={disabled || isLoading}
    className={`btn-${variant} ${isLoading ? 'loading' : ''} ${className}`}
  >
    {isLoading ? '⏳ 处理中...' : children}
  </button>
);
