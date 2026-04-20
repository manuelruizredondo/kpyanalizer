import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api/hg5': {
        target: 'https://hg5.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hg5/, ''),
      },
    },
  },
})
