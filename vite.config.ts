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
  build: {
    rollupOptions: {
      output: {
        // Librerías que cambian poco en chunks propios: sobreviven en caché
        // entre despliegues aunque cambie el código de la app.
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react"
          if (id.includes("@supabase")) return "supabase"
          if (id.includes("css-tree")) return "css-tree"
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) return "charts"
        },
      },
    },
  },
})
