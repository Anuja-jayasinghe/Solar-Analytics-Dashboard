import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.html'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('chart.js') || id.includes('recharts') || id.includes('react-liquid-gauge')) {
              return 'chart-vendor';
            }
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'supabase-vendor';
            }
            if (id.includes('lodash') || id.includes('crypto-js') || id.includes('lucide-react')) {
              return 'utils-vendor';
            }
            return 'vendor';
          }
          
          
          // Feature chunks
          if (id.includes('src/components/dashboard/')) {
            if (id.includes('EnergyCharts') || id.includes('SystemTrends')) {
              return 'charts';
            }
            if (id.includes('Earnings') || id.includes('Environmental')) {
              return 'analytics';
            }
            return 'dashboard';
          }
          
          if (id.includes('src/components/admin/') || id.includes('src/pages/Admin')) {
            return 'admin';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
  
})
