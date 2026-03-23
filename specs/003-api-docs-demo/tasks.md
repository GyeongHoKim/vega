# Tasks: Developer API Documentation and Live Demo

**Input**: Design documents from `/specs/003-api-docs-demo/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec. Build verification serves as the primary validation for each phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Monorepo Skeleton)

**Purpose**: Create the root-level monorepo configuration files that all workspaces depend on.

- [ ] T001 Create `pnpm-workspace.yaml` at repo root declaring `packages/*` and `apps/*` workspaces
- [ ] T002 Create `turbo.json` at repo root with Turborepo v2 `"tasks"` config (build, lint, format, format:check, typecheck, test, dev, clean, release)
- [ ] T003 Update root `package.json` — set `"private": true`, `"packageManager": "pnpm@10.8.1"`, add turbo scripts delegating to `turbo run`, move orchestration-only devDependencies (turbo, husky, commitlint)

---

## Phase 2: Foundational (Config Packages + Library Migration)

**Purpose**: Create shared config packages and migrate the existing library into the monorepo structure. MUST complete before ANY user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Config Packages

- [ ] T004 [P] Create `packages/tsconfig/package.json` — `"name": "@gyeonghokim/tsconfig"`, `"private": true`, `"type": "module"`, exports for `base.json`, `library.json`, `lit-app.json`, `vitepress.json`
- [ ] T005 [P] Create `packages/tsconfig/base.json` — common strict options: `strict`, `skipLibCheck`, `isolatedModules`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`, `resolveJsonModule`
- [ ] T006 Create `packages/tsconfig/library.json` — extends `./base.json`; `target: "ES2020"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `declaration: true`, `declarationMap: true`, `sourceMap: true`, `lib: ["ES2020", "DOM", "DOM.Iterable"]`
- [ ] T007 [P] Create `packages/tsconfig/lit-app.json` — extends `./base.json`; `target: "ES2023"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `experimentalDecorators: true`, `useDefineForClassFields: false`, `noEmit: true`, `lib: ["ES2023", "DOM", "DOM.Iterable"]`
- [ ] T008 [P] Create `packages/tsconfig/vitepress.json` — extends `./base.json`; `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `noEmit: true`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`
- [ ] T009 [P] Create `packages/biome-config/package.json` — `"name": "@gyeonghokim/biome-config"`, `"private": true`, `"type": "module"`, exports for `library.json`, `lit-app.json`, `vitepress.json`
- [ ] T010 [P] Create `packages/biome-config/library.json` — recommended rules, formatter (space indent, 100 line width), organize imports, file includes/excludes matching current `biome.json`
- [ ] T011 [P] Create `packages/biome-config/lit-app.json` — extend library defaults; add Lit-specific overrides (decorator patterns, web component naming conventions)
- [ ] T012 [P] Create `packages/biome-config/vitepress.json` — extend library defaults; add VitePress/markdown-adjacent file handling overrides

### Library Migration

- [ ] T013 Create `packages/vega/` directory and move `src/`, `tests/`, `dist/`, `vite-env.d.ts` from repo root
- [ ] T014 Move `vite.config.ts` to `packages/vega/vite.config.ts` and update `entry` path to `resolve(__dirname, "src/index.ts")`
- [ ] T015 Move `vitest.config.ts` to `packages/vega/vitest.config.ts` and update `include` path to `["tests/**/*.test.ts"]`
- [ ] T016 Move `tsconfig.build.json` to `packages/vega/tsconfig.build.json` and update `extends` to reference `@gyeonghokim/tsconfig/library.json`
- [ ] T017 Update `packages/vega/package.json` — add `@gyeonghokim/tsconfig` and `@gyeonghokim/biome-config` as `workspace:*` devDependencies; keep all existing deps; adjust scripts if paths changed
- [ ] T018 Create `packages/vega/tsconfig.json` — `extends: "@gyeonghokim/tsconfig/library.json"`, add `types: ["@webgpu/types", "vite/client"]`, set `rootDir: "src"`, `include: ["src/**/*"]`, `exclude: ["node_modules", "dist", "tests"]`
- [ ] T019 Create `packages/vega/biome.json` — extends `@gyeonghokim/biome-config/library.json`
- [ ] T020 Move `.releaserc.json` to `packages/vega/.releaserc.json` and switch `@semantic-release/npm` to `@anolilab/semantic-release-pnpm`; add `@anolilab/semantic-release-pnpm` as devDependency

### Root Cleanup & Tooling

- [ ] T021 Remove root `tsconfig.json` and root `biome.json` (replaced by config packages)
- [ ] T022 Replace root `README.md` with symlink: `ln -sf packages/vega/README.md README.md`
- [ ] T023 Update `.husky/commit-msg` — change `npx` to `pnpm dlx commitlint --edit $1`
- [ ] T024 [P] Update `.husky/pre-commit` — change to `pnpm turbo run lint format:check typecheck`
- [ ] T025 [P] Update `.husky/pre-push` — change to `pnpm turbo run test`
- [ ] T026 Update `.github/workflows/release.yml` — add `pnpm/action-setup@v4`, change `npm clean-install` to `pnpm install --frozen-lockfile`, change build/release commands to use turbo and `pnpm --filter @gyeonghokim/vega exec semantic-release`
- [ ] T027 Remove `package-lock.json`, run `pnpm install`, verify `pnpm-lock.yaml` is generated
- [ ] T028 Verify: `pnpm build` builds `packages/vega` successfully
- [ ] T029 Verify: `pnpm test` runs existing tests in `packages/vega` successfully
- [ ] T030 Verify: `pnpm lint` and `pnpm typecheck` pass across all workspaces

**Checkpoint**: Monorepo structure is complete. Library builds, tests, and lints identically to pre-migration. User story implementation can begin.

---

## Phase 3: User Story 1 — Find and understand the public API (Priority: P1) 🎯 MVP

**Goal**: Publish a structured, searchable developer reference for the library's public API surface using VitePress + TypeDoc.

**Independent Test**: Using only the published developer reference, an integrator can identify the entry points needed to load media and observe playback state. Every public symbol is reachable within three navigational steps or via search (SC-001).

### Implementation for User Story 1

- [ ] T031 [US1] Create `apps/doc/package.json` — `"name": "@gyeonghokim/vega-doc"`, `"private": true`, devDependencies: `vitepress@^1.6.4`, `typedoc@^0.28.17`, `typedoc-plugin-markdown@^4.10.0`, `typedoc-vitepress-theme@^1.1.2`, `typescript@^5.9.3`, `@gyeonghokim/vega: "workspace:*"`, `@gyeonghokim/tsconfig: "workspace:*"`, `@gyeonghokim/biome-config: "workspace:*"`; scripts: `typedoc`, `dev: "npm run typedoc && vitepress dev"`, `build: "npm run typedoc && vitepress build"`, `preview: "vitepress preview"`
- [ ] T032 [P] [US1] Create `apps/doc/tsconfig.json` — extends `@gyeonghokim/tsconfig/vitepress.json`, add `types: ["vite/client"]`
- [ ] T033 [P] [US1] Create `apps/doc/biome.json` — extends `@gyeonghokim/biome-config/vitepress.json`
- [ ] T034 [US1] Create `apps/doc/typedoc.json` — `entryPoints: ["../../packages/vega/src/index.ts"]`, `tsconfig: "../../packages/vega/tsconfig.json"`, `plugin: ["typedoc-plugin-markdown", "typedoc-vitepress-theme"]`, `out: "./api"`, `readme: "none"`, format options (table for params/interfaces/enums, useCodeBlocks, useHTMLEncodedBrackets), sidebar autoConfiguration; configure `excludeInternal: true` to strip `@internal`-tagged symbols and `"visibilityFilters": { "inherited": true, "@alpha": false }` to hide experimental APIs from the public reference (FR-002)
- [ ] T035 [US1] Create `apps/doc/.vitepress/config.mts` — title "Vega", multi-sidebar (`/guide/` + `/api/`), nav (Guide, API Reference, version dropdown reading `package.json`), local search, social links (GitHub), footer, import `typedoc-sidebar.json` for API sidebar
- [ ] T036 [US1] Create `apps/doc/index.md` — VitePress home layout with hero (title "Vega", tagline "WebCodecs Video Player"), action buttons (Get Started → `/guide/getting-started`, API Reference → `/api/`), feature cards (WebCodecs Native, Custom Frame Processing, Tiny Footprint)
- [ ] T037 [US1] Create `apps/doc/.gitignore` — ignore `api/` generated directory and `.vitepress/cache/`, `.vitepress/dist/`
- [ ] T038 [US1] Create `apps/doc/vercel.json` — `buildCommand: "turbo build"`, `outputDirectory: ".vitepress/dist"`, immutable cache headers for `/assets/`
- [ ] T039 [US1] Run `pnpm install` to link workspace dependencies, then verify: `pnpm --filter @gyeonghokim/vega-doc run typedoc` generates `apps/doc/api/` markdown from library source
- [ ] T040 [US1] Verify: `pnpm --filter @gyeonghokim/vega-doc dev` serves docs site with navigable API reference; public symbols reachable within 3 clicks from API index (SC-001); version badge shows in nav (FR-009)

**Checkpoint**: API reference is functional with Vercel deployment config — public symbols documented with navigation and search (FR-001, FR-002, SC-001).

---

## Phase 4: User Story 2 — Follow guided usage from zero to first success (Priority: P2)

**Goal**: Publish getting-started material that leads an integrator from prerequisites through a minimal working example.

**Independent Test**: A reviewer follows the getting-started path with a sample asset and completes the baseline scenario in under 30 minutes using only published docs (SC-002).

### Implementation for User Story 2

- [ ] T041 [US2] Write `apps/doc/guide/what-is-vega.md` — overview of the library (WebCodecs-based video playback, custom frame processing), architecture at a glance, link to API reference
- [ ] T042 [US2] Write `apps/doc/guide/getting-started.md` — installation (npm/pnpm code group), quick start code example (createVega, canvas, play), browser requirements table (Chrome 94+, Edge 94+, Safari 16.4+, Firefox 130+), environment prerequisites (secure context, WebCodecs), common failure troubleshooting (unsupported format, CORS, autoplay), links to API reference and demo (FR-003, FR-004)
- [ ] T043 [US2] Update `apps/doc/.vitepress/config.mts` sidebar `/guide/` section — add entries for "What is Vega?" and "Getting Started" pages
- [ ] T044 [US2] Verify: `pnpm --filter @gyeonghokim/vega-doc dev` serves guide pages; getting-started renders install instructions, code example, browser table, and troubleshooting section; links to API reference work (FR-003, FR-004, SC-002)

**Checkpoint**: Getting-started guide is complete — new integrators can reach first success following the documented path.

---

## Phase 5: User Story 3 — Validate behavior in a live demo (Priority: P3)

**Goal**: Publish a hosted demo page that exercises video playback with clear labels and error handling.

**Independent Test**: Open the demo in a supported browser, load sample media via URL or file upload, observe playback controls, and confirm outcomes match on-page labels. Error cases show visible messages (SC-003, SC-004).

### Implementation for User Story 3

- [ ] T045 [US3] Create `apps/demo/package.json` — `"name": "@gyeonghokim/vega-demo"`, `"private": true`, dependencies: `lit@^3.3.2`, `@gyeonghokim/vega: "workspace:*"`, devDependencies: `vite@^7.3.1`, `typescript@^5.9.3`, `@gyeonghokim/tsconfig: "workspace:*"`, `@gyeonghokim/biome-config: "workspace:*"`; scripts: `dev`, `build`, `preview`
- [ ] T046 [P] [US3] Create `apps/demo/tsconfig.json` — extends `@gyeonghokim/tsconfig/lit-app.json`, add `types: ["vite/client"]`
- [ ] T047 [P] [US3] Create `apps/demo/biome.json` — extends `@gyeonghokim/biome-config/lit-app.json`
- [ ] T048 [US3] Create `apps/demo/vite.config.ts` — dev server port 3000 with COOP/COEP headers, build target es2023, `resolve.dedupe: ["lit"]`, output to `dist/`
- [ ] T049 [US3] Create `apps/demo/index.html` — semantic HTML (header, main, footer), `<h1>Vega Player Demo</h1>`, URL input with label, file upload input with label, `<vega-player>` custom element, `<script type="module" src="/src/index.ts">`, `color-scheme: light dark` CSS, centered layout
- [ ] T050 [US3] Implement `apps/demo/src/vega-player.ts` — Lit `@customElement("vega-player")` with: `@property src` (video URL), `@state _state/_currentTime/_duration/_error/_webCodecsSupported`, `@query("canvas")`, canvas + controls (play/pause button, range seek, time display), WebCodecs detection in `connectedCallback`, error banner with `role="alert"` mapping error codes to messages (FR-006, FR-007), CSS with Shadow DOM isolation
- [ ] T051 [US3] Create `apps/demo/src/index.ts` — import `vega-player.ts`, wire URL input `change` → set `player.src`, wire file input `change` → call `player.handleFileSelect(e)`
- [ ] T052 [US3] Add sample media file to `apps/demo/public/` (small MP4, < 5MB, H.264 baseline for broad WebCodecs support)
- [ ] T053 [US3] Create `apps/demo/vercel.json` — `buildCommand: "turbo build"`, `outputDirectory: "dist"`, SPA rewrite rule `/(.*) → /index.html`
- [ ] T054 [US3] Run `pnpm install` to link workspace dependencies, then verify: `pnpm --filter @gyeonghokim/vega-demo dev` serves demo at localhost:3000
- [ ] T055 [US3] Verify: demo loads sample media, play/pause works, seek slider updates, time displays correctly (FR-005, FR-006, SC-003)
- [ ] T056 [US3] Verify: error states — load invalid file shows error banner, unsupported browser shows capability warning banner (FR-007, SC-004)

**Checkpoint**: Live demo is functional — video playback with controls, error handling, and clear labels.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: CI/CD updates, cross-navigation, Vercel deployment config, and final validation across all stories.

### CI/CD & Deployment

- [ ] T057 Verify `.github/workflows/release.yml` runs end-to-end: `pnpm install → turbo build → turbo test → semantic-release` in CI context
- [ ] T058 Run `pnpm build` from root — verify all 5 workspaces resolve correctly and Turborepo task graph executes: tsconfig → biome-config → vega → demo + doc in parallel

### Cross-Navigation (FR-008, SC-005)

- [ ] T059 [P] Add link to demo page in `apps/doc/.vitepress/config.mts` nav (e.g., `{ text: "Live Demo", link: "https://vega-demo.vercel.app" }`)
- [ ] T060 [P] Add link to demo in `apps/doc/guide/getting-started.md` (e.g., "Try the [live demo](https://vega-demo.vercel.app) to see Vega in action")
- [ ] T061 [P] Add link to docs and GitHub in `apps/demo/index.html` footer (e.g., `<a href="https://vega-doc.vercel.app">Documentation</a>`, `<a href="https://github.com/GyeongHoKim/vega">GitHub</a>`)
- [ ] T062 Verify: from docs, user reaches demo in one click; from demo, user reaches docs in one click (SC-005)

### Final Validation

- [ ] T063 Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck` — all workspaces pass
- [ ] T064 Run `pnpm test` — existing library tests pass in `packages/vega`
- [ ] T065 Validate quickstart.md steps: clone → install → build → dev servers for demo and doc both work
- [ ] T066 Verify SC-001: every public symbol in API index reachable within 3 navigational steps
- [ ] T067 Verify SC-002: getting-started path completable in under 30 minutes by non-contributor
- [ ] T068 Verify SC-003: demo completes primary flow in under 2 minutes from page load
- [ ] T069 Verify SC-004: all demo error cases show visible, non-empty messages (no silent failures)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — scaffolds `apps/doc`
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — adds guide pages to already-scaffolded `apps/doc`
- **US3 (Phase 5)**: Depends on Foundational (Phase 2) only — independent of US1/US2 (different app)
- **Polish (Phase 6)**: Depends on all user stories being complete

Note: T038 (apps/doc/vercel.json) is in US1; T053 (apps/demo/vercel.json) is in US3 — both deployment configs are in their respective story phases.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **US2 (P2)**: Depends on US1 scaffold — `apps/doc` must exist with VitePress config before adding guide pages
- **US3 (P3)**: Can start after Foundational (Phase 2) — fully independent of US1/US2 (separate `apps/demo` workspace)

### Within Each Phase

- Config package files marked [P] can be created in parallel (different files)
- Library migration tasks (T013–T020) are sequential (move first, then update configs)
- Root cleanup tasks (T021–T026) can partially parallelize where marked [P]
- US3 tasks (T045–T056) are independent from US1/US2 and can run in parallel with Phases 3–4

### Parallel Opportunities

```
Phase 2 (Config Packages):
  T004, T005, T007, T008 in parallel  (tsconfig files)
  T009, T010, T011, T012 in parallel  (biome-config files)
  Then T006 (depends on T005 for base.json)

Phase 3 + Phase 5 can run in parallel:
  US1 (apps/doc) and US3 (apps/demo) are independent workspaces

Phase 2 (Root Cleanup):
  T023 + T024 + T025 in parallel (different husky files)
```

---

## Parallel Example: US3 (Live Demo)

```
# These can run in parallel (different files):
T046: Create apps/demo/tsconfig.json
T047: Create apps/demo/biome.json

# Then sequentially:
T048: Create apps/demo/vite.config.ts
T049: Create apps/demo/index.html
T050: Implement apps/demo/src/vega-player.ts
T051: Create apps/demo/src/index.ts
T052: Add sample media
T053: Create apps/demo/vercel.json
T054–T056: Verify
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T030)
3. Complete Phase 3: US1 — API Reference (T031–T040)
4. **STOP and VALIDATE**: API reference functional, public symbols documented
5. Deploy docs to Vercel for review

### Incremental Delivery

1. Setup + Foundational → Monorepo ready
2. Add US1 → API reference published → Deploy docs (MVP!)
3. Add US2 → Getting-started guide added to docs → Redeploy docs
4. Add US3 → Live demo published → Deploy demo
5. Polish → Cross-navigation, CI/CD, final validation
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (API Reference) → then US2 (Getting Started)
   - Developer B: US3 (Live Demo)
3. Both converge at Phase 6 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US3 is fully independent from US1/US2 — can be developed in parallel
- Vercel URLs (vega-demo.vercel.app, vega-doc.vercel.app) are placeholders until projects are created
