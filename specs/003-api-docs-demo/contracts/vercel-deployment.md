# Contract: Vercel Deployment Configuration

**Date**: 2026-03-24

## Vercel Projects

Two independent Vercel projects linked to the `GyeongHoKim/vega` GitHub repository.

### Project: vega-demo

| Setting | Value |
|---|---|
| Root Directory | `apps/demo` |
| Framework Preset | Vite |
| Build Command | `turbo build` |
| Output Directory | `dist` |
| Install Command | Auto-detected (pnpm) |
| Node.js Version | 24 |

### Project: vega-doc

| Setting | Value |
|---|---|
| Root Directory | `apps/doc` |
| Framework Preset | VitePress (or Other) |
| Build Command | `turbo build` |
| Output Directory | `.vitepress/dist` |
| Install Command | Auto-detected (pnpm) |
| Node.js Version | 24 |

## Build Pipeline

On push/PR, Vercel evaluates each project independently:
1. Check if project's files changed (automatic monorepo filtering)
2. Run `pnpm install` at repo root (walks up from Root Directory to find lockfile)
3. Run `turbo build` scoped to the Root Directory workspace + its dependencies
4. Deploy the Output Directory

## Preview Deployments

- PRs get preview URLs for each affected project
- Unaffected projects are silently skipped (no build slot consumed)
- `turbo-ignore` as Ignored Build Step is optional (automatic filtering suffices)

## Cross-Navigation

- Demo links to docs via `<a href="https://vega-doc.vercel.app">Documentation</a>`
- Docs link to demo via nav entry and getting-started guide
- Both link to the GitHub repository
