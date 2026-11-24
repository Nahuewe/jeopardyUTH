import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// base './' permite servir la app desde cualquier subcarpeta (GitHub Pages).
// Dos páginas: el juego (index.html) y el buzzer del celular (buzzer.html).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        buzzer: resolve(import.meta.dirname, 'buzzer.html'),
      },
    },
  },
})
