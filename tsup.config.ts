import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        normalize: 'src/normalize.ts',
        'liquidacion/index': 'src/liquidacion/index.ts',
        'liquidacion/types': 'src/liquidacion/types.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
})
