import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isPlaywrightRuntime = process.env.PLAYWRIGHT_TEST === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: isPlaywrightRuntime ? 'node_modules/.vite-playwright' : undefined,
  build: {
    minify: 'oxc',
    chunkSizeWarningLimit: 450,
    rolldownOptions: {
      output: {
        codeSplitting: true,
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('/react/')) return 'react'
          if (id.includes('@xzdarcy/react-timeline-editor')) return 'timeline'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('/zustand') || id.includes('/zundo')) return 'state'
          return undefined
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'framer-motion'],
    force: isPlaywrightRuntime
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@veomuse/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  server: {
    port: 42873,
    strictPort: true,
    hmr: isPlaywrightRuntime ? false : undefined,
    // 彻底移除 proxy，避免干扰根路径
    proxy: {}
  }
})
