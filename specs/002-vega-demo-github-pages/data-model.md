# Data Model: Vega Demo Application

**Feature**: 002-vega-demo-github-pages  
**Phase**: 1  
**Date**: 2025-02-06

## Entities

### Route (hash route)

- **Concept**: A single “page” in the demo SPA identified by the hash (e.g. `#/`, `#/audio-video`).
- **Attributes**: Route id (string, e.g. `""` or `"audio-video"`), human-readable label, component or view to render.
- **Validation**: Unknown hash defaults to example selector (e.g. `#/`). No persistence; routing is client-only.
- **State transitions**: User navigates by changing hash; app re-renders the corresponding example view.

### Sample media

- **Concept**: Predefined video or audio asset offered by the demo for one-click play (FR-002).
- **Attributes**: Label, URL or path (e.g. `/sample.mp4`, `/sample.aac` or path under `examples/public/`), type (video | audio).
- **Validation**: At least one sample video and one sample audio (or one combined asset) must be available. If load fails, show clear message (FR-007).
- **Relationships**: Referenced by the Audio & Video example view; not persisted.

### User-uploaded file (session)

- **Concept**: The file selected by the user via the upload control for playback in the current session (FR-003).
- **Attributes**: File object (or Blob/URL derived from it), optional display name; not stored on server.
- **Validation**: Accept only types that the player can load (e.g. MP4). Invalid or unsupported file → clear error, no broken state (FR-006).
- **Relationships**: Replaces “current source” for the player in the Audio & Video view until a new file is selected or the page is left. No persistence.

### Playback session (per example view)

- **Concept**: The Vega player instance and its state while the user is on an example that uses it (e.g. Audio & Video).
- **Attributes**: Same as Vega’s playback session (state, currentTime, duration, etc.) per `specs/001-webcodecs-video-adaptor/contracts/vega-api.md` and data-model. One player instance per example view; create on mount, destroy on unmount.
- **Validation**: All playback behavior and errors follow Vega API contract and FR-004, FR-006, FR-007.

## Relationships

- **Route** → **Sample media**: The Audio & Video route references one or more sample media entries.
- **Route** → **User-uploaded file**: The Audio & Video route provides the upload control; selected file becomes the current source for that view’s player.
- **Route** → **Playback session**: Each example that uses Vega (e.g. Audio & Video) owns one Vega instance and its lifecycle.

## Out of Scope

- User accounts, server-side storage, or persistence of uploads.
- Analytics or telemetry (no requirement in spec).
- Backend API; demo is client-only.
