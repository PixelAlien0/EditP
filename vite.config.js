import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Lightning CSS produces a smaller, standards-aware stylesheet bundle than
    // the default minifier while preserving the existing authored cascade.
    cssMinify: 'lightningcss',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/src/renderers/')) {
            return 'reference-model-renderer'
          }
          if (id.includes('/node_modules/three/')) {
            return 'reference-model-core'
          }
          if (
            id.includes('/node_modules/react/')
            || id.includes('/node_modules/react-dom/')
            || id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
          if (
            /\/src\/utils\/(?:tweakSerializer|tweakdefsHelper|lobbyModules)\.js$/.test(id)
          ) {
            return 'editor-compiler'
          }
          if (/\/src\/controllers\/use[A-Z][^/]+Controller\.js$/.test(id)
            || id.endsWith('/src/controllers/useProjectValidation.js')) {
            return 'editor-controllers'
          }
        },
      },
    },
  },
})
