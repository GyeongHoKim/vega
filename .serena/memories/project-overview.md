# Vega – Project Overview

- **Purpose**: WebCodecs-based MP4 video player with custom frame processing (VideoFrame adaptor). Users can pass an adaptor (e.g. fisheye undistort, super resolution) and get decoding/sync handled by the player; default output is canvas + Web Audio.
- **Platform**: Browser only (WebCodecs, Canvas, Web Audio, optional WebGL/WebGPU renderers).
- **Entry**: `createVega(options)` from `src/vega.ts`; build output `dist/vega.js` (module) and `dist/vega.umd.cjs`.
- **Key source areas**: `src/vega.ts` (player), `src/worker/` (demux/decode), `src/renderers/`, `src/audio/`, `src/demuxer/`, `src/types/vega.ts` (public API types).
