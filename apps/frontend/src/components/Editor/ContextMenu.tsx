import React, { useEffect, useState } from 'react';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: {
    label: string;
    onClick: () => void;
    shortcut?: string;
    type?: 'normal' | 'danger';
  }[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, options }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="pro-context-menu" 
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt, i) => (
        <div 
          key={i} 
          className={`menu-item ${opt.type || ''}`}
          onClick={() => { opt.onClick(); onClose(); }}
        >
          <span className="menu-label">{opt.label}</span>
          {opt.shortcut && <span className="menu-shortcut">{opt.shortcut}</span>}
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;
