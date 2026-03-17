import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(env.VITE_MAPBOX_TOKEN),
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
  }
})
