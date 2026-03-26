# Research: Mediabunny Migration for Multi-Input Types

**Feature Branch**: `002-multi-input-types`  
**Date**: 2025-03-23  

## 1. Mediabunny Library Analysis

### 1.1 Overview

Mediabunny is a zero-dependency, pure TypeScript media toolkit for reading, writing, and converting media files in the browser. It provides hardware-accelerated decoding/encoding via WebCodecs API, lazy/on-demand file reading, and is extremely tree-shakable.

**Source**: https://mediabunny.dev/llms.txt  
**Types**: https://mediabunny.dev/mediabunny.d.ts  
**npm**: `mediabunny`

### 1.2 Input Sources → User Story Mapping

Mediabunny's input source classes map **exactly** to the four delivery forms in the spec:

| User Story | Input Type | Mediabunny Source | Constructor |
|---|---|---|---|
| US1 (P1) | File, Blob | `BlobSource` | `new BlobSource(blob)` |
| US1 (P1) | ArrayBuffer, Uint8Array | `BufferSource` | `new BufferSource(buffer)` |
| US2 (P2) | string URL, URL object | `UrlSource` | `new UrlSource(url)` |
| US3 (P3) | ReadableStream | `ReadableStreamSource` | `new ReadableStreamSource(stream)` |

All sources extend the abstract `Source` class with `getSizeOrNull()`, `getSize()`, and an `onread` callback.

### 1.3 Reading Pipeline

```
Source → Input(options: { formats, source }) → InputTrack[] → MediaSink → decoded data
```

1. **`Input`**: Root object for all read operations. Zero-cost construction (lazy reads).
2. **`InputVideoTrack`**: Provides codec info, dimensions, frame rate, decoder config.
3. **`VideoSampleSink`**: Decodes video frames on demand via `getSample(timestamp)` and `samples()` async iterator.
4. **`CanvasSink`**: Higher-level abstraction that draws decoded frames directly to canvas.
5. **`AudioSampleSink` / `AudioBufferSink`**: For audio data extraction.
6. **`EncodedPacketSink`**: Raw encoded packet access for custom decode logic.

### 1.4 Key Mediabunny Types for Vega

- **`VideoSample`**: Wrapper around `VideoFrame` with timestamp/duration in seconds, `draw(ctx, x, y)`, `close()`, `clone()`.
- **`Input<S extends Source>`**: Central read class with `getTracks()`, `getPrimaryVideoTrack()`, `computeDuration()`, `getMetadataTags()`, `dispose()`.
- **`InputVideoTrack`**: `codedWidth`, `codedHeight`, `displayWidth`, `displayHeight`, `rotation`, `codec`, `getDecoderConfig()`, `canDecode()`, `computePacketStats()`.
- **`InputAudioTrack`**: `numberOfChannels`, `sampleRate`, `getDecoderConfig()`.
- **`VideoSampleSink`**: `getSample(timestamp)`, `samples(start?, end?)`, `samplesAtTimestamps(timestamps)`.

### 1.5 Format Support

For MP4 specifically: `import { MP4 } from 'mediabunny'` singleton. Using `[MP4]` instead of `ALL_FORMATS` for optimal tree shaking since Vega currently only supports MP4.

### 1.6 Threading Model

Mediabunny handles all demuxing and decoding internally. It uses an optimized pipelined design with automatic backpressure. **No explicit worker thread management is needed by the consumer.** This means Vega's custom worker thread (`src/worker/media-worker.ts`) becomes unnecessary.

---

## 2. Current Vega Architecture (Pre-Migration)

### 2.1 Load → Demux → Decode → Render Pipeline

```
Main Thread                          Worker Thread (media-worker.ts)
─────────────────                    ────────────────────────────────
load(source) ──postMessage──→        MP4DemuxerWorker (mp4box.createFile())
                                     │ URL → fetch + appendBuffer
                                     │ ArrayBuffer → direct appendBuffer
                                     ↓
                                     VideoDecoderWrapper (WebCodecs VideoDecoder)
                                     │ MP4Sample → EncodedVideoChunk → decode
                                     ↓
                                     videoFrameBuffer[]
                                     │ rAF loop picks best frame
                 ←──postMessage──    frame-ready (VideoFrame transfer)
renderFrame()
│ pendingFrames buffer
│ adapter?.process(frame)
│ renderer.draw(frame)
```

### 2.2 Files to Remove (MP4Box.js + Worker)

| File | Reason |
|---|---|
| `src/worker/media-worker.ts` | Entire demux+decode worker — replaced by mediabunny |
| `src/worker/video-renderer.ts` | Unused buffered decoder helper |
| `src/demuxer/mp4-demuxer.ts` | Unused pull-style demuxer |
| `src/demuxer/mp4box-types.ts` | MP4Box type definitions |
| `src/mp4box.d.ts` | Module declaration for mp4box |
| `src/types/worker-messages.ts` | Main↔Worker message types |
| `src/audio/audio-renderer.ts` | SharedArrayBuffer-based renderer (never wired) |
| `src/audio/audio-worklet-processor.ts` | Supporting worklet (never wired) |
| `src/audio/ring-buffer.ts` | SAB ring buffer (never wired) |

### 2.3 Files to Modify

| File | Changes |
|---|---|
| `src/vega.ts` | Remove worker, use mediabunny Input + sinks, new load signature, pipeThrough API |
| `src/types/vega.ts` | New load input type, replace VideoFrameAdapter with TransformStream, new MediaInfo |
| `src/index.ts` | Update exports (add mediabunny re-exports if needed) |
| `package.json` | Replace `mp4box` dep with `mediabunny`, remove worker-related vite config |
| `vite.config.ts` | Remove `optimizeDeps.exclude: ["mp4box"]`, worker config |

### 2.4 Files to Add

| File | Purpose |
|---|---|
| `src/input/create-source.ts` | Maps user input → mediabunny Source instance |

---

## 3. Interface Migration Decisions

### 3.1 `load()` Signature Change

**Before**: `load(source: string | File | Blob): Promise<MediaInfo>`

**After**: `load(source: MediaInput): Promise<MediaInfo>`

Where:
```typescript
type MediaInput =
  | string
  | URL
  | File
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | ReadableStream<Uint8Array>;
```

**Decision**: Extend the union type. Users pass raw values; Vega internally creates the appropriate mediabunny `Source`.
**Rationale**: Matches spec FR-001 through FR-006 directly. Backward compatible — existing `string | File | Blob` are subsets.

### 3.2 Adapter → `pipeThrough` TransformStream

**Before**:
```typescript
interface VideoFrameAdapter {
  process(frame: VideoFrame): VideoFrame | Promise<VideoFrame>;
}
setAdapter(adapter: VideoFrameAdapter | null): void;
getAdapter(): VideoFrameAdapter | null;
```

**After**:
```typescript
pipeThrough(transform: TransformStream<VideoFrame, VideoFrame>): void;
clearPipeline(): void;
```

**Decision**: Replace adapter pattern with `pipeThrough` accepting a `TransformStream<VideoFrame, VideoFrame>`. Multiple `pipeThrough` calls chain transforms. `clearPipeline()` resets.  
**Rationale**: Aligns with WebCodecs patterns and Streams API. Users can compose transforms naturally. `TransformStream` has built-in backpressure.  
**Backward compatibility**: The `VideoFrameAdapter` interface is removed. A migration helper or compatibility shim could wrap adapters into TransformStreams, but given this is a 0.x library, a clean break is preferred.

### 3.3 `MediaInfo` Alignment

**Before** (Vega-specific):
```typescript
interface MediaInfo {
  duration: number;
  videoTrack?: VideoTrackInfo;
  audioTrack?: AudioTrackInfo;
  isFragmented?: boolean;
  brands?: string[];
}
```

**After**: Derived from mediabunny's `Input` at load time, but keep a Vega-specific shape for backward compat:
```typescript
interface MediaInfo {
  duration: number;
  videoTrack?: VideoTrackInfo;
  audioTrack?: AudioTrackInfo;
}
```

`isFragmented` and `brands` were mp4box-specific and can be dropped. Track info fields are populated from `InputVideoTrack` / `InputAudioTrack`.

### 3.4 Seek Implementation

**Before**: `seek(time)` → worker `seek` command → flush decoder → rebuild buffer → `seek-done`.

**After**: `seek(time)` → `videoSampleSink.getSample(time)` to get the exact frame, then resume the `samples()` iterator from that point.

**Decision**: Use `VideoSampleSink.getSample(time)` for random access seeking. Mediabunny handles all the key-frame seeking, decoder flushing, and re-decoding internally.

### 3.5 Worker Thread Elimination

**Decision**: Remove the entire worker thread. Mediabunny manages its own internal pipeline.  
**Rationale**: Mediabunny's design handles demuxing and decoding efficiently on the main thread (or internally offloads as it sees fit). Our custom worker added complexity for managing MP4Box.js demuxing and WebCodecs decoding — mediabunny encapsulates all of this.

### 3.6 Allowing Direct Mediabunny Types

**Decision**: Users may optionally pass mediabunny `Source` instances directly via `load()`.  
**Rationale**: Per user requirement — "사용자로 하여금 mediabunny의 타입을 그대로 사용하는 방식도 허용". Power users who want fine-grained control (e.g., `BlobSourceOptions.maxCacheSize`) can construct their own `Source`.

Updated load signature:
```typescript
type MediaInput =
  | string
  | URL
  | File
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | ReadableStream<Uint8Array>
  | Source;  // mediabunny Source pass-through
```

---

## 4. Folder Structure Decision

### 4.1 Current → Target

The migration simplifies the codebase significantly by removing the worker layer and demuxer layer:

```
src/
├── index.ts              # Public exports (updated)
├── vega.ts               # VegaPlayer (refactored — no worker, uses mediabunny)
├── input/
│   └── create-source.ts  # MediaInput → mediabunny Source mapping
├── types/
│   ├── index.ts          # VideoRenderer, RendererType
│   └── vega.ts           # Vega, VegaOptions, MediaInfo, etc.
├── renderers/
│   ├── renderer-2d.ts    # Unchanged
│   ├── renderer-webgl.ts # Unchanged
│   └── renderer-webgpu.ts# Unchanged
├── factory.ts            # Unchanged
└── convert.ts            # Unchanged
```

**Deleted directories**: `src/worker/`, `src/demuxer/`, `src/audio/`

**Decision**: Flatten to a simple structure. `src/input/` is the only new directory — isolates the input-source mapping logic.  
**Rationale**: Mediabunny absorbs the complexity previously held in `worker/` and `demuxer/`. The renderers remain unchanged since they receive `VideoFrame` objects regardless of how they were decoded.

---

## 5. Test Strategy

### 5.1 Scope

Per user requirement: "mediabunny의 동작은 이미 검증되어있으므로 우리의 테스트 범위가 아니며 마이그레이션 이후 기존 테스트만 통과하는 것을 목표로 한다."

- **In scope**: All existing E2E tests in `tests/integration/vega-playback.test.ts` must pass.
- **Out of scope**: Testing mediabunny internals (demux correctness, decode correctness).
- **Adaptation needed**: Tests that reference `VideoFrameAdapter` will need updating for the new `pipeThrough` API.

### 5.2 Test Modifications

| Test | Change Needed |
|---|---|
| `creates player with canvas` | No change |
| `loads fixture MP4, play()...` | No change (load URL string) |
| `canvas has non-zero pixel data` | No change |
| `pause, seek, play` | No change |
| `identity adapter` | Rewrite to use `pipeThrough` with identity TransformStream |
| `setAdapter after load` | Rewrite to use `pipeThrough` |
| `adapter throws: error surfaced` | Rewrite with TransformStream that errors |
| `load invalid data` | No change (Blob path) |

---

## 6. Dependency Changes

### 6.1 Remove
- `mp4box` (runtime dependency)

### 6.2 Add
- `mediabunny` (runtime dependency — latest version)

### 6.3 Build Config
- Remove `optimizeDeps.exclude: ["mp4box"]` from `vite.config.ts`
- Remove worker entry config from `vite.config.ts`
- Ensure mediabunny is properly bundled (it's pure TS, tree-shakable, should work out of box)

---

## 7. Risk Analysis

| Risk | Mitigation |
|---|---|
| mediabunny's internal threading model may not match our rAF-based playback loop | Use `VideoSampleSink.getSample(time)` per-frame in the rAF loop; mediabunny caches decoded frames internally |
| Bundle size increase from mediabunny | Use tree shaking: only import `Input`, `MP4`, `BlobSource`, `BufferSource`, `UrlSource`, `ReadableStreamSource`, `VideoSampleSink` |
| Breaking change for existing users (adapter API) | Document migration path; provide code example for wrapping old adapters in TransformStream |
| Performance regression without explicit worker | mediabunny's pipelined design is optimized; benchmark before/after |
| ReadableStream source limitations (unsized, sequential only) | Document this constraint; mediabunny's `ReadableStreamSource` docs already note this |
