# Tech Stack

- **Language**: TypeScript (ES2020, NodeNext module).
- **Build**: Vite 7; `tsconfig.json` (noEmit), `tsconfig.build.json` for declaration emit.
- **Format/Lint**: Biome (format + lint); config in `biome.json`.
- **Testing**: Vitest 4 with **browser** provider (@vitest/browser-playwright), Chromium, headless. Tests in `tests/**/*.test.ts`; fixtures in `tests/fixtures/` (e.g. h264.mp4, *.raw frames).
- **Dependencies**: mp4box (demux); dev: @vitest/browser, @vitest/browser-playwright, @webgpu/types, husky, commitlint, semantic-release.
