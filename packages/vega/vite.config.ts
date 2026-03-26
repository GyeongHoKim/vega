import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Vega",
      fileName: "vega",
      formats: ["es", "umd"],
    },
    sourcemap: true,
    // Vite 8: https://vite.dev/guide/migration — `rollupOptions` → `rolldownOptions`
    rolldownOptions: {
      output: {
        globals: {
          // Add any external dependencies here if needed
        },
      },
    },
  },
});
