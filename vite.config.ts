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
          // Utilidades pequeñas que usa la entrada (cn()) y TAMBIÉN recharts: si
          // no se separan, Rollup las mete en "charts" y el login acaba
          // descargando recharts entero.
          if (/[\\/]node_modules[\\/](clsx|tailwind-merge)[\\/]/.test(id)) return "utils"
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react"
          if (id.includes("@supabase")) return "supabase"
          if (id.includes("css-tree")) return "css-tree"
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) return "charts"
        },
      },
    },
  },
})
