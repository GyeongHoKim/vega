import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  base: "/vega/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
  resolve: {
    alias: {
      vega: resolve(__dirname, "../dist/vega.js"),
    },
  },
  server: {
    fs: { allow: [resolve(__dirname, "..")] },
  },
  optimizeDeps: {
    exclude: ["vega"],
  },
});
