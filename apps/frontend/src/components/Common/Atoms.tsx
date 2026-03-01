import React from 'react';
import { motion } from 'framer-motion';
import './Atoms.css';

// 玻璃卡片：增加深度内阴影与流光边框
export const GlassCard: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
    animate={{ opacity: 1, backdropFilter: 'blur(40px)' }}
    transition={{ duration: 0.8, delay }}
    className={`pro-glass-container ${className}`}
  >
    <div className="glass-inner-glow" />
    {children}
  </motion.div>
);

// 专业图标按钮
export const ToolButton: React.FC<{ icon: string; active?: boolean; onClick?: () => void; label?: string }> = ({ icon, active, onClick, label }) => (
  <button className={`tool-btn ${active ? 'active' : ''}`} onClick={onClick} title={label}>
    <span className="tool-icon">{icon}</span>
  </button>
);

// 专业级数值滑块
export const ProSlider: React.FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => (
  <div className="pro-slider-group">
    <div className="slider-header">
      <label>{label}</label>
      <span className="slider-value">{value.toFixed(1)}</span>
    </div>
    <input name={`slider-${label}`} type="range" min={min} max={max} step={0.1} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="pro-range" />
  </div>
);
