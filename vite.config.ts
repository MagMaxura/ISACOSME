import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
// FIX: Replace `__dirname`, which is unavailable in some module contexts.
// `path.resolve` with a relative path like './src' will resolve from the
// current working directory, which is the project root when running Vite.
      '@': path.resolve('./src'),
    },
  },
})
