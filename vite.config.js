import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public', // 将 public 目录作为项目根目录
  build: {
    outDir: '../dist', // 构建输出到项目根目录下的 dist 文件夹
    emptyOutDir: true, // 构建时清空输出目录
  },
  server: {
    port: 5173, // Vite 开发服务器端口
  },
  plugins: [],
});