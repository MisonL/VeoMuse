import { Elysia } from 'elysia'

const app = new Elysia()
  .get('/', () => 'Hello Elysia')
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }))
  .listen(3001)

console.log(`🚀 后端已在 ${app.server?.hostname}:${app.server?.port} 启动`)

export type App = typeof app
