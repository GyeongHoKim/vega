# Implementation Plan: Vega Demo Page and GitHub Pages Deployment

**Branch**: `002-vega-demo-github-pages` | **Date**: 2025-02-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/002-vega-demo-github-pages/spec.md`

## Summary

Deliver a single demo application that demonstrates Vega playback: (1) play built-in sample video and audio, (2) play user-uploaded MP4, and (3) be deployable to GitHub Pages for public access. Replace the existing HTML example with a **React + TypeScript + Vite** SPA. Use **hash-based routing** so the first screen lets users choose the example type (e.g. Audio & Video now; custom-adapter or other examples later). Add a **GitHub Action** to build and deploy the demo to GitHub Pages. Verification must be **programmatic and browser-based**: meaningful E2E tests that validate spec scenarios (e.g. load sample or fixture MP4, play, assert observable outcomes) with minimal type I/II error; avoid proliferation of low-value unit tests. Use **real browser** and **fixtures** (`tests/fixtures/`); when reviewing code, ensure **biome/ts are not ignored** without justification.

## Technical Context

**Language/Version**: TypeScript 5.9 (existing); React 18+ for demo app  
**Primary Dependencies**: Vite 7 (build + dev server), React, React DOM; Vega library (local `src/` or built `dist/`); existing: mp4box, @vitest/browser-playwright  
**Storage**: N/A (demo is client-only; upload is in-memory/session)  
**Testing**: Vitest 4 with @vitest/browser-playwright (Chromium). Tests in `tests/**/*.test.ts`; fixtures in `tests/fixtures/` (e.g. h264.mp4). Prefer E2E tests that verify spec outcomes in a real browser over many unit tests.  
**Target Platform**: Modern web browsers (desktop and mobile) supporting WebCodecs, Canvas, Web Audio, and File API  
**Project Type**: Library + demo app (single repo: `src/` = Vega library, `examples/` = React SPA demo)  
**Performance Goals**: Demo loads and starts sample playback within 30 seconds (SC-001); playback and seek responsive (e.g. seek completes within a few hundred ms in normal conditions)  
**Constraints**: GitHub Pages static hosting; no server-side logic; demo must work with repository base path (e.g. `/vega/`)  
**Scale/Scope**: One demo SPA, 2+ example "routes" (Audio & Video now; more later)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify alignment with `.specify/memory/constitution.md`:

- **Code Quality**: **PASS**. Project has `npm run format`, `npm run lint`, `npm run typecheck` (Biome + tsc). Demo app and new code MUST be included in these gates; no new biome/ts ignores without documented justification. Plan requires running quality gate after modifications.
- **Testing Standards**: **PASS**. Strategy: meaningful tests first; prefer E2E in real browser that verify spec scenarios (sample play, upload MP4, play, controls). No mandate for trivial unit tests. Use fixtures (`tests/fixtures/h264.mp4`); tests must actually catch regressions (minimize type I/II errors).
- **User Experience Consistency**: **PASS**. Demo must use Vega's public API per `specs/001-webcodecs-video-adaptor/contracts/vega-api.md`; errors and messaging consistent with FR-006, FR-007. Hash routing and example selector are documented and consistent.
- **Quality Gates**: Implementation workflow includes running the code quality gate after modifications; CI (and new GitHub Pages workflow) run format/lint/typecheck and tests.

## Project Structure

### Documentation (this feature)

```text
specs/002-vega-demo-github-pages/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (demo routing, optional demo–vega usage)
└── tasks.md             # Phase 2 output (/speckit.tasks – not created by /speckit.plan)
```

### Source Code (repository root)

```text
src/                     # Vega library (existing)
├── index.ts
├── vega.ts
├── audio/
├── demuxer/
├── renderers/
├── types/
└── worker/

examples/                 # React + TypeScript + Vite demo app (replaces minimal.html)
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/            # e.g. ExampleSelector, AudioVideoExample
│   ├── components/       # Player, controls, upload, error message
│   └── hooks/            # optional: useVega, useHashRoute
├── public/               # optional: sample media or assets
└── vite.config.ts        # or root vite config with multi-app/build entry

tests/
├── fixtures/             # h264.mp4, frame_*.raw (existing)
├── integration/          # E2E: vega-playback.test.ts, demo E2E
└── (unit/ if needed for business logic only)

.github/
├── workflows/
│   ├── ci.yml            # existing: format, lint, typecheck, test
│   └── deploy-pages.yml  # new: build demo + deploy to GitHub Pages
```

**Structure Decision**: Keep the library in `src/` unchanged. Replace `examples/minimal.html` with a React SPA under `examples/` (or a single Vite config that builds both library and demo). Demo is a separate Vite app or a second entry so that it can use `base: '/vega/'` (or repo name) for GitHub Pages. Hash routing is implemented so the first screen is the example selector and `#/audio-video` (or similar) shows the Audio & Video playback example; future examples get their own hash routes.

## Complexity Tracking

No constitution violations. This section is intentionally empty.
