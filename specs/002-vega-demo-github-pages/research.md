# Research: Vega Demo App (React + Vite) and GitHub Pages

**Feature**: 002-vega-demo-github-pages  
**Phase**: 0 (Outline & Research)  
**Date**: 2025-02-06

## 1. React + TypeScript + Vite Demo Application

**Decision**: Replace `examples/minimal.html` with a React 18 + TypeScript + Vite SPA under `examples/`. The demo app will have its own entry (`examples/index.html`, `examples/src/main.tsx`) and either (a) a dedicated Vite config in `examples/vite.config.ts` that builds the SPA and uses the parent workspace Vega build (`../dist/vega.js`) or (b) the root `vite.config.ts` extended with a second build entry / separate config for the demo. Prefer (a) for clear separation: `examples/` is a consumer app that imports Vega from the built library so that the same artifact is used locally and on GitHub Pages.

**Rationale**: Spec requires a single demo page that plays sample video/audio and user-uploaded MP4; the user explicitly requested React + TypeScript + Vite. A dedicated app in `examples/` keeps the library build (`src/` → `dist/`) unchanged and avoids mixing library and app concerns in one config. Vite is already the project bundler; adding React and a second build target is standard.

**Alternatives considered**: (b) Single root Vite config with multiple entries — possible but more complex and couples lib and demo build. (c) Keep HTML + vanilla JS — rejected per user request for React + TS + Vite.

---

## 2. Hash-Based Routing for Example Selection

**Decision**: Use hash-based routing (e.g. `#/`, `#/audio-video`) so the first screen is an example selector and each example (e.g. “Audio & Video”) has a dedicated hash route. No React Router dependency required: parse `window.location.hash` (e.g. `#/audio-video` → render `AudioVideoExample`); update hash on navigation so the app is a single-page app and works on GitHub Pages without server-side routing. Route list is extensible (e.g. later `#/custom-adapter`).

**Rationale**: User requested “첫 화면에서 예제의 종류를 선택할 수 있도록 해시라우팅 기반의 페이지 구분.” Hash routing works with static hosting (no server config) and is sufficient for a small number of example pages. Keeping a minimal custom router avoids adding react-router for two routes initially.

**Alternatives considered**: (a) React Router with `HashRouter` — acceptable but adds dependency for little gain at current scope. (b) History mode (`/audio-video`) — would require GitHub Pages 404 fallback to `index.html` (supported) but hash is simpler and explicitly requested. (c) Single page with tabs only — does not provide shareable “deep links” to examples; hash routes do.

---

## 3. GitHub Pages Deployment

**Decision**: Use a GitHub Action workflow (e.g. `.github/workflows/deploy-pages.yml`) to build the Vega library and the demo app, then deploy the demo build output to GitHub Pages. Use the standard `actions/upload-pages-artifact` and `actions/deploy-pages` (or the `peaceiris/actions-gh-pages` pattern). Configure Vite’s `base` for the demo app to the repository’s GitHub Pages URL (e.g. `base: '/vega/'` for `https://<user>.github.io/vega/`). Build order: (1) build library (`npm run build`), (2) build demo (e.g. `npm run build:demo` or `cd examples && npm run build`) so the demo links to `../dist/vega.js` or the built assets. The workflow triggers on push to `main` (or a dedicated branch) and deploys the `examples` build output to the `gh-pages` branch or to GitHub’s “GitHub Actions” Pages source.

**Rationale**: Spec FR-005 and SC-003 require the demo to be deployable and publicly accessible at a stable URL. GitHub Actions is the standard way to build and deploy static sites to GitHub Pages; using the repo name as base path is required for project Pages.

**Alternatives considered**: (a) Manual deploy — not reproducible. (b) Deploy from a branch that contains only built files — acceptable; the chosen approach uses an Action that builds on CI and deploys the artifact. (c) Different base path — would break asset URLs; `base: '/vega/'` (or `/<repo>/`) is required for correct script and asset loading.

---

## 4. Sample Media and Fixtures for Demo and E2E

**Decision**: For the **demo app**, use sample video and audio that are either (1) copied or symlinked from `tests/fixtures/h264.mp4` into `examples/public/` (or similar) so the demo can reference them by URL, or (2) served from the repo (e.g. `public/sample.mp4`). Prefer one sample video and one sample audio (or one MP4 with both tracks) so that FR-002 is satisfied without external URLs. For **E2E tests** that exercise the demo UI, use the same fixtures: load the demo page in the browser (e.g. dev server or built static), then drive “load sample” or “upload file” and assert playback state and/or canvas. Reuse `tests/fixtures/h264.mp4` for E2E; do not add new biome/ts ignores in fixture paths (fixtures are already excluded from lint by path in `biome.json`, which is acceptable).

**Rationale**: Spec assumes sample media are under team control; the repo already has `h264.mp4`. Using it (or a copy in `examples/public`) keeps the demo self-contained and the E2E deterministic. Aligns with 001-webcodecs-video-adaptor research: fixtures in `tests/fixtures/`, served via Vite for tests.

**Alternatives considered**: (a) External CDN sample — adds dependency and possible licensing. (b) Generate media at build time — unnecessary; committed fixture is enough.

---

## 5. E2E Testing of the Demo and Vega Spec Verification

**Decision**: Add E2E tests that run in a real browser (Vitest + @vitest/browser-playwright, existing setup) and that (1) load the built or dev-served demo app, (2) navigate to the Audio & Video example (e.g. hash `#/audio-video`), (3) trigger “play sample” or “load fixture” (e.g. `tests/fixtures/h264.mp4`), and (4) assert observable outcomes: playback state, `currentTime` advancing, and optionally canvas non-blank. Prefer one or a few high-value E2E tests that map to spec scenarios (FR-001–FR-004, FR-006, FR-007) over many unit tests. Do not add new `biome-ignore` or `ts-ignore`/`ts-expect-error` in demo or test code without documented justification; when reviewing, confirm no inappropriate ignores. Vega API usage in the demo must follow `specs/001-webcodecs-video-adaptor/contracts/vega-api.md` so that E2E effectively verifies “Vega is used correctly” and spec behavior.

**Rationale**: User requirement: “spec에 명시되어있는 기능을 정말로 검증할 수 있는 Programatic한 방법”, “1종오류와 2종오류가 없어야”, “100개의 단위 테스트보다 정말로 문제를 검증하는 1개의 E2E”. Constitution and 001-webcodecs-video-adaptor research already prefer E2E in real browser with fixtures. Demo E2E completes the loop: UI → Vega API → playback → assert.

**Alternatives considered**: (a) Only unit tests for React components — do not verify actual playback. (b) Manual testing only — not programmatic. (c) Mock Vega in demo E2E — would not catch real playback/API issues; reject.

---

## 6. Biome and TypeScript Scope for Demo

**Decision**: The **demo app** (`examples/**`) and any new test files MUST be included in Biome formatting and linting and in TypeScript checking. No new `biome-ignore`, `eslint-disable`, or `@ts-ignore`/`@ts-expect-error` in `examples/` or in new tests unless justified and documented (e.g. in this research or in plan.md). The only allowed project-wide suppressions remain those documented in 001-webcodecs-video-adaptor research (vega.ts worker import, mp4box-types). Ensure `biome.json` and `tsconfig` do not exclude `examples/` or new test paths from checks. Code review must confirm no inappropriate ignores.

**Rationale**: User requirement: “코드를 리뷰할때에는 내부에 biome이나 ts를 ignore하지 않았는지를 파악해야 한다.” Constitution requires format, lint, typecheck as quality gate. Demo code is first-class and must pass the same gate.

**Alternatives considered**: (a) Excluding examples from lint — rejected. (b) Adding ignores for “quick demo” — rejected.
