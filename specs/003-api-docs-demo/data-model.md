# Data Model: 003-api-docs-demo

**Date**: 2026-03-24  
**Branch**: `003-api-docs-demo`

This feature is primarily a **structural migration + static site generation** feature. It does not introduce new runtime entities to the core library. The "data model" describes the workspace structure and configuration entities that govern the monorepo, docs, and demo.

## Entity: Workspace Package

Represents a package in the pnpm monorepo.

| Field | Type | Description |
|---|---|---|
| `name` | string | npm package name (e.g., `@gyeonghokim/vega`, `@gyeonghokim/vega-doc`) |
| `private` | boolean | Whether the package is publishable (`false` for vega, `true` for apps) |
| `location` | path | Directory relative to repo root (`packages/vega`, `apps/demo`, `apps/doc`) |
| `type` | enum | `"library"` \| `"app"` |
| `dependencies` | map | Internal workspace deps via `workspace:*` protocol |

### Relationships

```
vega-monorepo (root, private)
├── @gyeonghokim/vega       (packages/vega, publishable)
├── @gyeonghokim/vega-demo  (apps/demo, private) → depends on @gyeonghokim/vega
└── @gyeonghokim/vega-doc   (apps/doc, private)  → depends on @gyeonghokim/vega
```

## Entity: TypeDoc Configuration

Governs API documentation generation.

| Field | Type | Description |
|---|---|---|
| `entryPoints` | string[] | TypeScript entry files to document (library barrel export) |
| `tsconfig` | path | Library tsconfig for type resolution |
| `out` | path | Output directory for generated markdown (`api/`) |
| `plugins` | string[] | TypeDoc plugins (`typedoc-plugin-markdown`, `typedoc-vitepress-theme`) |

### State Transitions

```
Source (packages/vega/src/) → TypeDoc → Markdown (apps/doc/api/) → VitePress → Static HTML (.vitepress/dist/)
```

## Entity: VitePress Site Configuration

| Field | Type | Description |
|---|---|---|
| `title` | string | Site title ("Vega") |
| `sidebar` | object | Multi-sidebar config: `/guide/` (hand-written) + `/api/` (generated) |
| `nav` | array | Top navigation: Guide, API Reference, version dropdown |
| `search` | object | Local search provider config |

## Entity: Vercel Deployment

Two independent deployment targets from the same repository.

| Field | Vega Demo | Vega Doc |
|---|---|---|
| Vercel Project | `vega-demo` | `vega-doc` |
| Root Directory | `apps/demo` | `apps/doc` |
| Framework | Vite | VitePress |
| Output | `dist` | `.vitepress/dist` |
| Build Command | `turbo build` | `turbo build` |

## Entity: Demo Player Component

A Lit web component (`<vega-player>`) in `apps/demo`.

| Property | Type | Reactive | Description |
|---|---|---|---|
| `src` | `string` | `@property` | Video URL; setting triggers load |
| `_state` | `PlaybackState` | `@state` | Current player state (idle/loading/playing/paused/error/ended) |
| `_currentTime` | `number` | `@state` | Current playback position in seconds |
| `_duration` | `number` | `@state` | Total media duration in seconds |
| `_error` | `VegaErrorEvent \| null` | `@state` | Current error (null if none) |
| `_webCodecsSupported` | `boolean` | `@state` | Browser capability check result |

### State Machine

```
idle → loading → playing ⇄ paused → ended
                    ↓          ↓
                  error      error
```
