# Demo App Routing Contract

**Feature**: 002-vega-demo-github-pages  
**Phase**: 1  
**Date**: 2025-02-06

This document defines the hash-based routing contract for the Vega demo SPA. Tests and implementation must align with these routes.

## Hash Routes

| Hash       | Route id    | Description                          |
| ---------- | ----------- | ------------------------------------ |
| `#/`       | `""` or `"/"` | Example selector (first screen)    |
| `#/audio-video` | `audio-video` | Audio & Video playback example   |

Future examples (e.g. custom adapter) will get additional entries (e.g. `#/custom-adapter`).

## Behavior

- **On load**: If hash is empty or unknown, show the example selector. If hash is `#/audio-video`, show the Audio & Video example view directly.
- **Navigation**: Selecting an example from the selector sets `window.location.hash` to the route (e.g. `#/audio-video`). Browser back/forward work with hash changes.
- **Deep link**: Visiting `https://<origin>/<base>#/audio-video` must render the Audio & Video example without requiring a click on the selector.

## Vega API Usage

The demo MUST use the Vega player per the public API contract in [001-webcodecs-video-adaptor/contracts/vega-api.md](../../001-webcodecs-video-adaptor/contracts/vega-api.md). No additional API contract is defined here; the demo is a consumer of that API for load, play, pause, seek, events, and error handling (FR-001–FR-007).
