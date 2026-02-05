# Quickstart: Vega Demo App and GitHub Pages

**Feature**: 002-vega-demo-github-pages  
**Date**: 2025-02-06

## Prerequisites

- Node.js (see repo `package.json` engines, e.g. >= 24)
- npm (or compatible package manager)

## Local Development

1. **Install dependencies** (from repository root):
   ```bash
   npm ci
   ```

2. **Build the Vega library** (required before running the demo):
   ```bash
   npm run build
   ```

3. **Run the demo app** (exact command depends on implementation; one of):
   - From root: `npm run dev:demo` (if added), or
   - From `examples/`: `npm run dev` (if examples has its own package.json and Vite config)

   The demo will be available at a local URL (e.g. `http://localhost:5173/`). Open the example selector, then choose “Audio & Video” to play sample media or upload an MP4. The demo is designed so a first-time visitor can start playing sample video or audio within 30 seconds of opening the page (SC-001).

4. **Quality gate** (after any code change):
   ```bash
   npm run format
   npm run lint
   npm run typecheck
   npm test
   ```

## Building for Production (and GitHub Pages)

1. Build the library: `npm run build`
2. Build the demo with **base path** set for GitHub Pages (e.g. `base: '/vega/'` for repo `vega`):
   - Example: `npm run build:demo` or `cd examples && npm run build`
3. The demo build output (e.g. `examples/dist/` or `dist-demo/`) is the artifact to deploy. The GitHub Action workflow will run these steps and deploy the result to GitHub Pages.

## Deployment (GitHub Pages)

- A GitHub Actions workflow (e.g. `.github/workflows/deploy-pages.yml`) builds the library and demo and deploys the demo to GitHub Pages.
- **One-time setup**: Enable GitHub Pages in the repo (**Settings → Pages → Source**: “GitHub Actions”). This is a manual step; the workflow then deploys on each run (see tasks.md T020).
- After a successful run, the demo is available at `https://<owner>.github.io/<repo>/` (e.g. `https://gyeonghokim.github.io/vega/`). Hash routes work as defined in [contracts/demo-routing.md](contracts/demo-routing.md).

## Tests and Fixtures

- **Unit / integration**: `npm test` (Vitest). Library tests live under `tests/`; demo E2E tests load the demo app and assert playback behavior.
- **E2E**: Run in a real browser (Vitest + Playwright Chromium). Fixtures: `tests/fixtures/h264.mp4` (and optional sample media under `examples/public/`). E2E tests verify spec scenarios: load sample or fixture, play, assert state and optionally canvas. See [research.md](research.md) and [001-webcodecs-video-adaptor/quickstart.md](../001-webcodecs-video-adaptor/quickstart.md) for strategy.
- **Fixtures**: Do not add new `biome-ignore` or `ts-ignore` in demo or test code; fixtures directory remains excluded by path in `biome.json` (binary/large files only).

## Project Layout (reference)

| Path              | Purpose |
| ----------------- | ------- |
| `src/`            | Vega library source |
| `examples/`       | React + TypeScript + Vite demo SPA (replaces `minimal.html`) |
| `tests/fixtures/` | MP4 and raw frame fixtures for tests and optional demo samples |
| `.github/workflows/ci.yml`        | Format, lint, typecheck, test |
| `.github/workflows/deploy-pages.yml` | Build demo, deploy to GitHub Pages |
