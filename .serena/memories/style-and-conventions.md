# Style and Conventions

- **Formatter/Linter**: Biome (indent 2 spaces, line width 100, organize imports). Files exclude: node_modules, dist, coverage, *.min.js, fixtures.
- **TypeScript**: Strict mode; no unnecessary `any`; external lib types (e.g. mp4box-types) may use justified biome-ignore for noExplicitAny. Vite worker import uses @ts-expect-error (Vite-specific).
- **Testing**: Prefer meaningful E2E/browser tests over many trivial unit tests (constitution). Tests run in real browser (Chromium). Use fixtures from `tests/fixtures/` (e.g. h264.mp4 for full playback tests).
