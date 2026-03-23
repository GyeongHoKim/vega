# Tasks: Multi-Kind Media Load Inputs (Mediabunny Migration)

**Input**: Design documents from `/specs/002-multi-input-types/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/vega-api.ts, quickstart.md

**Tests**: Existing E2E tests will be updated for the new API. No new test files created — per user guidance, mediabunny internals are out of scope and only existing test passage is the goal.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Swap dependencies and clean build configuration

- [ ] T001 Replace `mp4box` with `mediabunny` in package.json and run `npm install`
- [ ] T002 Remove `optimizeDeps.exclude: ["mp4box"]` and worker entry config from vite.config.ts

---

## Phase 2: Foundational (Delete Legacy Code + New Type Definitions)

**Purpose**: Remove all MP4Box.js and worker-related code, define new type foundations

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 [P] Delete src/worker/media-worker.ts and src/worker/video-renderer.ts (entire src/worker/ directory)
- [ ] T004 [P] Delete src/demuxer/mp4-demuxer.ts and src/demuxer/mp4box-types.ts (entire src/demuxer/ directory)
- [ ] T005 [P] Delete src/mp4box.d.ts
- [ ] T006 [P] Delete src/types/worker-messages.ts
- [ ] T007 [P] Delete src/audio/audio-renderer.ts, src/audio/audio-worklet-processor.ts, and src/audio/ring-buffer.ts (entire src/audio/ directory)
- [ ] T008 Update src/types/vega.ts: add `MediaInput` type, replace `VideoFrameAdapter`/`setAdapter`/`getAdapter` with `pipeThrough`/`clearPipeline`, add `codedWidth`/`codedHeight`/`rotation` to `VideoTrackInfo`, remove `isFragmented`/`brands` from `MediaInfo`, add `formats` to `VegaOptions` — per contracts/vega-api.ts
- [ ] T009 Create src/input/ directory and src/input/create-source.ts with `createSource(input: MediaInput): Source` skeleton — switch on typeof/instanceof returning the correct mediabunny Source subclass (BlobSource, BufferSource, UrlSource, ReadableStreamSource, or Source pass-through)

**Checkpoint**: Legacy code removed, new types defined, source factory scaffolded — implementation can begin

---

## Phase 3: User Story 1 — Load from File/Blob/ArrayBuffer/Uint8Array (Priority: P1) 🎯 MVP

**Goal**: Rewrite VegaPlayer to use mediabunny for demux/decode. Support loading from File, Blob, ArrayBuffer, and Uint8Array (the most common browser binary shapes).

**Independent Test**: Load `tests/fixtures/h264.mp4` as File, Blob, ArrayBuffer, and Uint8Array — verify metadata loads and playback starts for each.

### Implementation for User Story 1

- [ ] T010 [US1] Implement BlobSource and BufferSource branches in src/input/create-source.ts — File/Blob → `new BlobSource(blob)`, ArrayBuffer/ArrayBufferView → `new BufferSource(buffer)`
- [ ] T011 [US1] Rewrite load() in src/vega.ts: remove Worker creation, use `createSource()` + mediabunny `Input({ formats, source })`, extract `getPrimaryVideoTrack()` and `getPrimaryAudioTrack()`, build `MediaInfo` from `InputVideoTrack`/`InputAudioTrack` metadata (codec string via `getCodecParameterString()`, dimensions, frame rate via `computePacketStats()`, rotation), create `VideoSampleSink`, emit `loadedmetadata`/`canplay`
- [ ] T012 [US1] Implement playback loop in src/vega.ts: `requestAnimationFrame` loop calling `videoSampleSink.getSample(currentTime)`, skip if same timestamp as last render, draw `VideoSample` to renderer via `sample.draw()` or by obtaining `VideoFrame`, manage `lastRenderedTimestamp` tracking
- [ ] T013 [US1] Implement seek in src/vega.ts: pause rAF loop → `videoSampleSink.getSample(targetTime)` → render frame → update currentTime → resume if was playing → emit `seeking`/`seeked`
- [ ] T014 [US1] Implement pipeThrough()/clearPipeline() in src/vega.ts: maintain `pipeline: TransformStream[]` array, in render loop push frame through chained transforms before drawing, handle transform errors by emitting `ADAPTER_ERROR`
- [ ] T015 [US1] Implement play()/pause()/stop()/destroy() in src/vega.ts: play starts rAF loop + updates clock, pause stops loop + snapshots currentTime, stop resets to 0 + pauses, destroy calls `input.dispose()` + clears all resources
- [ ] T016 [US1] Implement ended detection in src/vega.ts: in rAF loop, when currentTime >= duration emit `ended`, handle loop option by reloading from `_lastSource`
- [ ] T017 [US1] Update src/index.ts: export new types (`MediaInput`), remove `VideoFrameAdapter` export, keep all other existing exports unchanged
- [ ] T018 [US1] Update adapter tests in tests/integration/vega-playback.test.ts: rewrite `identityAdapter` to identity `TransformStream`, rewrite `setAdapter(identity)` to `pipeThrough(identity)`, rewrite throwing adapter to erroring `TransformStream`, update `getAdapter()` references to use pipeline state assertions
- [ ] T019 [US1] Run quality gate: `npm run format && npm run lint && npm run typecheck && npm test` — fix any failures

**Checkpoint**: Vega plays MP4 from URL string (backward compat), File, Blob, ArrayBuffer, Uint8Array. All existing tests updated and passing. Core mediabunny migration complete.

---

## Phase 4: User Story 2 — Load from URL string/URL object (Priority: P2)

**Goal**: Support `URL` object as a load input in addition to the existing URL string support.

**Independent Test**: Load `tests/fixtures/h264.mp4` via a URL string and via `new URL(...)` — verify equivalent metadata and playback readiness.

### Implementation for User Story 2

- [ ] T020 [US2] Implement UrlSource branch in src/input/create-source.ts: `string` → `new UrlSource(input)`, `URL` → `new UrlSource(input)` (mediabunny's UrlSource constructor accepts both `string | URL | Request`)
- [ ] T021 [US2] Verify backward compatibility: run existing test `loads fixture MP4, play()` which uses URL string — must pass without modification
- [ ] T022 [US2] Run quality gate: `npm run format && npm run lint && npm run typecheck && npm test`

**Checkpoint**: URL string and URL object both work. Existing URL-based tests pass unmodified.

---

## Phase 5: User Story 3 — Load from ReadableStream (Priority: P3)

**Goal**: Support `ReadableStream<Uint8Array>` as a load input for streaming/progressive delivery use cases.

**Independent Test**: Convert `tests/fixtures/h264.mp4` bytes into a `ReadableStream`, load into player — verify metadata loads and playback can start.

### Implementation for User Story 3

- [ ] T023 [US3] Implement ReadableStreamSource branch in src/input/create-source.ts: `ReadableStream` → `new ReadableStreamSource(stream)`
- [ ] T024 [US3] Run quality gate: `npm run format && npm run lint && npm run typecheck && npm test`

**Checkpoint**: All four input categories (File/Blob/Buffer, URL, ReadableStream) functional. Full FR-001 through FR-008 coverage.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, tree-shaking verification, final quality pass

- [ ] T025 [P] Update README.md: replace old API examples with new `MediaInput` load signatures, replace adapter examples with `pipeThrough` examples, update architecture diagram, note mediabunny dependency
- [ ] T026 [P] Verify tree shaking: build with `npm run build`, inspect dist/ output to confirm only used mediabunny modules (Input, MP4, BlobSource, BufferSource, UrlSource, ReadableStreamSource, VideoSampleSink, Source) are bundled
- [ ] T027 Run final quality gate: `npm run format && npm run lint && npm run typecheck && npm test`
- [ ] T028 Validate quickstart.md code examples compile and match actual API signatures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — core MVP implementation
- **User Story 2 (Phase 4)**: Depends on Phase 3 (VegaPlayer rewrite must be done)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (VegaPlayer rewrite must be done)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 — this IS the core migration, all other stories build on it
- **US2 (P2)**: Depends on US1 (needs the rewritten VegaPlayer) — adds UrlSource branch
- **US3 (P3)**: Depends on US1 (needs the rewritten VegaPlayer) — adds ReadableStreamSource branch
- **US2 and US3 can run in parallel** after US1 completes (they modify different branches in the same file but are independent features)

### Within Each User Story

- Types/interfaces before implementation
- Source factory before VegaPlayer
- Core flow (load) before secondary flows (play, seek, pipeline)
- Implementation before test updates
- Quality gate at end of each story

### Parallel Opportunities

- Phase 2: T003–T007 can all run in parallel (deleting independent files/directories)
- Phase 3: T010 and T011 can overlap (different files: create-source.ts vs vega.ts)
- Phase 4 and Phase 5: Can run in parallel after Phase 3 completes
- Phase 6: T025 and T026 can run in parallel

---

## Parallel Example: Phase 2 (Delete Legacy)

```bash
# All deletions are independent — launch in parallel:
Task T003: "Delete src/worker/ directory"
Task T004: "Delete src/demuxer/ directory"
Task T005: "Delete src/mp4box.d.ts"
Task T006: "Delete src/types/worker-messages.ts"
Task T007: "Delete src/audio/ directory"
```

## Parallel Example: User Story 1

```bash
# Source factory and VegaPlayer core can overlap:
Task T010: "Implement BlobSource/BufferSource in src/input/create-source.ts"
Task T011: "Rewrite load() in src/vega.ts"  # depends on T010 being at least scaffolded

# After core load works, these can overlap:
Task T012: "Implement playback loop in src/vega.ts"
Task T014: "Implement pipeThrough/clearPipeline in src/vega.ts"  # same file but different methods
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (swap deps, clean config)
2. Complete Phase 2: Foundational (delete legacy, define types)
3. Complete Phase 3: User Story 1 (full VegaPlayer rewrite)
4. **STOP and VALIDATE**: Run all tests — player loads from File/Blob/ArrayBuffer/Uint8Array, plays, seeks, supports pipeThrough pipeline
5. This is deployable as MVP

### Incremental Delivery

1. Phase 1 + 2 → Clean codebase ready for mediabunny
2. Phase 3 (US1) → Core migration done, File/Blob/Buffer loading works → **MVP!**
3. Phase 4 (US2) → URL string + URL object loading works → backward compat verified
4. Phase 5 (US3) → ReadableStream loading works → full spec coverage
5. Phase 6 → Documentation, tree-shaking, polish

### Single Developer Strategy (Recommended)

Since this is a library migration, sequential execution in priority order is recommended:

1. Phase 1 → Phase 2 → Phase 3 (US1 MVP) → validate
2. Phase 4 (US2) → validate
3. Phase 5 (US3) → validate
4. Phase 6 → final quality gate

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US2 and US3 are lightweight additions (single branch in create-source.ts) after the US1 core migration
- The bulk of implementation effort is in Phase 3 (US1) which rewrites VegaPlayer
- `src/vite-env.d.ts` may need the worker URL import type removed after T003
- mediabunny `Source` pass-through support (for advanced users) is included in T009's createSource scaffold
- **Edge-case error paths out of scope**: Spec edge cases (invalid URL/404/CORS, ReadableStream mid-read error, empty ArrayBuffer, unsupported codec for new input types) are not covered by dedicated verification tasks. Per user guidance, only existing tests must pass post-migration. mediabunny surfaces errors internally for all source types; Vega propagates them via the existing error event/state pattern. Future work may add explicit error-path E2E tests per input type if regressions appear.
