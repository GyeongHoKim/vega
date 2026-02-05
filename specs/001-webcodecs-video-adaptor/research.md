# Research: Vega Player Verification & Test Strategy

**Feature**: 001-webcodecs-video-adaptor  
**Phase**: 0 (Outline & Research)  
**Date**: 2025-02-06

## 1. Programmatic Verification of Spec in Browser

**Decision**: Use Vitest with browser provider (@vitest/browser-playwright) and real Chromium to run tests that load the Vega player, load MP4 from fixtures (`tests/fixtures/h264.mp4`), and assert observable outcomes (canvas content, playback state, events, optional adaptor output). No headless-jsdom-only path for playback; WebCodecs/Canvas/Web Audio require a real browser.

**Rationale**: The spec requires “video is visible and audio is audible,” “playback state updates correctly,” and “processed output is shown.” These are only verifiable in an environment where decoding and rendering actually run. Vitest already uses Playwright and Chromium; tests can `createVega`, `load(fixtureUrl)`, `play()`, and assert on canvas pixels, `currentTime`, `state`, and event emissions.

**Alternatives considered**: (a) Node + jsdom — rejected because WebCodecs and real Canvas are unavailable. (b) Puppeteer/Playwright standalone scripts — rejected in favor of keeping one test runner (Vitest) and reusing existing browser config. (c) Visual/screenshot regression — optional later; for spec verification, pixel sampling and state/event assertions are sufficient and more stable.

---

## 2. E2E vs Unit Tests and Type I/II Error

**Decision**: Prefer a small number of high-value E2E tests that map directly to spec acceptance scenarios over many unit tests. Each E2E should target one or more “Given/When/Then” scenarios and assert on observable results (e.g. after load+play: canvas has non-zero frame data, `state === 'playing'`, `currentTime` advances). Avoid unit tests that only assert implementation details or trivial getters; keep unit/integration tests for business logic and contracts (e.g. demuxer output, renderer pixel correctness) where they add real value.

**Rationale**: Constitution and user requirement both state that one test that truly verifies a requirement is better than many that do not. Type I (false positive) and type II (false negative) errors are minimized when assertions are tied to spec outcomes (e.g. “video visible”) rather than to internal calls or mocks. Current tests already use real browser and fixtures for renderers; the gap is full-path E2E: load MP4 → play → verify video/audio/state/events.

**Alternatives considered**: (a) Mocking demuxer/worker everywhere — increases risk of passing tests while real playback fails. (b) 100% unit tests — rejected as per constitution and user request. (c) Only manual testing — rejected; programmatic regression is required.

---

## 3. Fixture Usage and Test Data

**Decision**: Use existing `tests/fixtures/h264.mp4` for E2E tests that require full decode/play. Use existing `frame_*.raw` fixtures for renderer and pixel-accurate tests. Serve fixtures via Vite’s static/assets so that in-browser tests can fetch them (e.g. relative URL or `import ... ?url`). Ensure fixture file is committed and CI can access it; document in quickstart/test docs.

**Rationale**: Spec scenarios (“load an MP4 file”, “start playback”) require a real MP4. The repo already contains `h264.mp4` and raw frames; reusing them keeps tests deterministic and avoids external network. Vite/vitest already support `?url` and asset handling for tests.

**Alternatives considered**: (a) External URL — flaky and not reproducible. (b) Generating MP4 in test — heavy and unnecessary for current scope. (c) Skipping E2E when fixture missing — acceptable as a temporary guard, but fixture should be present in repo.

---

## 4. Biome / TypeScript Ignore Audit

**Decision**: Allow exactly two documented suppressions: (1) `src/vega.ts`: `@ts-expect-error` for Vite worker import (`?worker&url`); (2) `src/demuxer/mp4box-types.ts`: `biome-ignore` (and existing eslint-disable) for `noExplicitAny` on external library type definitions. No other files should add biome-ignore or ts-ignore without a documented justification and review. `biome.json` excludes `**/fixtures` from formatting/linting (fixtures are binary or large raw data); this is acceptable and does not exclude source code.

**Rationale**: Code review must ensure no new “escape hatches” are introduced in application code. The two existing suppressions are in boundary code (build-time worker resolution, third-party types) and are justified. Fixtures exclusion is for file type, not for hiding lint issues in code.

**Alternatives considered**: (a) Removing all ignores — would require changing build (worker) or forking mp4box types. (b) Ignoring whole directories for lint — rejected; only specific lines with comments are allowed.

---

## 5. Implementation vs Spec Coverage (Review)

**Decision**: Treat “current implementation vs spec” as a checklist derived from the spec and map each FR / user story to either existing behavior or a test that will verify it. E2E tests will be designed to cover: (1) Load MP4 and play — video visible, audio path exercised, playback state and events. (2) Pause/seek — state and resumption. (3) Custom adaptor — frame passed through, output displayed. (4) Error handling — invalid/unsupported file leads to clear error state. (5) Video-only or audio-only — no requirement for both tracks. Implementation review confirms that `VegaPlayer` implements load/play/pause/seek/adaptor/events; verification is completed by adding E2E that assert on these behaviors in browser.

**Rationale**: Ensures “온전한 구현” (complete implementation) is not assumed but verified by tests that mirror the spec’s acceptance scenarios. Reduces type II error (tests pass but product is wrong) by tying assertions to user-visible outcomes.

**Alternatives considered**: (a) Relying only on code review — insufficient; programmatic tests required. (b) Only testing adaptor in isolation — insufficient; full pipeline must be exercised.

---

## Summary Table

| Topic              | Decision                                                                 | Status   |
|--------------------|--------------------------------------------------------------------------|----------|
| Where to run tests | Real browser (Vitest + Playwright Chromium)                             | Resolved |
| E2E vs unit        | Prefer E2E for spec scenarios; unit for real business/contract logic    | Resolved |
| Fixtures           | Use `tests/fixtures/h264.mp4` and `frame_*.raw`; serve via Vite          | Resolved |
| Ignore audit       | Two allowed suppressions (vega worker, mp4box types); no new ones w/o justification | Resolved |
| Spec coverage      | Map FR/user stories to E2E scenarios; add tests to verify each         | Resolved |

All NEEDS CLARIFICATION items from Technical Context are resolved. Phase 1 (data model, contracts, quickstart) can proceed.

---

## 6. 참고: 다른 비디오 플레이어 테스트 방식

동영상 재생 검증을 어떻게 할지에 대한 상세 조사는 **[video-player-testing-research.md](./video-player-testing-research.md)**에 정리되어 있다. 요약:

- **Video.js**: Karma로 실제 브라우저에서 단위 테스트; 재생 검증은 이벤트/상태 중심.
- **hls.js**: (1) 단위: Karma + ChromeHeadless, MockMediaElement/MediaSource로 로직만 검증. (2) 기능: Selenium + 실제 스트림, `loadeddata` / `currentTime` 증가 / `seeked` / `ended` 등으로 “재생됨” 검증.
- **Vega**: Canvas + WebCodecs이므로 위 패턴에 더해 **Canvas getImageData**로 “프레임이 그려졌다”(비공백 또는 참조 픽셀 비교)를 검증하는 E2E를 추가하는 것이 적합하다.
