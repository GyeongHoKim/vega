# Quickstart: Vega Player & Verification

**Feature**: 001-webcodecs-video-adaptor  
**Phase**: 1  
**Date**: 2025-02-06

## Development Setup

- **Node**: >= 20 (see `package.json` engines).
- **Install**: `npm install`
- **Quality gate**: `npm run format` → `npm run lint` → `npm run typecheck` → `npm run test`
- **Build**: `npm run build` → outputs in `dist/` (vega.js, vega.umd.cjs, types).

## Running Tests

- **All tests (headless browser)**: `npm run test`
- **Watch mode**: `npm run test:watch`
- Tests run in **Chromium** via Vitest + Playwright. Fixtures are under `tests/fixtures/` (e.g. `h264.mp4`, `frame_*.raw`). E2E tests load the player, load MP4 from fixtures, and assert on playback state, canvas, and events.

## Using the Player (Library Consumer)

A minimal runnable example is in **examples/minimal.html**. After `npm run build`, serve the repo root (e.g. `npx serve .`) and open `http://localhost:3000/examples/minimal.html` to load an MP4 file and try play/pause/setAdapter.

```ts
import { createVega } from "@gyeonghokim/vega";

const canvas = document.querySelector("canvas");
const player = createVega({ canvas, rendererType: "2d" });

player.on("error", (e) => console.error(e));
player.on("loadedmetadata", () => console.log("Duration:", player.duration));

await player.load("/path/to/video.mp4"); // or File/Blob
await player.play();
// ... pause(), seek(t), setVolume(v), setAdapter(adapter), etc.
player.destroy();
```

## Custom Frame Adapter

```ts
const adapter = {
  process(frame: VideoFrame): VideoFrame {
    // e.g. identity, or create new frame with effect
    return frame;
  },
};
createVega({ canvas, adapter });
// or player.setAdapter(adapter);
```

## Spec Verification (Test Author)

- **E2E scenarios** should map to spec acceptance criteria (see [spec.md](../spec.md)):
  - Load MP4 (fixture), play → video visible, state/events correct.
  - Pause/seek → state updates, resumption works.
  - Custom adaptor → frames passed through, output displayed.
  - Invalid file → error state, clear message.
- Use **real browser** and **fixtures** (`tests/fixtures/h264.mp4`). Prefer one strong E2E over many weak unit tests. See [research.md](../research.md) for strategy and [contracts/vega-api.md](contracts/vega-api.md) for API contract.

## Key Paths

| Path | Purpose |
|------|--------|
| `src/vega.ts` | Player implementation, createVega |
| `src/types/vega.ts` | Public types |
| `tests/fixtures/` | MP4 and raw frame fixtures |
| `specs/001-webcodecs-video-adaptor/` | Spec, plan, research, data model, contracts |
