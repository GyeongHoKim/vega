# Implementation Plan: Vega MP4 Video Player with Custom Frame Processing

**Branch**: `001-webcodecs-video-adaptor` | **Date**: 2025-02-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-webcodecs-video-adaptor/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver a WebCodecs-based MP4 player that plays video/audio to canvas and speakers by default, supports an optional user-provided VideoFrame adaptor for custom processing, and exposes a stable API for load/play/pause/seek and lifecycle events. Verification must be programmatic and browser-based: meaningful E2E tests that validate spec scenarios (e.g. load MP4 from fixtures, play, assert video visible and behavior correct) with minimal type I/II error risk; avoid proliferation of low-value unit tests.

## Technical Context

**Language/Version**: TypeScript 5.9 (ES2020, NodeNext)  
**Primary Dependencies**: Vite 7, mp4box (demux), WebCodecs/Canvas/Web Audio (browser APIs)  
**Storage**: N/A (in-memory decoding; source from URL/File/Blob)  
**Testing**: Vitest 4 with @vitest/browser-playwright (Chromium, headless). Tests in `tests/**/*.test.ts`; fixtures in `tests/fixtures/` (h264.mp4, *.raw). Strategy: prefer E2E tests that verify spec outcomes in a real browser over many unit tests.  
**Target Platform**: Web browser only (Chrome/Chromium primary; WebCodecs, Canvas, Web Audio; optional WebGL/WebGPU renderers)  
**Project Type**: Single library (src/ + tests/)  
**Performance Goals**: Smooth playback at typical resolution/frame rate; minimal added latency for adaptor (e.g. one frame).  
**Constraints**: Must run in browser; no Node-only or server-side playback path.  
**Scale/Scope**: Single package; one feature branch; full playback + adaptor API surface covered by spec.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify alignment with `.specify/memory/constitution.md`:

- **Code Quality**: **PASS**. Project has `npm run format`, `npm run lint`, `npm run typecheck` (Biome + tsc). Plan requires running quality gate after modifications. Audit: `biome.json` excludes `fixtures` (binary/raw files); one justified `biome-ignore` in `src/demuxer/mp4box-types.ts` (external types); one `@ts-expect-error` in `src/vega.ts` for Vite worker import—both documented.
- **Testing Standards**: **PASS**. Strategy: meaningful tests first; prefer E2E in real browser that verify spec scenarios (load MP4, play, video/audio behavior). No mandate for trivial unit tests. Current tests are renderer-level integration; plan adds E2E that load fixtures (e.g. h264.mp4) and assert observable outcomes to reduce type I/II errors.
- **User Experience Consistency**: **PASS**. Public API in `src/types/vega.ts`; naming and error codes (VegaErrorCode) are consistent; breaking changes require justification and docs.
- **Quality Gates**: **PASS**. Workflow: format → lint → typecheck → test after code changes.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── vega.ts           # VegaPlayer, createVega
├── index.ts
├── factory.ts
├── convert.ts
├── types/
│   ├── index.ts
│   ├── vega.ts       # Public API types
│   └── worker-messages.ts
├── worker/
│   ├── media-worker.ts
│   └── video-renderer.ts
├── renderers/
│   ├── renderer-2d.ts
│   ├── renderer-webgl.ts
│   └── renderer-webgpu.ts
├── audio/
│   ├── audio-renderer.ts
│   ├── audio-worklet-processor.ts
│   └── ring-buffer.ts
└── demuxer/
    ├── mp4-demuxer.ts
    └── mp4box-types.ts

tests/
├── fixtures/         # h264.mp4, frame_*.raw
└── integration/
    ├── renderer-2d.test.ts
    ├── renderer-webgl.test.ts
    └── renderer-webgpu.test.ts
```

**Structure Decision**: Single library (Option 1). No backend/frontend split. E2E tests will live under `tests/` (e.g. `tests/e2e/` or additional `tests/integration/` specs) and run in browser via Vitest + Playwright.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
