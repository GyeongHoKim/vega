# Vega Public API Contract

**Feature**: 001-webcodecs-video-adaptor  
**Phase**: 1  
**Date**: 2025-02-06

This document describes the public API surface that the implementation must uphold. Tests (especially E2E) should assert behavior against this contract.

## Entry Point

- **createVega(options: VegaOptions): Vega**  
  Creates and returns a Vega player instance. Does not load media until `load()` is called.

## VegaOptions

| Property       | Type                    | Required | Default  | Description |
|----------------|-------------------------|----------|----------|-------------|
| canvas         | HTMLCanvasElement \| OffscreenCanvas | Yes | — | Target for video rendering. |
| rendererType   | `"2d"` \| `"webgl"` \| `"webgpu"` | No | `"2d"` | Renderer backend. |
| adapter        | VideoFrameAdapter \| null | No | null | Optional frame processor. |
| volume         | number                  | No | 1.0 | 0.0–1.0. |
| loop           | boolean                 | No | false | Loop playback. |
| autoplay       | boolean                 | No | false | Start after load. |

## Vega (Instance) Interface

### Lifecycle & Loading

- **load(source: string \| File \| Blob): Promise<MediaInfo>**  
  Loads the given source. Resolves with media info on success. Rejects or emits `error` on failure. Transitions state to `loading` then `ready` or `error`.

### Playback Control

- **play(): Promise<void>**  
  Start or resume playback. Idempotent when already playing.
- **pause(): void**  
  Pause playback.
- **seek(time: number): Promise<void>**  
  Seek to time in seconds. Valid range [0, duration].
- **stop(): void**  
  Stop and reset to beginning (time 0, paused).

### Read-only Properties

- **currentTime: number** — Current playback position (seconds).
- **duration: number** — Total duration (seconds); 0 if not loaded.
- **paused: boolean**
- **ended: boolean**
- **volume: number** — 0.0–1.0.
- **muted: boolean**
- **state: PlaybackState** — One of: idle, loading, ready, playing, paused, seeking, ended, error.
- **mediaInfo: MediaInfo \| null** — Set after successful load.

### Volume / Adapter

- **setVolume(volume: number): void**
- **setMuted(muted: boolean): void**
- **setAdapter(adapter: VideoFrameAdapter \| null): void**
- **getAdapter(): VideoFrameAdapter \| null**

### Events

- **on(event, callback): void** / **off(event, callback): void**  
  Events: `play`, `pause`, `ended`, `seeking`, `seeked`, `timeupdate`, `error`, `loadedmetadata`, `canplay`, `waiting`, `volumechange`.  
  `error` callback receives `VegaErrorEvent` (message, error?, code?).

### Cleanup

- **destroy(): void**  
  Release resources (worker, audio, render loop). Instance must not be used after destroy.

## VideoFrameAdapter

- **process(frame: VideoFrame): VideoFrame \| Promise<VideoFrame>**  
  Called for each decoded frame when set. Returned frame is used for display. Optional; when null, frames are shown as-is.

## MediaInfo

- **duration: number**
- **videoTrack?: VideoTrackInfo** — codec, width, height, frameRate, bitrate?
- **audioTrack?: AudioTrackInfo** — codec, sampleRate, channelCount, bitrate?
- **isFragmented?: boolean**
- **brands?: string[]**

## Error Handling Contract

- Invalid or unsupported source: `load()` rejects and/or `error` event with appropriate `VegaErrorCode` (e.g. LOAD_ERROR, UNSUPPORTED_FORMAT). Player transitions to `error` state; user gets clear message (FR-006).
- Adapter throw or invalid output: Handled without crashing playback (e.g. skip frame or surface via error event); behavior must be defined and testable.

## Sync Contract

- Video and audio stay synchronized during normal playback and after seek (FR-007). E2E tests may assert that after play and after seek, state and time are consistent and frames advance.
