import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
// VITE_* env vars are picked up automatically from process.env during build
// (e.g. Docker --build-arg) — no manual define block needed.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Force a single React instance — prevents "Invalid hook call" when
    // packages like survey-creator-core are excluded from optimizeDeps.
    dedupe: ['react', 'react-dom'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          mapbox: ['mapbox-gl', 'react-map-gl'],
          survey: ['survey-core', 'survey-react-ui'],
          'survey-creator': ['survey-creator-core', 'survey-creator-react'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['mapbox-gl'],
    exclude: ['survey-creator-core'],
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 4173,
  },
})
