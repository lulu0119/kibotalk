import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  // Bundle npm and workspace packages for the standalone local proxy.
  noExternal: [/.*/],
})
