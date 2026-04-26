import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:3002',
        ws: true
      },
      '/health': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      }
    }
  }
})
