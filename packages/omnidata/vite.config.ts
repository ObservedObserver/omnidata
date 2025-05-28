import { defineConfig } from "vite";
import path from "path";
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            insertTypesEntry: true,
            outDir: 'dist',
            exclude: ['**/*.test.ts', '**/*.test.tsx'],
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/main.ts"),
            name: "omnidata",
            fileName: (format) => `omnidata.${format}.js`,
        },
        rollupOptions: {
            external: ['fs', 'path'],
        },
    }
});
