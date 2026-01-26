import { defineConfig } from 'vite'

export default defineConfig({
  // Custom domain taskman.xyz - use root path
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  },
  server: {
    open: true
  }
})
