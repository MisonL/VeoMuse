import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
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
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'framer-motion'],
                    'vendor-utils': ['zustand', 'zundo', 'react-use']
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
});
