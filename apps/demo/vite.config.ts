import { defineConfig } from "vite";

export default defineConfig({
	root: ".",
	server: {
		port: 3000,
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
	build: {
		target: "es2023",
		outDir: "dist",
	},
	resolve: {
		dedupe: ["lit"],
	},
});
