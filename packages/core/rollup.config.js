import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default defineConfig([
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/index.js',
                format: 'esm',
            },
            {
                file: 'dist/index.cjs',
                format: 'umd',
                name: 'MakeParser',
            },
        ],
        plugins: [typescript()],
    },
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/index.d.ts',
                format: 'esm',
            },
        ],
        plugins: [dts()],
    },
]);
