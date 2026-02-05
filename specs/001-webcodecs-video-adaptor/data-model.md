# Data Model: Vega MP4 Video Player

**Feature**: 001-webcodecs-video-adaptor  
**Phase**: 1  
**Date**: 2025-02-06

## Entities

### Source media

- **Concept**: The MP4 file or blob given to the player (URL string, `File`, or `Blob`).
- **Attributes**: Not persisted as an entity; input to `load()`.
- **Validation**: Must be loadable and parseable as MP4; at least one video or audio track. Invalid/unsupported input leads to error state and user-visible error (FR-006).

### Video frame

- **Concept**: A single decoded image at a point in time; `VideoFrame` (WebCodecs).
- **Attributes**: Pixel data, format, dimensions, timestamp. Input and output of the user’s frame processor (adaptor).
- **Validation**: Frames are produced by the decoder; adaptor must return a valid `VideoFrame` (or equivalent) for display. Invalid or thrown adaptor output is handled per error policy (e.g. skip frame, surface error) without crashing playback.

### Frame processor (adaptor)

- **Concept**: User-defined `VideoFrameAdapter` implementation: one frame in, one frame out (or Promise).
- **Attributes**: `process(frame: VideoFrame): VideoFrame | Promise<VideoFrame>`.
- **Validation**: Optional. When absent, decoded frames are displayed as-is. When present, every decoded frame is passed through before display (FR-008).

### Playback session

- **Concept**: State of one loaded source: loading, decoding, optional processing, and output.
- **Attributes** (logical state):
  - **state**: `PlaybackState` — `idle` | `loading` | `ready` | `playing` | `paused` | `seeking` | `ended` | `error`.
  - **mediaInfo**: `MediaInfo | null` — duration, video track info, audio track info (optional), container metadata.
  - **currentTime**, **duration**, **paused**, **ended**, **volume**, **muted**.
- **Relationships**: One session per player instance; one source per session (load replaces).
- **State transitions**: idle → loading → ready (or error). ready ↔ playing ↔ paused; seeking can overlap. ended when playback reaches end (unless loop). error on unrecoverable failure.

### MediaInfo

- **Fields**: `duration`, `videoTrack?`, `audioTrack?`, `isFragmented?`, `brands?`.
- **VideoTrackInfo**: codec, width, height, frameRate, bitrate?.
- **AudioTrackInfo**: codec, sampleRate, channelCount, bitrate?.
- **Validation**: Returned after successful load; used for UI and seek bounds.

### Error state

- **Concept**: User-visible failure (invalid file, decode error, etc.).
- **Attributes**: `VegaErrorEvent`: message, error?, code? (`VegaErrorCode`: LOAD_ERROR, DECODE_ERROR, DEMUX_ERROR, RENDER_ERROR, ADAPTER_ERROR, UNSUPPORTED_FORMAT, NETWORK_ERROR).
- **Validation**: Invalid or unsupported input must result in clear error, not silent failure (FR-006).

## Relationships

- One **Vega** instance has one **playback session** (current source).
- **Playback session** has zero or one **frame processor** (adaptor).
- **Source media** → (demux/decode) → **video frames** → (optional **adaptor**) → renderer → canvas; audio → Web Audio.

## State Transitions (PlaybackState)

- `idle` → `loading`: `load()` called.
- `loading` → `ready`: load and init succeeded.
- `loading` → `error`: load or init failed.
- `ready` → `playing`: `play()` called.
- `playing` → `paused`: `pause()` called.
- `playing` → `ended`: playback reached end (and not loop).
- `paused` → `playing`: `play()` called.
- `*` → `seeking`: `seek()` called; then back to previous or `playing`/`paused`.
- Any → `error`: unrecoverable error (with `error` event).

All transitions and observable state are part of the public API contract and must be covered by tests where they affect user-facing behavior.
