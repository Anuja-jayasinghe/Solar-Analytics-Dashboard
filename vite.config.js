import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [react()],
  // Production bundles carry no debug chatter: log/debug/info calls are removed. console.warn and
  // console.error are kept on purpose so real problems stay visible.
  esbuild: mode === 'production' ? { pure: ['console.log', 'console.debug', 'console.info'], legalComments: 'none' } : {},
  server: {
    // Allow ngrok tunnel hosts for local Clerk auth testing (see docs/guides/LOCAL_DEVELOPMENT.md)
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
        // One deliberate vendor chunk (React). Everything else is left to Rollup's own splitting along the
        // lazy page boundaries. The previous rules (a catch-all "vendor" chunk, a Supabase chunk, an "admin"
        // chunk, and a charts chunk whose shared helpers made every page load it) put code on the preload
        // list of pages that never used it.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // Match the package directory, not a substring ("react" also matches @emotion/react, react-smooth, ...).
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return 'react-vendor';
          return undefined;
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
