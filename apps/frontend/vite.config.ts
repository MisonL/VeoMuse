import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  // 启用 Vite 8 兼容性标志
  // @ts-ignore
  future: {
    // 灵活处理实验性选项
  }
})
