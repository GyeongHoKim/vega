# Research: 003-api-docs-demo

**Date**: 2026-03-24  
**Branch**: `003-api-docs-demo`

## R1. pnpm + Turborepo Monorepo Migration

### Decision
Migrate from npm (single package.json) to **pnpm 10.x + Turborepo v2.7+** monorepo.

### Rationale
- pnpm's content-addressable store + `workspace:*` protocol give strict local resolution and smaller `node_modules`
- Turborepo v2 (`"tasks"` format, TUI, automatic workspace scoping) provides task-graph-aware build orchestration with remote caching
- Dedicated config packages (`packages/biome-config`, `packages/tsconfig`) provide per-context presets for library, Lit app, and VitePress, consumed via `workspace:*`

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| Nx | Heavier setup, more opinionated; Turborepo is lighter for 3 workspaces |
| Lerna | Deprecated as standalone; Nx-backed Lerna is overkill for this scope |
| npm workspaces | No content-addressable store, weaker workspace protocol, no task orchestration |

### Key Config Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Package manager | pnpm 10.x with Corepack | Content-addressable store, workspace protocol |
| Build orchestrator | Turborepo v2.7+ (`"tasks"` not `"pipeline"`) | Task graph, caching, TUI |
| Shared configs location | Dedicated config packages (`packages/biome-config`, `packages/tsconfig`) | Each workspace has distinct requirements (NodeNext vs bundler, Lit decorators, VitePress); dedicated packages enforce consistency while allowing per-context presets |
| Biome sharing | `packages/biome-config` with `library.json`, `lit-app.json`, `vitepress.json` presets | Per-context presets allow tailored rules (e.g., Lit decorator patterns, VitePress markdown adjacency) while sharing a common base |
| TSConfig sharing | `packages/tsconfig` with `base.json`, `library.json`, `lit-app.json`, `vitepress.json` | Library needs `NodeNext` + declaration emit; Lit needs `experimentalDecorators` + `bundler`; VitePress needs `bundler` — a single base config cannot serve all three |
| Commitlint | Root only | Git-level concern, not per-package |
| Husky | Root, `"prepare": "husky"` | One `.husky/` dir for the repo |
| semantic-release | Package-level in `packages/vega` only | Only one publishable package |
| npm publish plugin | `@anolilab/semantic-release-pnpm` | Handles `workspace:*` protocol replacement |
| Internal deps | `"workspace:*"` protocol | Strict local resolution, auto-replaced on publish |

---

## R2. Vercel Monorepo Deployment

### Decision
Two **separate Vercel projects** linked to the same GitHub repo, each with its own Root Directory setting.

### Rationale
- Vercel's canonical monorepo model: one project per deployed app
- Vercel auto-detects Turborepo from `turbo.json`, auto-detects pnpm from lockfile
- Automatic preview deploy filtering: only changed apps rebuild
- No root-level `vercel.json` needed; per-app configs are version-controlled

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| Single Vercel project for both apps | Not supported; Vercel deploys one output per project |
| Manual deploy scripts | Loses preview deployments, GitHub PR comments, and Vercel's build caching |
| GitHub Pages | No preview deployments, no server-side features, more CI config |

### Key Decisions

| Setting | `apps/demo` | `apps/doc` |
|---|---|---|
| Vercel Project Name | `vega-demo` | `vega-doc` |
| Root Directory | `apps/demo` | `apps/doc` |
| Framework Preset | Vite | VitePress |
| Build Command | `turbo build` | `turbo build` |
| Output Directory | `dist` | `.vitepress/dist` |
| Install Command | Auto-detected (pnpm) | Auto-detected (pnpm) |

### Per-app vercel.json

`apps/demo/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "turbo build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`apps/doc/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "turbo build",
  "outputDirectory": ".vitepress/dist",
  "headers": [{
    "source": "/assets/(.*)",
    "headers": [{ "key": "Cache-Control", "value": "max-age=31536000, immutable" }]
  }]
}
```

---

## R3. VitePress + TypeDoc Integration

### Decision
Use **VitePress 1.6.x (stable)** + **TypeDoc 0.28.x** + **typedoc-plugin-markdown 4.x** + **typedoc-vitepress-theme 1.x** for API documentation.

### Rationale
- `typedoc-vitepress-theme` is the official VitePress integration maintained alongside `typedoc-plugin-markdown` v4
- Pre-step approach (TypeDoc generates markdown, VitePress consumes) is more predictable than Vite plugin approach
- VitePress 1.6.x is stable; VitePress 2.x is still alpha

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| VitePress 2.x | Alpha status; not production-ready (2026-03) |
| Docusaurus | Heavier, React-based; VitePress aligns with Vite ecosystem already in use |
| Plain TypeDoc HTML | No hand-written guide pages, no search, limited theming |
| Storybook | Wrong tool; designed for component demos, not API documentation |

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| VitePress version | 1.6.4 (stable) | v2 is alpha |
| TypeDoc integration | `typedoc-vitepress-theme` (pre-step) | Official recommendation; predictable |
| Entry point | Single `index.ts` barrel | Documents only public API via re-exports |
| API output location | `apps/doc/api/` (gitignored) | Generated content; rebuilt each deploy |
| Guide pages | Hand-written in `apps/doc/guide/` | Decoupled from generated API docs |
| Version display | Nav dropdown reading `package.json` | Auto-updates on release |
| Sidebar strategy | Multi-sidebar (`/guide/` + `/api/`) | Separation of concerns |
| Search | VitePress local search | No external Algolia dependency |

---

## R4. Vite + Lit + TS Demo App

### Decision
Use **Lit 3.3.x** with **Vite 7.3.x** for the demo app, based on the official `create-vite` lit-ts template structure.

### Rationale
- Lit web components are lightweight, framework-agnostic, and align with the library's browser-native (WebCodecs) philosophy
- Single `<vega-player>` component encapsulates all player behavior
- Shadow DOM isolates demo styling from the host page

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| React | Heavier; unnecessary for a single-component demo page |
| Vanilla JS | No reactive state management; harder to maintain error/loading states |
| Vue | Extra framework dependency; Lit is simpler for web component patterns |
| Svelte | Good option, but Lit is more natural for custom elements |

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Lit version | 3.3.2 (single `lit` package) | Latest stable; no extra packages needed |
| Vite version | 7.3.1 (matches library) | Consistency across monorepo |
| Decorator strategy | `experimentalDecorators: true` + `useDefineForClassFields: false` | Required for Lit 3 decorators |
| Module resolution | `"bundler"` for demo (vs `"NodeNext"` for library) | Correct for Vite-bundled apps |
| Component architecture | Single `<vega-player>` with canvas + controls | Self-contained, reusable |
| Error handling | Mapped error codes to user-friendly messages in `role="alert"` banners | Clear failure path |
| WebCodecs detection | Sync check in `connectedCallback` | Immediate unsupported-browser banner |
| Accessibility | Semantic HTML, aria-labels, native range input, focus-visible | WCAG basics |
| COOP/COEP headers | Enabled in Vite dev server | Forward-compatible with SharedArrayBuffer |
