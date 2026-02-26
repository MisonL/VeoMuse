import { treaty } from '@elysiajs/eden'
import type { App } from '@veomuse/backend'

// 创建类型安全的 Eden Client (Treaty 2.0+ 模式)
// 在开发环境下指向 localhost:3001
export const api = treaty<App>('http://localhost:3001')

/**
 * 辅助函数：从 Eden Treaty 错误对象中提取友好的错误消息
 */
export const getErrorMessage = (error: any): string => {
  if (!error) return '未知错误';
  if (error.value && typeof error.value === 'object' && 'error' in error.value) {
    return error.value.error;
  }
  return error.message || '服务器响应异常';
};
