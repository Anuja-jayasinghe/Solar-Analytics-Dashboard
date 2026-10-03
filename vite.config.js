import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [react()],
  server: {
    // Allow ngrok tunnel hosts for local Clerk auth testing 
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app'],
    proxy: {
      '/api': {
        target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // Leave react-pdf/pdfjs-dist out of the manual vendor buckets so
            // Rollup's default chunking respects the dynamic import boundary
            // in PdfPreview.jsx (lazy-loaded) instead of bundling this ~1MB+
            // dependency into an eagerly-loaded vendor chunk.
            if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
              return undefined;
            }
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
          
          // PdfPreview.jsx is lazy-loaded (React.lazy) specifically to keep
          // its react-pdf/pdfjs-dist dependency out of the eager admin
          // bundle - excluded here so that dynamic import boundary holds.
          if (id.includes('src/components/admin/CebDataManagement/PdfPreview')) {
            return undefined;
          }

          if (id.includes('src/components/admin/') || id.includes('src/pages/Admin')) {
            return 'admin';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },

  // Vitest. Node environment: the current suites cover pure logic — the CEB bill parser,
  // the LR-001 alignment rule and the CORS helper — none of which need a DOM. Add
  // jsdom/@testing-library if component tests are introduced later.
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    reporters: 'default',

    // Coverage is measured on the code that carries the business rules: the pure shared/
    // modules, the read API's logic and the collector core. UI and glue (CLI wiring, the Supabase
    // repository, scripts) are covered by integration runs, not unit coverage, and are excluded
    // so the threshold means something. Raise the thresholds as coverage rises; never lower them
    // to make a build pass.
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.js', 'api/_lib/data/{handler,live,rateLimit}.js', 'functions/collect_telemetry/run.js'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 }
    }
  }

}})
