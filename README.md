# Vega

See more. See better. See Vega

Lightweight library that renders decoded **VideoFrame** (WebCodecs API) to HTML Canvas. Three backends: **2D**, **WebGL**, and **WebGPU**.

## Install

```sh
npm install @gyeonghokim/vega
```

## Usage

```typescript
import { VideoRendererFactory } from "@gyeonghokim/vega";

const canvas = document.querySelector("canvas");
const renderer = VideoRendererFactory.create(canvas, { type: "2d" });

// For each decoded frame (e.g. from VideoDecoder):
renderer.draw(videoFrame);
```

- **type**: `"2d"` (default) | `"webgl"` | `"webgpu"`. Use `"2d"` for broad support; WebGL/WebGPU when available for performance.
- **Frame ownership**: The library **closes the frame** after `draw()`. Do not use the same `VideoFrame` twice.

## API

- **VideoRendererFactory.create(canvas, options?)**  
  Returns a `VideoRenderer`. Default `type` is `"2d"`. Throws when the requested backend is unavailable.
- **VideoRenderer.draw(frame)**  
  Draws the `VideoFrame` to the canvas. **WebGPU** backend returns a `Promise<void>`; 2D and WebGL are synchronous. The library may close the frame after use.

## Bundle size

After building with `npm run build`, inspect `dist/` (e.g. `vega.js`). The library is kept small and focused on rendering only.

## Supported pixel formats

The library accepts any `VideoFrame` from WebCodecs. Input pixel formats (per [WebCodecs VideoPixelFormat](https://w3c.github.io/webcodecs/#enumdef-videopixelformat)) that can be rendered include:

| Chroma | Format   | Description        |
|--------|----------|--------------------|
| 4:2:0  | I420     | Y, U, V (planar)   |
| 4:2:0  | I420A    | Y, U, V, A         |
| 4:2:0  | NV12     | Y, UV (interleaved)|
| 4:2:2  | I422     | Y, U, V            |
| 4:4:4  | I444     | Y, U, V            |
| 4:4:4  | I444A    | Y, U, V, A         |
| 4:4:4  | RGBA     | Red, Green, Blue, Alpha |
| 4:4:4  | RGBX     | R, G, B, padding (opaque) |
| 4:4:4  | BGRA     | Blue, Green, Red, Alpha |
| 4:4:4  | BGRX     | B, G, R, padding (opaque) |

## Raw ↔ VideoFrame converter

For loading or saving raw binary frames (e.g. ffmpeg-decoded buffers), use the converter helpers. Buffer layout must be tightly packed per WebCodecs plane order.

```typescript
import {
  rawToVideoFrame,
  videoFrameToRaw,
  getRawByteLength,
  type SupportedPixelFormat,
} from "@gyeonghokim/vega";

// Raw buffer → VideoFrame (e.g. from fetch or file)
const raw = await (await fetch("frame_1920x1080_rgba.raw")).arrayBuffer();
const frame = rawToVideoFrame(raw, "RGBA", 1920, 1080, { timestamp: 0 });
renderer.draw(frame);

// VideoFrame → raw buffer (same format as frame)
const buffer = await videoFrameToRaw(frame);

// Byte length for a format and size
const bytes = getRawByteLength("I420", 1920, 1080); // 3110400
```

Supported format names: `I420`, `I420A`, `I422`, `I444`, `I444A`, `NV12`, `RGBA`, `RGBX`, `BGRA`, `BGRX` (8-bit only).

## Edge cases and supported formats

- **Supported input**: Any `VideoFrame` from WebCodecs (e.g. from `VideoDecoder`). Canvas is resized to the frame’s display dimensions.
- **Frame closed or invalid**: Do not call `draw()` with a frame you have already closed, or after the frame has been invalidated. The library may close the frame after drawing; do not use that frame again.
- **Canvas detached**: If the canvas is removed from the DOM, drawing may have no visible effect until it is attached again.
- **Backend unavailable**: `create()` throws when the requested backend (`"2d"`, `"webgl"`, or `"webgpu"`) is not available in the current environment (e.g. WebGPU not enabled). Use `"2d"` for the widest support.

## Development

```sh
npm install
npm run format
npm run lint
npm run typecheck
npm test
npm run build
```

## License

MIT
