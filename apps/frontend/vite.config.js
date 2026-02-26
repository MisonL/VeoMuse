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
    server: {
        port: 5173,
        strictPort: true,
        // 彻底移除 proxy，避免干扰根路径
        proxy: {}
    }
});
