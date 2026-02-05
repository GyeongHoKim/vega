import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "VideoRenderer",
      fileName: "video-renderer",
      formats: ["es", "umd"],
    },
    sourcemap: true,
    rollupOptions: {
      output: {
        globals: {},
      },
    },
  },
});
