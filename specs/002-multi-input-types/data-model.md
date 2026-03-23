# Data Model: Multi-Kind Media Load Inputs

**Feature Branch**: `002-multi-input-types`  
**Date**: 2025-03-23

## Entities

### MediaInput (New)

Union type representing all accepted load input forms.

```typescript
type MediaInput =
  | string                         // URL string
  | URL                            // URL object
  | File                           // File from file picker
  | Blob                           // In-memory blob
  | ArrayBuffer                    // Raw byte buffer
  | ArrayBufferView                // Uint8Array, DataView, etc.
  | ReadableStream<Uint8Array>     // Byte stream
  | Source;                        // mediabunny Source pass-through
```

**Validation rules**:
- `string`: Must be a valid URL (validated at fetch time by mediabunny's UrlSource)
- `URL`: Standard web platform URL object
- `File`/`Blob`: Must contain valid media bytes (validated at parse time)
- `ArrayBuffer`/`ArrayBufferView`: Must be non-empty and contain valid media bytes
- `ReadableStream`: Must yield `Uint8Array` chunks assembling valid media bytes
- `Source`: Must be a valid mediabunny Source instance (instanceof check)

**Relationships**: Consumed by `Vega.load()` → mapped to mediabunny `Source` → wrapped in `Input`

---

### VegaOptions (Modified)

```typescript
interface VegaOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;  // unchanged
  rendererType?: RendererType;                  // unchanged, default "2d"
  volume?: number;                              // unchanged, default 1.0
  loop?: boolean;                               // unchanged, default false
  autoplay?: boolean;                           // unchanged, default false
  formats?: InputFormat[];                      // NEW: mediabunny input formats, default [MP4]
}
```

**Changes**:
- **Removed**: `adapter?: VideoFrameAdapter` — replaced by `pipeThrough()` method
- **Added**: `formats?: InputFormat[]` — allows users to specify supported formats for tree-shaking

---

### Vega (Modified Interface)

```typescript
interface Vega {
  // Load — CHANGED signature
  load(source: MediaInput): Promise<MediaInfo>;

  // Playback — unchanged
  play(): Promise<void>;
  pause(): void;
  seek(time: number): Promise<void>;
  stop(): void;

  // Properties — unchanged
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly volume: number;
  readonly muted: boolean;
  readonly state: PlaybackState;
  readonly mediaInfo: MediaInfo | null;

  // Volume — unchanged
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;

  // Frame processing — CHANGED (replaces setAdapter/getAdapter)
  pipeThrough(transform: TransformStream<VideoFrame, VideoFrame>): void;
  clearPipeline(): void;

  // Events — unchanged
  on<E extends VegaEvent>(event: E, callback: VegaEventCallback): void;
  off<E extends VegaEvent>(event: E, callback: VegaEventCallback): void;

  // Lifecycle — unchanged
  destroy(): void;
}
```

**Changes**:
- `load()` accepts `MediaInput` instead of `string | File | Blob`
- `setAdapter()` / `getAdapter()` → `pipeThrough()` / `clearPipeline()`

---

### MediaInfo (Modified)

```typescript
interface MediaInfo {
  duration: number;
  videoTrack?: VideoTrackInfo;
  audioTrack?: AudioTrackInfo;
}
```

**Changes**:
- **Removed**: `isFragmented?: boolean` (mp4box-specific)
- **Removed**: `brands?: string[]` (mp4box-specific)

---

### VideoTrackInfo (Modified)

```typescript
interface VideoTrackInfo {
  codec: string;          // e.g. "avc1.42E01E"
  width: number;          // display width (post aspect-ratio + rotation)
  height: number;         // display height
  codedWidth: number;     // NEW: raw coded pixel width
  codedHeight: number;    // NEW: raw coded pixel height
  frameRate: number;      // from computePacketStats
  rotation: number;       // NEW: 0 | 90 | 180 | 270
  bitrate?: number;
}
```

**Changes**:
- **Added**: `codedWidth`, `codedHeight` (from `InputVideoTrack`)
- **Added**: `rotation` (from `InputVideoTrack.rotation`)

---

### AudioTrackInfo (Unchanged)

```typescript
interface AudioTrackInfo {
  codec: string;
  sampleRate: number;
  channelCount: number;
  bitrate?: number;
}
```

---

### PlaybackState (Unchanged)

```typescript
type PlaybackState =
  | "idle" | "loading" | "ready" | "playing"
  | "paused" | "seeking" | "ended" | "error";
```

---

### VegaEvent (Unchanged)

```typescript
type VegaEvent =
  | "play" | "pause" | "ended" | "seeking" | "seeked"
  | "timeupdate" | "error" | "loadedmetadata" | "canplay"
  | "waiting" | "volumechange";
```

---

### VegaErrorCode (Unchanged)

```typescript
type VegaErrorCode =
  | "LOAD_ERROR" | "DECODE_ERROR" | "DEMUX_ERROR"
  | "RENDER_ERROR" | "ADAPTER_ERROR" | "UNSUPPORTED_FORMAT"
  | "NETWORK_ERROR";
```

Note: `ADAPTER_ERROR` semantics now covers errors from `TransformStream` transforms in the pipeline.

---

## Internal Entities (Not Exported)

### VegaPlayer (Modified)

Internal class implementing `Vega`. Key state changes:

| Field | Before | After |
|---|---|---|
| `worker: Worker \| null` | Worker thread reference | **Removed** |
| `pendingFrames: VideoFrame[]` | Frame buffer from worker | **Removed** |
| `adapter: VideoFrameAdapter \| null` | Frame processor | **Removed** |
| `_lastSource: string \| File \| Blob \| null` | Last loaded source | `_lastSource: MediaInput \| null` |
| — | — | `input: Input \| null` (mediabunny Input) |
| — | — | `videoSampleSink: VideoSampleSink \| null` |
| — | — | `pipeline: TransformStream<VideoFrame, VideoFrame>[]` |
| — | — | `lastRenderedTimestamp: number` |

### Source Mapping (New Internal)

```typescript
function createSource(input: MediaInput, formats: InputFormat[]): Source
```

Maps `MediaInput` → mediabunny `Source`:

| Input type | Source class |
|---|---|
| `string` | `UrlSource` |
| `URL` | `UrlSource` |
| `File` / `Blob` | `BlobSource` |
| `ArrayBuffer` / `ArrayBufferView` | `BufferSource` |
| `ReadableStream` | `ReadableStreamSource` |
| `Source` (mediabunny) | Pass-through |

## Entity Relationship

```
MediaInput ──→ createSource() ──→ Source (mediabunny)
                                    │
                                    ↓
                              Input<Source> (mediabunny)
                                    │
                         ┌──────────┼──────────┐
                         ↓                     ↓
                  InputVideoTrack       InputAudioTrack
                         │                     │
                         ↓                     ↓
                  VideoSampleSink      AudioBufferSink (future)
                         │
                         ↓
                  VideoSample (≈VideoFrame)
                         │
                         ↓
              TransformStream pipeline (optional)
                         │
                         ↓
                  VideoRenderer.draw(frame)
```
