import { defineConfig } from 'vite'

export default defineConfig({
  // Set base path for GitHub Pages (repo name)
  // Change to '/' if using a custom domain
  base: '/taskman/',
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
