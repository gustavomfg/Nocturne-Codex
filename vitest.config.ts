import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['tests/renderer/**', '**/node_modules/**', '**/.git/**'],
  },
})
