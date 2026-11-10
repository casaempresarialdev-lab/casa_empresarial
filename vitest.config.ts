import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Testes das regras puras (folha, férias, ponto, escala): rodam em Node, sem banco nem navegador
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
