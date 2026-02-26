import React from 'react';
import { motion } from 'framer-motion';
import './Atoms.css';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.6, delay, type: 'spring', damping: 20 }}
    className={`premium-glass-card ${className}`}
  >
    {children}
  </motion.div>
);

interface ProButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  className?: string;
  isLoading?: boolean;
  icon?: string;
}

export const ProButton: React.FC<ProButtonProps> = ({ 
  children, onClick, variant = 'primary', className = '', isLoading, icon 
}) => (
  <motion.button
    whileHover={{ scale: 1.02, translateY: -1 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    disabled={isLoading}
    className={`pro-btn btn-${variant} ${className} ${isLoading ? 'btn-loading' : ''}`}
  >
    {icon && <span className="btn-icon">{icon}</span>}
    <span className="btn-text">{children}</span>
    {isLoading && <div className="btn-spinner" />}
  </motion.button>
);

export const ProInput: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <div className="pro-input-wrapper">
    <textarea {...props} className={`pro-textarea ${props.className || ''}`} />
    <div className="pro-input-glow" />
  </div>
);
