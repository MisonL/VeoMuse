import { edenTreaty } from '@elysiajs/eden'
import type { App } from '@veomuse/backend'

// 创建类型安全的 Eden Client
// 在开发环境下指向 localhost:3001
export const api = edenTreaty<App>('http://localhost:3001')
