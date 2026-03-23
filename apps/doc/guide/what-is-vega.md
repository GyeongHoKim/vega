# What is Vega?

Vega is a **WebCodecs-based** video player for the browser. It demuxes MP4 (via the **mediabunny** library) and decodes video with the WebCodecs API, then draws frames to a canvas through pluggable renderers (2D, WebGL, or WebGPU).

## Why Vega?

- **Frame-level control**: Every decoded `VideoFrame` can pass through `TransformStream` stages—color grading, overlays, ML inference, or any effect you need before rendering.
- **Modern stack**: Built for `HTMLCanvasElement` or `OffscreenCanvas`, with TypeScript types across the public API.
- **Multiple backends**: Pick 2D canvas, WebGL, or WebGPU depending on your environment and performance needs.

## Architecture at a glance

1. **Input** — Load from URL, `File`, `Blob`, streams, or other mediabunny-supported sources.
2. **Decode** — WebCodecs decoders produce `VideoFrame` instances.
3. **Pipeline** — Optional `pipeThrough` stages transform frames.
4. **Render** — A renderer draws to your canvas.

For method-level detail, see the [API Reference](/api/).
