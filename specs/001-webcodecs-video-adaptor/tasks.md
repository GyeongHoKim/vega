# Tasks: Vega MP4 Video Player with Custom Frame Processing

**Input**: Design documents from `/specs/001-webcodecs-video-adaptor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: E2E tests are required per spec (Independent Test for each story) and plan (meaningful browser-based verification). Tasks include E2E tests that map to acceptance scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and verification.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root (per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure project structure and test environment are ready for E2E verification.

- [x] T001 Verify project structure per plan.md (src/vega.ts, worker/, renderers/, audio/, demuxer/, types/, tests/fixtures/)
- [x] T002 [P] Ensure tests/fixtures/h264.mp4 exists and vitest.config.ts browser provider (Playwright Chromium) runs tests in browser
- [x] T003 [P] Add fixture URL helper or use import for h264.mp4 in tests (e.g. tests/fixtures/h264.mp4?url or serve from public) so E2E can load it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: E2E test harness and behavior that all user story verifications depend on.

**⚠️ CRITICAL**: No user story E2E can reliably run until fixture loading and player creation in browser are confirmed.

- [x] T004 Create E2E test file tests/integration/vega-playback.test.ts (or tests/e2e/vega-playback.test.ts) with describe block and minimal createVega + canvas setup runnable in Vitest browser
- [x] T005 Ensure invalid or unsupported input in load() results in rejected promise or error event and state === 'error' (FR-006) in src/vega.ts or worker flow

**Checkpoint**: E2E file exists and can create player in browser; invalid file produces clear error. User story E2E can now be added.

---

## Phase 3: User Story 1 - Play MP4 with Default Output (Priority: P1) 🎯 MVP

**Goal**: Load an MP4 file and have video and audio play to display and speakers without custom processing; user can pause/seek and resume.

**Independent Test**: Load MP4 (e.g. tests/fixtures/h264.mp4), start playback, verify video appears on canvas and state/events; pause then seek then resume and verify.

### Tests for User Story 1

- [x] T006 [US1] E2E: load fixture MP4, play(), assert loadedmetadata/canplay then state === 'playing' and currentTime advances after short delay in tests/integration/vega-playback.test.ts
- [x] T007 [US1] E2E: after load+play, assert canvas has non-zero pixel data (getImageData) to verify frame was drawn in tests/integration/vega-playback.test.ts
- [x] T008 [US1] E2E: pause() then assert state === 'paused' and currentTime stable; seek(t) then assert seeked event and currentTime near t; play() then assert state === 'playing' in tests/integration/vega-playback.test.ts

**FR-007 (sync)**: T006 and T008 together provide the intended evidence for video/audio sync: advancing `currentTime` with `state === 'playing'` and frames drawn (T007) implies decode/render pipeline is running; seek then play (T008) verifies resumption from new position. No separate sync assertion is required unless product adds explicit A/V drift checks.

### Implementation for User Story 1

- [x] T009 [US1] Fix any implementation gap so playback can begin within a few seconds of load (SC-001) and pause/seek/resume work per spec in src/vega.ts or worker

**Checkpoint**: User Story 1 is fully verifiable: load MP4 → play → video on canvas, state/events correct; pause/seek/resume work.

---

## Phase 4: User Story 2 - Apply Custom Frame Processing (Priority: P2)

**Goal**: User can pass a frame processor; each decoded frame is transformed before display; playback continues with processed output.

**Independent Test**: Provide identity (or simple) processor, run playback, verify playback runs and processed output is shown.

### Tests for User Story 2

- [x] T010 [P] [US2] E2E: createVega with identity adapter (process(frame) => frame), load fixture MP4, play(), assert state and currentTime advance and canvas non-empty in tests/integration/vega-playback.test.ts
- [x] T011 [US2] E2E: setAdapter(identity) after load, play(), assert playback and canvas updated (processor output displayed) in tests/integration/vega-playback.test.ts
- [x] T012 [US2] E2E or unit: when adapter throws or returns invalid output, assert playback does not crash and error is surfaced (e.g. error event or skip frame) per edge case in tests/integration/vega-playback.test.ts or tests/integration/vega-adapter.test.ts

### Implementation for User Story 2

- [x] T013 [US2] Ensure every decoded frame is passed through adapter before display and adapter output is used for rendering (FR-008) in src/vega.ts / worker; handle adapter errors without crashing in src/vega.ts

**Checkpoint**: User Story 2 is verifiable: identity adapter works; adapter output is shown; adapter errors do not crash playback.

---

## Phase 5: User Story 3 - Integrate Player with Custom Output (Priority: P3)

**Goal**: Player can be used in an application with default behavior or with custom processor; decoding and timing are reliable.

**Independent Test**: Integrate player in minimal host page; confirm default output works and custom processor can be attached.

### Tests for User Story 3

- [x] T014 [US3] E2E: in-browser test that creates player with default options, load+play, assert video and audio path (no error); then setAdapter(identity), assert playback continues in tests/integration/vega-playback.test.ts or tests/integration/vega-integration.test.ts
- [x] T015 [US3] Add or update minimal integration example (e.g. README snippet or examples/minimal.html) showing createVega, load, play, setAdapter per quickstart.md and contracts/vega-api.md

### Implementation for User Story 3

- [x] T016 [US3] No extra implementation required if US1/US2 pass; otherwise fix API consistency for embedding (createVega, load, play, setAdapter) in src/vega.ts and src/index.ts exports

**Checkpoint**: User Story 3 is verifiable: default and custom processor both work when embedded; docs/example available.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, and documentation validation.

- [x] T017 [P] E2E: load invalid or unsupported file (e.g. non-MP4 or corrupt), assert error event and state === 'error' and user-visible message (FR-006, SC-005) in tests/integration/vega-playback.test.ts
- [x] T018 [P] Document or add E2E for video-only / audio-only MP4 if supported (edge case: play available track(s) only) in specs or tests/integration/vega-playback.test.ts
- [x] T019 Run quality gate (npm run format, lint, typecheck, test) and fix any failures
- [x] T020 Validate quickstart.md steps (install, test, build, usage snippet) and update if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story E2E.
- **Phase 3 (US1)**: Depends on Phase 2 — MVP; must pass before demo.
- **Phase 4 (US2)**: Depends on Phase 2; can overlap with US1 completion (E2E for adapter build on same harness).
- **Phase 5 (US3)**: Depends on Phase 2; integration test can run after US1/US2 E2E exist.
- **Phase 6 (Polish)**: Depends on Phase 3–5 being done (or in parallel for T017/T018).

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2/US3. Delivers play/pause/seek with default output.
- **User Story 2 (P2)**: After Foundational — depends on player load/play (US1) for adapter E2E; can be implemented in parallel with US1 test completion.
- **User Story 3 (P3)**: After Foundational — uses same player API; integration test and example can follow US1/US2.

### Within Each User Story

- E2E tests (T006–T008, T010–T012, T014) define acceptance; implementation tasks (T009, T013, T016) fix gaps if any.
- Run tests after implementation; ensure 1st/2nd type errors are minimized (research.md).

### Parallel Opportunities

- T002 and T003 can run in parallel (Phase 1).
- T010 and T011 can run in parallel with other US2 test edits (same file but different test cases).
- T017, T018, T019 can run in parallel in Phase 6.
- Different phases can be staffed in sequence; within a phase, one developer can own the file while another prepares the next phase.

---

## Parallel Example: User Story 1

```text
# After Phase 2, add in order (same file):
T006: E2E load+play+state+currentTime
T007: E2E canvas getImageData non-zero
T008: E2E pause/seek/resume
T009: Fix any US1 implementation gap
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003).
2. Complete Phase 2: Foundational (T004–T005).
3. Complete Phase 3: User Story 1 (T006–T009).
4. **STOP and VALIDATE**: Run `npm run test`; confirm load MP4 → play → video on canvas, pause/seek work.
5. Demo or handoff.

### Incremental Delivery

1. Setup + Foundational → E2E harness and error behavior ready.
2. Add User Story 1 E2E and fixes → Validate independently (MVP).
3. Add User Story 2 E2E and adapter behavior → Validate independently.
4. Add User Story 3 integration test and example → Validate independently.
5. Polish (invalid file, video-only/audio-only, docs) → Full spec coverage.

### Test-First Alignment

- Research and plan require E2E that **really** verify spec (minimize type I/II error).
- Write E2E tasks first per phase; implementation tasks (T009, T013, T016) are for gaps only.
- Prefer one strong E2E per scenario over many weak unit tests.

---

## Notes

- [P] tasks = different files or independent test cases, no ordering dependency.
- [Story] label maps task to user story for traceability.
- All paths are relative to repository root; `tests/integration/` may be used for E2E (plan allows `tests/e2e/` as alternative).
- Commit after each task or logical group; run format/lint/typecheck/test before marking complete.
- Fixture: use existing `tests/fixtures/h264.mp4`; do not add new ignores (biome/ts) without justification (research.md).
