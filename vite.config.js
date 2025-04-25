import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    assetsDir: '.', // JS/CSS/imagens geradas ficam na raiz de docs/
    rollupOptions: {
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: ({ name }) => {
          // Mantém estrutura do public/ e põe o resto na raiz de docs/
          if (/\.(gif|jpe?g|png|svg|webp|ico|ttf|woff2?|eot)$/.test(name ?? '')) {
            return '[name]-[hash][extname]'
          }
          return '[name]-[hash][extname]'
        }
      }
    }
  }
})
