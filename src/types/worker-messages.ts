/**
 * Worker Message Types
 * Defines the communication protocol between main thread and media worker.
 */

import type { MediaInfo } from "./vega.js";

/**
 * Commands sent from main thread to worker.
 */
export type WorkerCommand =
  | InitializeCommand
  | PlayCommand
  | PauseCommand
  | SeekCommand
  | StopCommand
  | UpdateMediaTimeCommand
  | DestroyCommand;

/**
 * Initialize the worker with a media source.
 */
export interface InitializeCommand {
  command: "initialize";
  /** Media source URL or data */
  source: string | ArrayBuffer;
  /** OffscreenCanvas for rendering (optional, for worker-side rendering) */
  canvas?: OffscreenCanvas;
  /** Renderer type to use */
  rendererType?: "2d" | "webgl" | "webgpu";
}

/**
 * Start playback.
 */
export interface PlayCommand {
  command: "play";
  /** Current media time when play was requested */
  mediaTimeSecs: number;
  /** High-resolution timestamp when media time was captured */
  mediaTimeCapturedAtHighResTimestamp: number;
}

/**
 * Pause playback.
 */
export interface PauseCommand {
  command: "pause";
}

/**
 * Seek to a specific time.
 */
export interface SeekCommand {
  command: "seek";
  /** Target time in seconds */
  time: number;
}

/**
 * Stop playback and reset.
 */
export interface StopCommand {
  command: "stop";
}

/**
 * Update the current media time reference.
 */
export interface UpdateMediaTimeCommand {
  command: "update-media-time";
  /** Current media time in seconds */
  mediaTimeSecs: number;
  /** High-resolution timestamp when media time was captured */
  mediaTimeCapturedAtHighResTimestamp: number;
}

/**
 * Destroy the worker and release resources.
 */
export interface DestroyCommand {
  command: "destroy";
}

/**
 * Responses sent from worker to main thread.
 */
export type WorkerResponse =
  | InitializeDoneResponse
  | FrameReadyResponse
  | AudioDataResponse
  | SeekDoneResponse
  | EndedResponse
  | ErrorResponse
  | StatusResponse;

/**
 * Initialization complete response.
 */
export interface InitializeDoneResponse {
  type: "initialize-done";
  /** Parsed media information */
  mediaInfo: MediaInfo;
  /** Audio sample rate */
  sampleRate?: number;
  /** Audio channel count */
  channelCount?: number;
  /** SharedArrayBuffer for audio ring buffer (if using AudioWorklet) */
  sharedArrayBuffer?: SharedArrayBuffer;
}

/**
 * A decoded video frame is ready.
 * The frame is transferred via postMessage.
 */
export interface FrameReadyResponse {
  type: "frame-ready";
  /** The decoded VideoFrame (transferred) */
  frame: VideoFrame;
  /** Presentation timestamp in microseconds */
  timestamp: number;
}

/**
 * Decoded audio data is ready.
 */
export interface AudioDataResponse {
  type: "audio-data";
  /** The decoded AudioData (transferred) */
  audioData: AudioData;
  /** Timestamp in microseconds */
  timestamp: number;
}

/**
 * Seek operation completed.
 */
export interface SeekDoneResponse {
  type: "seek-done";
  /** Actual time seeked to in seconds */
  time: number;
}

/**
 * Playback has ended.
 */
export interface EndedResponse {
  type: "ended";
}

/**
 * An error occurred in the worker.
 */
export interface ErrorResponse {
  type: "error";
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
}

/**
 * Status update from the worker.
 */
export interface StatusResponse {
  type: "status";
  /** Status category */
  category: "demux" | "decode" | "render" | "buffer";
  /** Status message */
  message: string;
}

/**
 * Configuration for video decoder.
 */
export interface VideoDecoderConfigMessage {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  displayWidth?: number;
  displayHeight?: number;
  description?: ArrayBuffer;
  hardwareAcceleration?: "no-preference" | "prefer-hardware" | "prefer-software";
}

/**
 * Configuration for audio decoder.
 */
export interface AudioDecoderConfigMessage {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: ArrayBuffer;
}

/**
 * Sample/chunk information from demuxer.
 */
export interface SampleInfo {
  /** Whether this is a keyframe */
  isSync: boolean;
  /** Composition timestamp in timescale units */
  cts: number;
  /** Decode timestamp in timescale units */
  dts: number;
  /** Duration in timescale units */
  duration: number;
  /** Timescale (ticks per second) */
  timescale: number;
  /** Sample data */
  data: ArrayBuffer;
}
