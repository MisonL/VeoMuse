import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public', // 将 public 目录作为项目根目录
  build: {
    outDir: '../dist', // 构建输出到项目根目录下的 dist 文件夹
    emptyOutDir: true, // 构建时清空输出目录
  },
  server: {
    port: 5173, // Vite 开发服务器端口
    proxy: {
      '/api': 'http://localhost:3001', // 将 /api 请求代理到 Express 后端
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true, // 启用 WebSocket 代理
      },
      // 代理其他后端静态文件（如 /generated/）
      '/generated': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
  plugins: [],
});