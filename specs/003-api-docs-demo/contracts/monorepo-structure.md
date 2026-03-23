# Contract: Monorepo Workspace Structure

**Date**: 2026-03-24

## Root Directory Layout

```text
vega/
├── apps/
│   ├── demo/                # Vite + Lit + TS demo app
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json    # extends @gyeonghokim/tsconfig/lit-app.json
│   │   ├── biome.json       # extends @gyeonghokim/biome-config/lit-app.json
│   │   ├── vite.config.ts
│   │   ├── vercel.json
│   │   ├── public/
│   │   └── src/
│   │       ├── index.ts
│   │       └── vega-player.ts
│   └── doc/                 # VitePress + TypeDoc docs site
│       ├── .vitepress/
│       │   └── config.mts
│       ├── api/             # generated (gitignored)
│       ├── guide/
│       │   ├── getting-started.md
│       │   └── what-is-vega.md
│       ├── index.md
│       ├── package.json
│       ├── tsconfig.json    # extends @gyeonghokim/tsconfig/vitepress.json
│       ├── biome.json       # extends @gyeonghokim/biome-config/vitepress.json
│       ├── typedoc.json
│       └── vercel.json
├── packages/
│   ├── biome-config/        # NEW: shared Biome presets
│   │   ├── package.json
│   │   ├── library.json     # preset for packages/vega
│   │   ├── lit-app.json     # preset for apps/demo
│   │   └── vitepress.json   # preset for apps/doc
│   ├── tsconfig/            # NEW: shared TypeScript bases
│   │   ├── package.json
│   │   ├── base.json        # common strict options
│   │   ├── library.json     # NodeNext, declaration emit
│   │   ├── lit-app.json     # bundler, experimentalDecorators
│   │   └── vitepress.json   # bundler, VitePress paths
│   └── vega/                # Core library (moved from root)
│       ├── src/
│       ├── tests/
│       ├── dist/            # build output
│       ├── package.json
│       ├── tsconfig.json    # extends @gyeonghokim/tsconfig/library.json
│       ├── biome.json       # extends @gyeonghokim/biome-config/library.json
│       ├── tsconfig.build.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       ├── .releaserc.json
│       └── README.md
├── .github/
│   └── workflows/
│       └── release.yml      # updated for pnpm + turbo
├── .husky/
│   ├── commit-msg
│   ├── pre-commit
│   └── pre-push
├── commitlint.config.js
├── package.json             # root (private, orchestration only)
├── pnpm-workspace.yaml
├── turbo.json
├── README.md → packages/vega/README.md  # symlink
└── LICENSE
```

## Workspace Protocol

| Package | Name | Private | Depends On |
|---|---|---|---|
| Root | `vega-monorepo` | Yes | — |
| `packages/tsconfig` | `@gyeonghokim/tsconfig` | Yes | — |
| `packages/biome-config` | `@gyeonghokim/biome-config` | Yes | — |
| `packages/vega` | `@gyeonghokim/vega` | No | `@gyeonghokim/tsconfig`, `@gyeonghokim/biome-config` via `workspace:*` |
| `apps/demo` | `@gyeonghokim/vega-demo` | Yes | `@gyeonghokim/vega`, `@gyeonghokim/tsconfig`, `@gyeonghokim/biome-config` via `workspace:*` |
| `apps/doc` | `@gyeonghokim/vega-doc` | Yes | `@gyeonghokim/vega`, `@gyeonghokim/tsconfig`, `@gyeonghokim/biome-config` via `workspace:*` |

## Files Moved from Root → `packages/vega/`

| From (current) | To (new) |
|---|---|
| `src/` | `packages/vega/src/` |
| `tests/` | `packages/vega/tests/` |
| `dist/` | `packages/vega/dist/` |
| `vite.config.ts` | `packages/vega/vite.config.ts` |
| `vitest.config.ts` | `packages/vega/vitest.config.ts` |
| `tsconfig.build.json` | `packages/vega/tsconfig.build.json` |
| `.releaserc.json` | `packages/vega/.releaserc.json` |
| `vite-env.d.ts` | `packages/vega/vite-env.d.ts` |

## Files that Stay at Root (modified)

| File | Change |
|---|---|
| `package.json` | Becomes private root; scripts delegate to turbo |
| `commitlint.config.js` | Unchanged |
| `.husky/*` | Updated to use `pnpm` commands |
| `.github/workflows/release.yml` | Updated for pnpm + turbo |

## Files Removed from Root

| File | Replacement |
|---|---|
| `tsconfig.json` | Replaced by `packages/tsconfig/` (per-context bases) |
| `biome.json` | Replaced by `packages/biome-config/` (per-context presets) |

## New Files at Root

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Declares `apps/*` and `packages/*` |
| `turbo.json` | Task orchestration: build, lint, test, dev |

## New Config Packages

### `packages/tsconfig`

| File | Extends | Key Settings | Used By |
|---|---|---|---|
| `base.json` | — | `strict`, `skipLibCheck`, `isolatedModules`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax` | All others extend this |
| `library.json` | `base.json` | `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `declaration: true`, `declarationMap: true`, `target: "ES2020"` | `packages/vega` |
| `lit-app.json` | `base.json` | `module: "ESNext"`, `moduleResolution: "bundler"`, `experimentalDecorators: true`, `useDefineForClassFields: false`, `target: "ES2023"` | `apps/demo` |
| `vitepress.json` | `base.json` | `module: "ESNext"`, `moduleResolution: "bundler"`, `target: "ES2022"` | `apps/doc` |

### `packages/biome-config`

| File | Key Settings | Used By |
|---|---|---|
| `library.json` | Recommended rules, formatter (space indent, 100 line width), organize imports | `packages/vega` |
| `lit-app.json` | Extends library defaults; Lit-specific overrides (decorator patterns, web component conventions) | `apps/demo` |
| `vitepress.json` | Extends library defaults; VitePress/markdown-adjacent file overrides | `apps/doc` |
