import { useEffect } from 'react';

export interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * 专业级全局快捷键总线
 * 借鉴 FCPX/Premiere 逻辑，支持高频剪辑操作
 */
export const useShortcuts = (shortcuts: ShortcutMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 避免在输入框触发快捷键
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      let key = '';

      // 映射逻辑
      if (event.code === 'Space') key = 'Space';
      else if (isCmdOrCtrl && event.code === 'KeyB') key = 'Cmd+B';
      else if (isCmdOrCtrl && event.code === 'KeyZ' && event.shiftKey) key = 'Cmd+Shift+Z';
      else if (isCmdOrCtrl && event.code === 'KeyZ') key = 'Cmd+Z';
      else if (isCmdOrCtrl && event.code === 'KeyS') key = 'Cmd+S';
      else if (isCmdOrCtrl && event.code === 'KeyJ') key = 'Cmd+J';
      else if (event.code === 'Backspace' || event.code === 'Delete') key = 'Delete';
      else if (event.code === 'ArrowLeft') key = event.shiftKey ? 'Shift+Left' : 'Left';
      else if (event.code === 'ArrowRight') key = event.shiftKey ? 'Shift+Right' : 'Right';
      else if (event.code === 'KeyS' && !isCmdOrCtrl) key = 'S'; // 磁吸开关

      if (key && shortcuts[key]) {
        event.preventDefault();
        shortcuts[key]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};
