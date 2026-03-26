# Quickstart: 003-api-docs-demo

**Date**: 2026-03-24  
**Branch**: `003-api-docs-demo`

## Prerequisites

- Node.js >= 24
- pnpm >= 10.x (install via `corepack enable && corepack prepare pnpm@latest --activate`)
- Git

## 1. Clone & Install

```bash
git clone https://github.com/GyeongHoKim/vega.git
cd vega
git checkout 003-api-docs-demo
pnpm install
```

## 2. Build All Packages

```bash
pnpm build
```

This runs `turbo run build`, which builds `packages/vega` first (dependency), then `apps/demo` and `apps/doc` in parallel.

## 3. Development

### Demo App (apps/demo)

```bash
pnpm --filter @gyeonghokim/vega-demo dev
```

Opens the live demo at `http://localhost:3000`. Hot-reloads on changes to demo source or the vega library.

### Documentation Site (apps/doc)

```bash
pnpm --filter @gyeonghokim/vega-doc dev
```

Runs TypeDoc generation + VitePress dev server. Opens docs at `http://localhost:5173`.

### All Dev Servers

```bash
pnpm dev
```

Starts all `dev` tasks in parallel via Turborepo TUI.

## 4. Quality Checks

```bash
pnpm lint          # biome lint across all packages
pnpm format:check  # biome format check
pnpm typecheck     # tsc --noEmit across all packages
pnpm test          # vitest run (packages/vega)
```

## 5. Build for Production

```bash
pnpm build
```

Outputs:
- `packages/vega/dist/` — library bundle (UMD + ESM + type declarations)
- `apps/demo/dist/` — static demo SPA
- `apps/doc/.vitepress/dist/` — static documentation site

## 6. Deployment

Both `apps/demo` and `apps/doc` deploy to Vercel automatically on push to `main`. Preview deployments are created for PRs.

## Key Files

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Workspace package declaration |
| `turbo.json` | Task orchestration config |
| `packages/vega/package.json` | Core library package (publishable) |
| `apps/demo/package.json` | Demo app package |
| `apps/doc/package.json` | Docs site package |
| `apps/doc/typedoc.json` | TypeDoc → markdown config |
| `apps/doc/.vitepress/config.mts` | VitePress site config |
| `apps/demo/vercel.json` | Vercel deployment config (demo) |
| `apps/doc/vercel.json` | Vercel deployment config (docs) |
