# Implementation Plan: Developer API Documentation and Live Demo

**Branch**: `003-api-docs-demo` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-api-docs-demo/spec.md`

## Summary

Migrate the Vega repository from a single-package npm structure to a **pnpm + Turborepo v2** monorepo. The existing library moves to `packages/vega`. Two new apps are created: `apps/demo` (Vite + Lit + TS live demo with video playback) and `apps/doc` (VitePress + TypeDoc API documentation site). Both apps deploy to **Vercel** as separate projects. The root README becomes a symlink to `packages/vega/README.md`.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (ES2020 target for library, ES2023 for apps)  
**Primary Dependencies**: pnpm 10.x, Turborepo 2.7+, Vite 7.3.x, Lit 3.3.x, VitePress 1.6.x, TypeDoc 0.28.x, mediabunny ^1.40.0  
**Storage**: N/A (static sites, in-memory rendering)  
**Testing**: Vitest 4.x with browser mode (Playwright) for `packages/vega`  
**Target Platform**: Browser (Chrome 94+, Edge 94+, Safari 16.4+, Firefox 130+) for WebCodecs  
**Project Type**: Library (publishable) + 2 apps (demo SPA, documentation static site)  
**Performance Goals**: Demo page interactive within 2s of load; docs searchable via local index  
**Constraints**: WebCodecs requires secure context (HTTPS); demo needs COOP/COEP headers for SharedArrayBuffer compatibility  
**Scale/Scope**: 5 workspaces (vega, demo, doc, biome-config, tsconfig), ~20 new config files, ~5 new source files, 2 Vercel projects

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality

| Gate | Status | Notes |
|---|---|---|
| Biome format + lint configured for all workspaces | **PASS** | `packages/biome-config` provides per-context presets (library, lit-app, vitepress); each workspace extends via `workspace:*` dependency |
| TypeScript strict mode in all packages | **PASS** | `packages/tsconfig` provides per-context bases (library, lit-app, vitepress) with `"strict": true`; each workspace extends via `workspace:*` dependency |
| Turbo pipeline includes `lint`, `format:check`, `typecheck` | **PASS** | All defined in `turbo.json` tasks |
| CI runs quality gate before release | **PASS** | GitHub Actions workflow updated for pnpm + turbo |

### II. Testing Standards

| Gate | Status | Notes |
|---|---|---|
| Existing tests preserved in `packages/vega` | **PASS** | Tests move with source to `packages/vega/tests/` |
| Demo app: meaningful E2E preferred over unit tests | **PASS** | Demo is UI-only; manual QA via the demo page itself satisfies spec SC-003/SC-004 |
| Docs: build verification (TypeDoc + VitePress produce output) | **PASS** | Build task validates generation pipeline |

### III. User Experience Consistency

| Gate | Status | Notes |
|---|---|---|
| Public API unchanged by migration | **PASS** | Library code moves locations but package name, exports, and API are identical |
| Docs match published API surface | **PASS** | TypeDoc generates from same `index.ts` barrel export |
| Cross-navigation between docs and demo | **PASS** | FR-008; links in both directions planned |
| Version labeling in docs | **PASS** | FR-009; nav dropdown reads `package.json` version |

### Post-Design Re-Check

All gates remain **PASS**. No new violations introduced by the Phase 1 design. The monorepo migration is structural; it does not alter the library's public API or behavior.

## Project Structure

### Documentation (this feature)

```text
specs/003-api-docs-demo/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── monorepo-structure.md
│   └── vercel-deployment.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
vega/
├── apps/
│   ├── demo/                       # NEW: Vite + Lit + TS demo
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json           # extends @gyeonghokim/tsconfig/lit-app.json
│   │   ├── biome.json              # extends @gyeonghokim/biome-config/lit-app.json
│   │   ├── vite.config.ts
│   │   ├── vercel.json
│   │   ├── public/
│   │   │   └── sample.mp4          # bundled sample media
│   │   └── src/
│   │       ├── index.ts            # entry: wire up inputs
│   │       └── vega-player.ts      # <vega-player> Lit component
│   └── doc/                        # NEW: VitePress + TypeDoc docs
│       ├── .vitepress/
│       │   └── config.mts
│       ├── .gitignore              # ignores api/ generated dir
│       ├── api/                    # generated (gitignored)
│       ├── guide/
│       │   ├── getting-started.md
│       │   └── what-is-vega.md
│       ├── index.md                # landing page (hero + features)
│       ├── package.json
│       ├── tsconfig.json           # extends @gyeonghokim/tsconfig/vitepress.json
│       ├── biome.json              # extends @gyeonghokim/biome-config/vitepress.json
│       ├── typedoc.json
│       └── vercel.json
├── packages/
│   ├── biome-config/               # NEW: shared Biome presets
│   │   ├── package.json
│   │   ├── library.json            # preset for packages/vega
│   │   ├── lit-app.json            # preset for apps/demo (Lit)
│   │   └── vitepress.json          # preset for apps/doc (VitePress)
│   ├── tsconfig/                   # NEW: shared TypeScript bases
│   │   ├── package.json
│   │   ├── base.json               # common strict options
│   │   ├── library.json            # extends base; NodeNext, declaration emit
│   │   ├── lit-app.json            # extends base; bundler, experimentalDecorators
│   │   └── vitepress.json          # extends base; bundler, VitePress paths
│   └── vega/                       # MOVED from root
│       ├── src/                    # existing source
│       ├── tests/                  # existing tests
│       ├── dist/                   # build output
│       ├── package.json            # existing (updated paths)
│       ├── tsconfig.json           # extends @gyeonghokim/tsconfig/library.json
│       ├── tsconfig.build.json     # declaration emit
│       ├── vite.config.ts          # library build
│       ├── vitest.config.ts        # browser-mode tests
│       ├── vite-env.d.ts
│       ├── .releaserc.json         # semantic-release config
│       └── README.md               # existing
├── .github/workflows/
│   └── release.yml                 # UPDATED: pnpm + turbo
├── .husky/
│   ├── commit-msg                  # UPDATED: pnpm dlx commitlint
│   ├── pre-commit                  # UPDATED: pnpm turbo lint
│   └── pre-push                    # UPDATED: pnpm turbo test
├── commitlint.config.js            # unchanged
├── package.json                    # UPDATED: private root, turbo scripts
├── pnpm-workspace.yaml             # NEW
├── turbo.json                      # NEW
├── README.md → packages/vega/README.md  # REPLACED with symlink
└── LICENSE
```

**Structure Decision**: Monorepo with `apps/` and `packages/` convention. Library (`packages/vega`) is the sole publishable package. Shared configs (`packages/biome-config`, `packages/tsconfig`) are private internal packages consumed via `workspace:*`. Apps are private, deployed to Vercel. Root orchestrates via Turborepo.

## Implementation Phases

### Phase 1: Monorepo Scaffold & Migration

**Goal**: Restructure repository from single-package npm to pnpm + Turborepo monorepo without breaking existing library functionality.

**Tasks**:
1. Create `pnpm-workspace.yaml`, `turbo.json`, update root `package.json` (private, turbo scripts)
2. Create `packages/tsconfig/` — shared TypeScript base configs:
   - `base.json`: common strict options (strict, skipLibCheck, isolatedModules, etc.)
   - `library.json`: extends base; `module: "NodeNext"`, `moduleResolution: "NodeNext"`, declaration emit
   - `lit-app.json`: extends base; `module: "ESNext"`, `moduleResolution: "bundler"`, `experimentalDecorators: true`, `useDefineForClassFields: false`
   - `vitepress.json`: extends base; `module: "ESNext"`, `moduleResolution: "bundler"`, VitePress-compatible settings
   - `package.json`: `"name": "@gyeonghokim/tsconfig"`, private, exports all JSON files
3. Create `packages/biome-config/` — shared Biome presets:
   - `library.json`: recommended rules + library-specific overrides (e.g., allow certain patterns for WebCodecs APIs)
   - `lit-app.json`: recommended rules + Lit-specific overrides (e.g., allow `@customElement` class expressions)
   - `vitepress.json`: recommended rules + VitePress/markdown-adjacent overrides
   - `package.json`: `"name": "@gyeonghokim/biome-config"`, private, exports all JSON files
4. Create `packages/vega/` directory; move `src/`, `tests/`, `dist/`, config files
5. Update `packages/vega/package.json` — add `@gyeonghokim/tsconfig` and `@gyeonghokim/biome-config` as `workspace:*` devDependencies
6. Update `packages/vega/tsconfig.json` to extend `@gyeonghokim/tsconfig/library.json`
7. Update `packages/vega/biome.json` to extend `@gyeonghokim/biome-config/library.json`
8. Update `packages/vega/vite.config.ts` and `vitest.config.ts` for new relative paths
9. Move `.releaserc.json` to `packages/vega/`, switch to `@anolilab/semantic-release-pnpm`
10. Replace root `README.md` with symlink to `packages/vega/README.md`
11. Remove root `tsconfig.json` and root `biome.json` (replaced by config packages)
12. Update `.husky/*` hooks to use `pnpm` commands
13. Update `.github/workflows/release.yml` for pnpm + turbo
14. Remove `package-lock.json`, run `pnpm install`, verify `pnpm-lock.yaml`
15. Verify: `pnpm build`, `pnpm test`, `pnpm lint` all pass

### Phase 2: Demo App (apps/demo)

**Goal**: Create a live demo page that demonstrates video playback using the vega library.

**Tasks**:
1. Scaffold `apps/demo/` with `package.json`, `tsconfig.json`, `biome.json`, `vite.config.ts`, `index.html`
2. Add `@gyeonghokim/vega`, `@gyeonghokim/tsconfig`, `@gyeonghokim/biome-config` as `workspace:*` dependencies; `tsconfig.json` extends `@gyeonghokim/tsconfig/lit-app.json`, `biome.json` extends `@gyeonghokim/biome-config/lit-app.json`
3. Implement `<vega-player>` Lit web component (canvas, controls, error states)
4. Implement host page wiring (URL input, file upload, component instantiation)
5. Add WebCodecs capability detection with fallback banner
6. Add `apps/demo/vercel.json` for Vercel deployment
7. Add sample media file to `public/`
8. Verify: `pnpm --filter @gyeonghokim/vega-demo dev` serves working demo

### Phase 3: Documentation Site (apps/doc)

**Goal**: Create API reference + getting-started documentation using VitePress + TypeDoc.

**Tasks**:
1. Scaffold `apps/doc/` with `package.json`, `tsconfig.json`, `biome.json`, `typedoc.json`
2. Add `@gyeonghokim/vega`, `@gyeonghokim/tsconfig`, `@gyeonghokim/biome-config` as `workspace:*` dependencies; `tsconfig.json` extends `@gyeonghokim/tsconfig/vitepress.json`, `biome.json` extends `@gyeonghokim/biome-config/vitepress.json`
3. Configure `.vitepress/config.mts` with multi-sidebar, nav, search, version badge
4. Create landing page `index.md` with hero + features
5. Write `guide/getting-started.md` (install, quick start, browser requirements)
6. Write `guide/what-is-vega.md` (overview, concepts)
7. Configure TypeDoc to generate `api/` markdown from library source
8. Add `.gitignore` for `api/` generated directory
9. Add `apps/doc/vercel.json` for Vercel deployment
10. Verify: `pnpm --filter @gyeonghokim/vega-doc dev` serves docs with API reference

### Phase 4: CI/CD & Cross-Navigation

**Goal**: Ensure CI pipeline works with monorepo structure and both apps are properly linked.

**Tasks**:
1. Update GitHub Actions release workflow for pnpm install + turbo build + semantic-release
2. Add cross-links: demo → docs, docs → demo (FR-008)
3. Verify: push to `main` triggers Vercel deployments for both apps
4. Verify: semantic-release publishes `@gyeonghokim/vega` to npm correctly
5. Verify: all success criteria (SC-001 through SC-005) pass

## Complexity Tracking

The five-workspace structure (vega, demo, doc, biome-config, tsconfig) centralizes config management while keeping each workspace's settings tailored to its context (library vs Lit app vs VitePress site).

| Deviation | Why Accepted | Constitution Principle |
|---|---|---|
| No new test tasks for `apps/demo` (vega-player component) | The demo component is UI glue wrapping the vega library; it contains no business logic beyond wiring Vega API calls to Lit reactive state. Core library tests (preserved in `packages/vega/tests/`) cover the real logic. Manual QA via the demo page itself validates SC-003 and SC-004 — this aligns with the constitution's guidance to "prefer meaningful E2E tests" and "avoid meaningless unit tests for non-business-logic code." Build verification (`pnpm build`) validates the component compiles and bundles correctly. | II. Testing Standards |
| No new test tasks for `apps/doc` (VitePress + TypeDoc) | The docs site is static content generation with zero business logic. TypeDoc + VitePress build output is validated by the build task itself (TypeDoc fails on unresolvable types; VitePress fails on broken markdown). No meaningful unit test target exists. | II. Testing Standards |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TypeDoc fails on library types (WebGPU, Vite client types) | Medium | Medium | Add missing type packages to doc workspace; use `skipLibCheck` if needed |
| Lit decorator breakage with TS 5.9 | Low | High | Pin `experimentalDecorators: true` + `useDefineForClassFields: false` |
| pnpm hoisting causes duplicate Lit copies | Medium | Medium | `resolve.dedupe: ["lit"]` in Vite config |
| Vercel build fails on internal workspace deps | Low | Medium | Turbo `^build` ensures deps built first; test locally with `turbo build` |
| Sample media too large for git | Low | Low | Use small (< 5MB) sample; or fetch from CDN at runtime |
