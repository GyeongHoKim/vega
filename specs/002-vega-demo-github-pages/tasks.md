# Tasks: Vega Demo Page and GitHub Pages Deployment

**Input**: Design documents from `specs/002-vega-demo-github-pages/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/demo-routing.md

**Tests**: E2E tasks are included per plan and research (meaningful browser-based tests that verify spec scenarios; fixtures in `tests/fixtures/`).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[USn]**: User story (US1 = Play Sample Video/Audio, US2 = Upload MP4, US3 = GitHub Pages)
- Include exact file paths in descriptions

## Path Conventions

- Library: `src/` (existing); Demo app: `examples/` (React + Vite)
- Tests: `tests/integration/`, fixtures: `tests/fixtures/`
- Workflows: `.github/workflows/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Replace HTML example with React+TS+Vite demo scaffold; ensure demo is in quality gate scope.

- [ ] T001 Remove existing HTML example and prepare examples directory: delete `examples/minimal.html` and create `examples/index.html` as the demo app entry
- [ ] T002 [P] Add React 18 and React DOM and TypeScript types to the project (root `package.json` or examples-specific deps) per plan.md
- [ ] T003 Create Vite config for the demo app in `examples/vite.config.ts` (or document second entry in root vite.config.ts) with build output for demo and `base` placeholder for GitHub Pages (e.g. `base: '/vega/'`)
- [ ] T004 [P] Ensure `examples/` is included in Biome and TypeScript scope: update `biome.json` and root `tsconfig.json` (or add `examples/tsconfig.json`) so format, lint, and typecheck cover `examples/**` per research.md §6
- [ ] T005 Create demo app entry and shell: `examples/src/main.tsx` and `examples/src/App.tsx` that render a minimal root (e.g. "Vega Demo" placeholder) and mount to `examples/index.html`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hash routing and sample media available so US1/US2 can implement playback.

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete.

- [ ] T006 Implement hash-based routing per `specs/002-vega-demo-github-pages/contracts/demo-routing.md`: parse `window.location.hash` in `examples/src/App.tsx` (or a small router/hook) and render example selector for `#/` or empty hash and a **placeholder view** for `#/audio-video` (replaced by the real AudioVideoExample in T014)
- [ ] T007 [P] Add sample media for the demo: copy or symlink `tests/fixtures/h264.mp4` into `examples/public/` (e.g. `examples/public/sample.mp4`) and ensure at least one sample video and one sample audio are available (one MP4 with both tracks satisfies FR-002; add separate audio file if needed) per research.md §4
- [ ] T008 Add npm script(s) to build the library then the demo (e.g. `build:demo` or `build && cd examples && npm run build`) so the demo consumes built Vega from `dist/` per research.md §1
- [ ] T009 [P] Create ExampleSelector page component in `examples/src/pages/ExampleSelector.tsx` that lists "Audio & Video" and navigates to `#/audio-video` on click; wire into App so `#/` shows this page

**Checkpoint**: Foundation ready — example selector works; sample media and routing contract in place; user story implementation can begin

---

## Phase 3: User Story 1 - Play Sample Video and Audio (Priority: P1) 🎯 MVP

**Goal**: Visitor opens demo, selects Audio & Video example, and plays built-in sample video and audio with standard controls (play, pause, seek). FR-001, FR-002, FR-004, FR-007.

**Independent Test**: Open demo, go to #/audio-video, start sample video and sample audio; both play with picture/audio; controls work. If sample fails to load, clear message is shown (FR-007).

### E2E for User Story 1

- [ ] T010 [P] [US1] Add E2E test in `tests/integration/demo-audio-video.test.ts` (or existing integration dir): load demo app (dev server or built), navigate to `#/audio-video`, trigger play on sample media, assert playback state (e.g. state === 'playing', currentTime advances) and optionally canvas non-blank; optionally assert that playback can start within 30 seconds of page load (SC-001); use fixtures from `tests/fixtures/` per plan and research.md §5

### Implementation for User Story 1

- [ ] T011 [US1] Create Audio & Video example page in `examples/src/pages/AudioVideoExample.tsx` that mounts a canvas and creates a Vega player instance (createVega from built lib) per `specs/001-webcodecs-video-adaptor/contracts/vega-api.md`; destroy player on unmount
- [ ] T012 [US1] Add UI in `examples/src/pages/AudioVideoExample.tsx` (or subcomponents in `examples/src/components/`) for selecting and playing sample video and sample audio from `examples/public/` (e.g. load(sampleUrl), then play()); show clear error message if sample fails to load (FR-007). Design so a first-time visitor can start playing sample within 30 seconds of opening the page (SC-001).
- [ ] T013 [US1] Add playback controls (play, pause, seek) to the Audio & Video example in `examples/src/components/` or inline in `examples/src/pages/AudioVideoExample.tsx`; wire to Vega instance so FR-004 is satisfied
- [ ] T014 [US1] Wire hash route `#/audio-video` to render AudioVideoExample in `examples/src/App.tsx` (or router) per contracts/demo-routing.md

**Checkpoint**: User Story 1 is fully functional; visitor can play sample video and audio with controls; E2E passes

---

## Phase 4: User Story 2 - Play User-Uploaded MP4 Video (Priority: P2)

**Goal**: Visitor can choose an MP4 file from their device and play it on the same Audio & Video page using the same Vega instance and controls. FR-003, FR-006.

**Independent Test**: On #/audio-video, use upload control to select a local MP4; file is accepted and plays. Selecting an invalid/non-MP4 file shows a clear error and does not break the page (FR-006).

### E2E for User Story 2

- [ ] T015 [P] [US2] Add E2E test in `tests/integration/demo-audio-video.test.ts`: load demo, go to `#/audio-video`, simulate file input with `tests/fixtures/h264.mp4`, trigger load and play, assert playback state and/or canvas; add case for invalid file type and assert error message and page still usable (FR-006)

### Implementation for User Story 2

- [ ] T016 [US2] Add file upload control to the Audio & Video example (e.g. in `examples/src/pages/AudioVideoExample.tsx` or `examples/src/components/UploadControl.tsx`) that accepts MP4; on file select, call player.load(file) per Vega API
- [ ] T017 [US2] Handle load failure and invalid/unsupported file in the demo: listen for Vega `error` event and show clear user-visible message; do not leave player in undefined state (FR-006); allow user to try another file without reload

**Checkpoint**: User Stories 1 and 2 both work; sample play and upload play are independently testable

---

## Phase 5: User Story 3 - Access Demo via GitHub Pages (Priority: P3)

**Goal**: Demo is built and deployed to GitHub Pages so it is publicly accessible at a stable URL. FR-005, SC-003.

**Independent Test**: After deployment, open the published URL; demo loads and sample/upload flows behave as in P1/P2.

### Implementation for User Story 3

- [ ] T018 [US3] Create GitHub Actions workflow in `.github/workflows/deploy-pages.yml`: on push to `main` (or configured branch), checkout repo, setup Node, install deps, build library (`npm run build`), build demo with `base` set for GitHub Pages (e.g. `base: '/vega/'`), upload demo build artifact and deploy to GitHub Pages using `actions/upload-pages-artifact` and `actions/deploy-pages` (or peaceiris/actions-gh-pages) per research.md §3
- [ ] T019 [US3] Document in `specs/002-vega-demo-github-pages/quickstart.md` (or README) how to run the demo locally and how deployment works; ensure `base` and repo name are documented for GitHub Pages URL
- [ ] T020 [US3] **One-time manual step**: In the repository Settings → Pages, set Source to “GitHub Actions” so the workflow from T018 can deploy. The demo is then served at the stable URL (no code change; document in quickstart).

**Checkpoint**: Demo is publicly accessible; visitors can open the URL and use sample + upload flows

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, quality gate, and quickstart validation.

- [ ] T021 [P] Add edge-case handling in the demo: (1) when user uploads a non-MP4 or invalid file, show clear message (FR-006); (2) when sample media fails to load, show clear message (FR-007); (3) when the user uploads a very large file, allow playback within browser limits or show a brief limitation message (spec Edge Cases); (4) when the browser does not support required capabilities (e.g. WebCodecs), show a brief message and degrade gracefully (spec Edge Cases).
- [ ] T022 Run full quality gate on repo including `examples/`: `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`; fix any failures and ensure no new biome/ts ignores in `examples/` or new tests without justification per research.md §6
- [ ] T023 Run quickstart validation: follow `specs/002-vega-demo-github-pages/quickstart.md` (install, build library, run demo, run tests) and confirm steps work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS US1, US2, US3
- **Phase 3 (US1)**: Depends on Phase 2 — MVP
- **Phase 4 (US2)**: Depends on Phase 2 and Phase 3 (same page, extends Audio & Video)
- **Phase 5 (US3)**: Depends on Phase 2; demo should be functional (Phase 3+4) before deploy
- **Phase 6 (Polish)**: Depends on Phase 3–5

### User Story Dependencies

- **US1 (P1)**: After Phase 2; no dependency on US2/US3
- **US2 (P2)**: After Phase 2 and US1 (same Audio & Video page)
- **US3 (P3)**: After Phase 2; deploy artifact is demo app (needs US1 at minimum; US2 recommended)

### Parallel Opportunities

- T002, T004, T005 can run in parallel within Phase 1
- T007, T009 in Phase 2 can run in parallel
- T010 (E2E US1) and T011–T014 (impl US1) — E2E first (T010) then implementation; T011–T013 can be parallelized by component
- T015 (E2E US2) and T016–T017 (impl US2) — E2E first then implementation
- T018, T019 in Phase 5 can be parallelized (workflow vs docs)
- T021, T022 in Phase 6 can run in parallel

---

## Parallel Example: Phase 1

```bash
# After T001, run in parallel:
T002: Add React/React DOM and types to package.json
T004: Ensure examples/ in biome.json and tsconfig
T005: Create examples/src/main.tsx and App.tsx + index.html
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup  
2. Complete Phase 2: Foundational  
3. Complete Phase 3: User Story 1 (E2E T010 then T011–T014)  
4. **STOP and VALIDATE**: Run E2E and manual test for sample play and controls  
5. Optionally deploy a minimal demo (Phase 5 with only US1)

### Incremental Delivery

1. Setup + Foundational → routing and sample media ready  
2. Add US1 → test independently → demo plays samples (MVP)  
3. Add US2 → test independently → demo supports upload  
4. Add US3 → deploy to GitHub Pages → public URL  
5. Polish → edge cases and quality gate

### Notes

- [P] tasks use different files or have no ordering dependency
- [USn] maps to spec.md user stories for traceability
- E2E tests use real browser (Vitest + Playwright) and `tests/fixtures/h264.mp4` per plan
- No new biome-ignore or ts-ignore in examples/ or new tests without documented justification
