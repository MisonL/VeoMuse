import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@veomuse/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  build: {
    minify: 'oxc', 
    rollupOptions: {
      output: {
        // 采用更稳健的函数式分包，完美支持 Vite 8
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('framer-motion')) return 'vendor-core';
            return 'vendor-libs';
          }
        }
      }
    },
    target: 'esnext'
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
