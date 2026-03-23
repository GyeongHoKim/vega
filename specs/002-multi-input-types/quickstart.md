# Quickstart: Vega with Mediabunny

**Feature Branch**: `002-multi-input-types`  
**Date**: 2025-03-23

## Installation

```bash
npm install @gyeonghokim/vega
```

The `mediabunny` dependency is bundled internally — no separate install needed.

## Basic Usage

### Load from a URL

```typescript
import { createVega } from '@gyeonghokim/vega';

const player = createVega({
  canvas: document.querySelector('canvas')!,
});

await player.load('https://example.com/video.mp4');
player.play();
```

### Load from a File (file picker)

```typescript
const fileInput = document.querySelector<HTMLInputElement>('#file-input');
fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    await player.load(file);
    player.play();
  }
});
```

### Load from an ArrayBuffer

```typescript
const response = await fetch('/video.mp4');
const buffer = await response.arrayBuffer();
await player.load(buffer);
player.play();
```

### Load from a Uint8Array

```typescript
const uint8 = new Uint8Array(buffer);
await player.load(uint8);
player.play();
```

### Load from a URL object

```typescript
const url = new URL('https://example.com/video.mp4');
await player.load(url);
player.play();
```

### Load from a ReadableStream

```typescript
const response = await fetch('/video.mp4');
const stream = response.body!; // ReadableStream<Uint8Array>
await player.load(stream);
player.play();
```

### Load from a mediabunny Source (advanced)

```typescript
import { BlobSource } from 'mediabunny';

const source = new BlobSource(file, { maxCacheSize: 32 * 1024 * 1024 });
await player.load(source);
player.play();
```

## Frame Processing with `pipeThrough`

The `pipeThrough` API replaces the previous `setAdapter` / `getAdapter` pattern, aligning with the WebCodecs and Streams API conventions.

### Identity Transform

```typescript
const identity = new TransformStream<VideoFrame, VideoFrame>({
  transform(frame, controller) {
    controller.enqueue(frame);
  },
});

player.pipeThrough(identity);
```

### Grayscale Effect

```typescript
const grayscale = new TransformStream<VideoFrame, VideoFrame>({
  async transform(frame, controller) {
    const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(frame, 0, 0);
    frame.close();

    const newFrame = new VideoFrame(canvas, {
      timestamp: frame.timestamp,
    });
    controller.enqueue(newFrame);
  },
});

player.pipeThrough(grayscale);
```

### Chaining Multiple Transforms

```typescript
player.pipeThrough(denoiseTransform);
player.pipeThrough(colorGradeTransform);
player.pipeThrough(overlayTransform);
```

Frames flow through transforms in the order they were added.

### Clearing the Pipeline

```typescript
player.clearPipeline();
```

## Playback Controls

```typescript
await player.play();
player.pause();
await player.seek(10.5);  // seek to 10.5 seconds
player.stop();

console.log(player.currentTime);  // seconds
console.log(player.duration);     // seconds
console.log(player.state);        // 'idle' | 'loading' | 'ready' | 'playing' | ...
```

## Events

```typescript
player.on('loadedmetadata', (info) => {
  console.log('Duration:', info.duration);
  console.log('Video:', info.videoTrack?.width, 'x', info.videoTrack?.height);
});

player.on('timeupdate', () => {
  console.log('Time:', player.currentTime);
});

player.on('error', (e) => {
  console.error('Error:', e.message, e.code);
});

player.on('ended', () => {
  console.log('Playback finished');
});
```

## Error Handling

All input types surface clear errors for invalid/unplayable media:

```typescript
try {
  await player.load(invalidBlob);
} catch (e) {
  console.error('Load failed:', e.message);
  console.log(player.state); // 'error'
}
```

## Migration from Previous API

### Adapter → `pipeThrough`

**Before:**
```typescript
player.setAdapter({
  process(frame: VideoFrame): VideoFrame {
    // ... process frame
    return frame;
  },
});
```

**After:**
```typescript
player.pipeThrough(new TransformStream<VideoFrame, VideoFrame>({
  transform(frame, controller) {
    // ... process frame
    controller.enqueue(frame);
  },
}));
```

### Clearing transforms

**Before:**
```typescript
player.setAdapter(null);
```

**After:**
```typescript
player.clearPipeline();
```

## Custom Formats

By default, Vega supports MP4 files. To support additional formats:

```typescript
import { createVega } from '@gyeonghokim/vega';
import { ALL_FORMATS } from 'mediabunny';

const player = createVega({
  canvas: document.querySelector('canvas')!,
  formats: ALL_FORMATS, // MP4, WebM, MKV, OGG, etc.
});
```
