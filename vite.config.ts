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
    rollupOptions: {
      output: {
        globals: {
          // Add any external dependencies here if needed
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["mp4box"],
  },
});
