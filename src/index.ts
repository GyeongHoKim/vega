/**
 * Vega - WebCodecs-based Video Player
 *
 * A lightweight video player that uses WebCodecs API for decoding
 * and allows custom VideoFrame processing through adapters.
 */

// ============ Public API - Vega Player ============
export { createVega } from "./vega.js";

export type {
  Vega,
  VegaOptions,
  VideoFrameAdapter,
  MediaInfo,
  VideoTrackInfo,
  AudioTrackInfo,
  VegaEvent,
  VegaEventCallback,
  VegaErrorEvent,
  VegaErrorCode,
  PlaybackState,
} from "./types/vega.js";

// ============ Utility Functions ============
// These are useful for users who want to work with raw video data
export {
  getRawByteLength,
  rawToVideoFrame,
  videoFrameToRaw,
  type RawToVideoFrameInit,
  type SupportedPixelFormat,
} from "./convert.js";

// ============ Internal Types (for advanced use cases) ============
// VideoRenderer is kept as internal implementation detail
// Users should use the Vega interface instead
