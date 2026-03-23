/**
 * Vega Public API Contract
 *
 * This file defines the public TypeScript interfaces that consumers of the
 * @gyeonghokim/vega package will use. It serves as the API contract for the
 * multi-input-types migration.
 *
 * NOTE: This is a design artifact, not compiled source code.
 */

import type { Source, InputFormat } from "mediabunny";

// ─── Input Types ────────────────────────────────────────────────────────────

/**
 * All accepted media input forms for `Vega.load()`.
 *
 * - `string`: URL string (http(s):, blob:, data:)
 * - `URL`: Standard web platform URL object
 * - `File`: From file picker or drag-and-drop
 * - `Blob`: In-memory binary data
 * - `ArrayBuffer`: Full media byte sequence in memory
 * - `ArrayBufferView`: Typed array (Uint8Array, etc.) over a buffer
 * - `ReadableStream<Uint8Array>`: Byte stream (e.g. from fetch, workers)
 * - `Source`: mediabunny Source instance for advanced control
 */
export type MediaInput =
  | string
  | URL
  | File
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | ReadableStream<Uint8Array>
  | Source;

// ─── Options ────────────────────────────────────────────────────────────────

export type RendererType = "2d" | "webgl" | "webgpu";

export interface VegaOptions {
  /** Target canvas element for video rendering. */
  canvas: HTMLCanvasElement | OffscreenCanvas;

  /** Renderer backend type. Defaults to "2d". */
  rendererType?: RendererType;

  /** Initial volume (0.0 to 1.0). Defaults to 1.0. */
  volume?: number;

  /** Whether to loop playback. Defaults to false. */
  loop?: boolean;

  /** Whether to automatically start playback after loading. Defaults to false. */
  autoplay?: boolean;

  /**
   * Mediabunny input formats to support. Defaults to [MP4].
   * Pass ALL_FORMATS to support all container formats mediabunny can read.
   */
  formats?: InputFormat[];
}

// ─── Media Info ─────────────────────────────────────────────────────────────

export interface VideoTrackInfo {
  /** Video codec parameter string (e.g., "avc1.42E01E"). */
  codec: string;
  /** Display width in pixels (after aspect ratio and rotation). */
  width: number;
  /** Display height in pixels (after aspect ratio and rotation). */
  height: number;
  /** Raw coded width in pixels. */
  codedWidth: number;
  /** Raw coded height in pixels. */
  codedHeight: number;
  /** Frame rate in frames per second. */
  frameRate: number;
  /** Clockwise rotation in degrees. */
  rotation: number;
  /** Bitrate in bits per second (when available). */
  bitrate?: number;
}

export interface AudioTrackInfo {
  /** Audio codec parameter string (e.g., "mp4a.40.2"). */
  codec: string;
  /** Sample rate in Hz. */
  sampleRate: number;
  /** Number of audio channels. */
  channelCount: number;
  /** Bitrate in bits per second (when available). */
  bitrate?: number;
}

export interface MediaInfo {
  /** Total duration in seconds. */
  duration: number;
  /** Video track information (undefined if no video track). */
  videoTrack?: VideoTrackInfo;
  /** Audio track information (undefined if no audio track). */
  audioTrack?: AudioTrackInfo;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export type VegaEvent =
  | "play"
  | "pause"
  | "ended"
  | "seeking"
  | "seeked"
  | "timeupdate"
  | "error"
  | "loadedmetadata"
  | "canplay"
  | "waiting"
  | "volumechange";

export type VegaEventCallback<T = unknown> = (data?: T) => void;

export interface VegaErrorEvent {
  message: string;
  error?: Error;
  code?: VegaErrorCode;
}

export type VegaErrorCode =
  | "LOAD_ERROR"
  | "DECODE_ERROR"
  | "DEMUX_ERROR"
  | "RENDER_ERROR"
  | "ADAPTER_ERROR"
  | "UNSUPPORTED_FORMAT"
  | "NETWORK_ERROR";

// ─── Playback State ─────────────────────────────────────────────────────────

export type PlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "seeking"
  | "ended"
  | "error";

// ─── Main Interface ─────────────────────────────────────────────────────────

export interface Vega {
  /**
   * Load a media source for playback.
   *
   * Accepts all standard web binary/stream types, URL strings, URL objects,
   * or a mediabunny Source instance for advanced control.
   *
   * @param source - The media input to load
   * @returns Promise resolving to media information
   */
  load(source: MediaInput): Promise<MediaInfo>;

  /** Start or resume playback. */
  play(): Promise<void>;

  /** Pause playback. */
  pause(): void;

  /**
   * Seek to a specific time.
   * @param time - Target time in seconds
   */
  seek(time: number): Promise<void>;

  /** Stop playback and reset to the beginning. */
  stop(): void;

  /** Current playback time in seconds. */
  readonly currentTime: number;

  /** Total duration in seconds. */
  readonly duration: number;

  /** Whether playback is paused. */
  readonly paused: boolean;

  /** Whether playback has ended. */
  readonly ended: boolean;

  /** Current volume (0.0 to 1.0). */
  readonly volume: number;

  /** Whether audio is muted. */
  readonly muted: boolean;

  /** Current playback state. */
  readonly state: PlaybackState;

  /** Loaded media information. */
  readonly mediaInfo: MediaInfo | null;

  /**
   * Set the playback volume.
   * @param volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume: number): void;

  /**
   * Set muted state.
   * @param muted - Whether to mute audio
   */
  setMuted(muted: boolean): void;

  /**
   * Add a transform stage to the video frame processing pipeline.
   *
   * Each call appends a new TransformStream to the pipeline. Frames flow
   * through all transforms in order before reaching the renderer. This
   * replaces the previous VideoFrameAdapter pattern and aligns with the
   * WebCodecs / Streams API conventions.
   *
   * @param transform - A TransformStream that receives VideoFrame objects
   *   and produces VideoFrame objects. The transform is responsible for
   *   closing input frames when producing new output frames.
   *
   * @example
   * ```ts
   * const grayscale = new TransformStream<VideoFrame, VideoFrame>({
   *   async transform(frame, controller) {
   *     const processed = await applyGrayscale(frame);
   *     frame.close();
   *     controller.enqueue(processed);
   *   }
   * });
   * player.pipeThrough(grayscale);
   * ```
   */
  pipeThrough(transform: TransformStream<VideoFrame, VideoFrame>): void;

  /**
   * Remove all transform stages from the video frame processing pipeline.
   * Frames will be rendered directly after this call.
   */
  clearPipeline(): void;

  /**
   * Register an event listener.
   * @param event - Event type
   * @param callback - Callback function
   */
  on<E extends VegaEvent>(event: E, callback: VegaEventCallback): void;

  /**
   * Remove an event listener.
   * @param event - Event type
   * @param callback - Callback function to remove
   */
  off<E extends VegaEvent>(event: E, callback: VegaEventCallback): void;

  /** Destroy the player and release all resources. */
  destroy(): void;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new Vega player instance.
 * @param options - Player configuration
 * @returns Vega player instance
 */
export declare function createVega(options: VegaOptions): Vega;
