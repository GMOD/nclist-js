import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    snapshotFormat: {
      maxDepth: 50,
      maxOutputLength: Infinity,
    },
  },
})
