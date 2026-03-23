# Implementation Plan: Multi-Kind Media Load Inputs (Mediabunny Migration)

**Branch**: `002-multi-input-types` | **Date**: 2025-03-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-multi-input-types/spec.md`

## Summary

Migrate Vega's internal demux/decode pipeline from **MP4Box.js + custom Worker** to **mediabunny**, a zero-dependency media toolkit that natively supports the four input source types required by the spec: Blob/File, ArrayBuffer/Uint8Array, URL, and ReadableStream. The migration also modernizes the adapter API from a callback-based `VideoFrameAdapter` to a Streams API-aligned `pipeThrough(TransformStream)` interface, and eliminates the worker thread layer entirely since mediabunny encapsulates its own optimized pipeline.

## Technical Context

**Language/Version**: TypeScript 5.9, ESM  
**Primary Dependencies**: mediabunny (replacing mp4box ^0.5.4), Vite 7.3  
**Storage**: N/A  
**Testing**: Vitest 4 + @vitest/browser-playwright (Chromium)  
**Target Platform**: Browser (requires WebCodecs API)  
**Project Type**: Library (npm package `@gyeonghokim/vega`)  
**Performance Goals**: Real-time video playback at source frame rate (typically 24–60 fps)  
**Constraints**: Main thread rendering via requestAnimationFrame; no SharedArrayBuffer requirement  
**Scale/Scope**: ~1200 LOC source, 4 test files, single npm package

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Code Quality** | ✅ PASS | `biome format`, `biome lint`, `tsc --noEmit` are configured via `npm run format`, `npm run lint`, `npm run typecheck`. Will be run after all changes. |
| **II. Testing Standards** | ✅ PASS | Existing E2E tests cover user-facing outcomes (load, play, pause, seek, adapter, error). Tests will be updated for new `pipeThrough` API. Per user guidance, mediabunny internals are not in test scope — only existing test pass-through is required. |
| **III. User Experience Consistency** | ✅ PASS | `load()` signature is extended (backward compatible for string/File/Blob). `setAdapter`/`getAdapter` is replaced by `pipeThrough`/`clearPipeline` — intentional API modernization documented in research.md. Error handling patterns remain consistent. |

**Post-Phase 1 Re-check**: Will verify after contracts are finalized.

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-input-types/
├── plan.md              # This file
├── research.md          # Phase 0 output — mediabunny analysis and migration decisions
├── data-model.md        # Phase 1 output — updated entity and type definitions
├── quickstart.md        # Phase 1 output — migration guide and usage examples
├── contracts/           # Phase 1 output — public API TypeScript interfaces
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── index.ts              # Public exports (updated)
├── vega.ts               # VegaPlayer — refactored to use mediabunny (no worker)
├── input/
│   └── create-source.ts  # MediaInput → mediabunny Source factory
├── types/
│   ├── index.ts          # VideoRenderer, RendererType (unchanged)
│   └── vega.ts           # Public types: Vega, VegaOptions, MediaInfo (updated)
├── renderers/
│   ├── renderer-2d.ts    # Unchanged
│   ├── renderer-webgl.ts # Unchanged
│   └── renderer-webgpu.ts# Unchanged
├── factory.ts            # Unchanged
└── convert.ts            # Unchanged

tests/
└── integration/
    ├── vega-playback.test.ts  # Updated for pipeThrough API
    ├── renderer-2d.test.ts    # Unchanged
    ├── renderer-webgl.test.ts # Unchanged
    └── renderer-webgpu.test.ts# Unchanged
```

**Deleted paths** (all MP4Box.js and worker-related code):
- `src/worker/` (entire directory)
- `src/demuxer/` (entire directory)
- `src/mp4box.d.ts`
- `src/types/worker-messages.ts`
- `src/audio/` (entire directory — never wired, will be rebuilt on mediabunny when audio is implemented)

**Structure Decision**: Single-project library layout. The `src/input/` directory is added to isolate the source-mapping logic. Renderers and convert utilities remain unchanged since they operate on `VideoFrame` objects regardless of decode pipeline.

## Architecture

### Post-Migration Pipeline

```
User Input                     Mediabunny Layer                 Vega Rendering
───────────                    ────────────────                 ──────────────
MediaInput ──→ createSource() ──→ Input<Source>
                                   │
                                   ├─→ getPrimaryVideoTrack()
                                   │     └─→ VideoSampleSink
                                   │           ├─ getSample(t) ─→ VideoSample
                                   │           └─ samples() ────→ AsyncGenerator<VideoSample>
                                   │                                    │
                                   │                    ┌───────────────┘
                                   │                    ↓
                                   │           TransformStream pipeline (optional)
                                   │                    │
                                   │                    ↓
                                   │           renderer.draw(VideoFrame)
                                   │
                                   └─→ getPrimaryAudioTrack()
                                         └─→ AudioBufferSink (future)
```

### Playback Loop (Main Thread)

```
requestAnimationFrame loop:
  1. currentTime = elapsed from playbackStartTime
  2. videoSample = await videoSampleSink.getSample(currentTime)
  3. if (sample && sample !== lastRenderedSample):
       frame = sample.toVideoFrame() or use sample directly
       if pipeline: push frame through TransformStream chain
       renderer.draw(frame)
       frame.close()
  4. emit 'timeupdate'
```

### Seek Flow

```
seek(targetTime):
  1. Pause rAF loop
  2. videoSample = await videoSampleSink.getSample(targetTime)
  3. Render sample to canvas
  4. Update currentTime = targetTime
  5. Resume rAF loop if was playing
```

### Load Flow

```
load(input: MediaInput):
  1. Dispose previous Input if any
  2. source = createSource(input)  // maps to BlobSource/BufferSource/UrlSource/ReadableStreamSource
  3. this.input = new Input({ formats: [MP4], source })
  4. videoTrack = await input.getPrimaryVideoTrack()
  5. audioTrack = await input.getPrimaryAudioTrack()
  6. Build MediaInfo from track metadata
  7. this.videoSampleSink = new VideoSampleSink(videoTrack)
  8. state = 'ready', emit 'loadedmetadata', 'canplay'
```

## Phases

### Phase 1: Core Migration (MP4Box → Mediabunny)

**Goal**: Replace all MP4Box.js + Worker logic with mediabunny. Achieve functional parity for URL and Blob/File loading.

1. Add `mediabunny` dependency, remove `mp4box`
2. Create `src/input/create-source.ts` — maps `MediaInput` to mediabunny `Source`
3. Rewrite `src/vega.ts`:
   - Remove worker creation and message handling
   - Use `Input` + `VideoSampleSink` for demux/decode
   - Implement rAF-based playback using `getSample()`
   - Implement seek using `getSample(targetTime)`
4. Update `src/types/vega.ts`:
   - Extend `load()` signature with `MediaInput`
   - Replace `VideoFrameAdapter` / `setAdapter` / `getAdapter` with `pipeThrough` / `clearPipeline`
   - Simplify `MediaInfo` (remove `isFragmented`, `brands`)
5. Update `src/index.ts` exports
6. Delete all MP4Box.js and worker files
7. Update `vite.config.ts` (remove worker/mp4box config)
8. Update `package.json` dependencies

### Phase 2: Test Migration

**Goal**: Update existing tests for new API; ensure all pass.

1. Update adapter tests to use `pipeThrough` with TransformStream
2. Verify all other tests pass without modification
3. Run full quality gate: format, lint, typecheck, test

### Phase 3: Cleanup & Documentation

**Goal**: Final polish and documentation.

1. Update README.md with new API examples
2. Verify tree shaking — only needed mediabunny modules bundled
3. Final quality gate run

## Complexity Tracking

| Aspect | Complexity | Notes |
|---|---|---|
| Worker removal | Low | Simplification — fewer moving parts |
| Adapter → pipeThrough | Medium | API surface change; test updates needed |
| Input source mapping | Low | Thin wrapper: switch on instanceof/typeof |
| Playback loop rewrite | Medium | Core logic change but conceptually simpler |
| Test ordering (Constitution II) | Low | Tests are updated **after** implementation rather than written first. Justified: this is a migration — existing E2E tests are the acceptance criteria and are "selected" per Constitution II wording. New API types must exist before adapter tests can be rewritten to `pipeThrough`. User explicitly scoped testing to existing-test passage only. |
