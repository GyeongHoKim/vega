# Codebase Structure

- **src/**: Main library. `vega.ts` (VegaPlayer, createVega), `index.ts` (exports), `factory.ts` (renderer factory), `convert.ts` (raw↔VideoFrame). `types/` (vega.ts public API, worker-messages, index). `worker/` (media-worker, video-renderer). `renderers/` (2d, webgl, webgpu). `audio/` (audio-renderer, worklet, ring-buffer). `demuxer/` (mp4-demuxer, mp4box-types).
- **tests/**: `tests/integration/*.test.ts` (renderer-2d, webgl, webgpu); `tests/fixtures/` (h264.mp4, frame_*.raw). Vitest config: browser enabled, playwright, chromium, alias `@` -> `src`.
- **specs/**: Feature spec and plan under `specs/001-webcodecs-video-adaptor/`.
