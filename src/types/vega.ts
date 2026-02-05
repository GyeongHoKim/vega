/**
 * Vega Video Player - Public API Types
 * These types are exposed to library consumers.
 */

import type { RendererType } from "./index.js";

/**
 * Adapter interface for custom VideoFrame processing.
 * Users can implement this to apply effects like fisheye undistortion,
 * super resolution, color grading, etc.
 */
export interface VideoFrameAdapter {
  /**
   * Process a VideoFrame before rendering.
   * The returned frame will be rendered to the canvas.
   * If a new frame is returned, the original frame should be closed by the adapter
   * or the caller will close it.
   *
   * @param frame - The decoded VideoFrame to process
   * @returns The processed VideoFrame (can be the same or a new one)
   */
  process(frame: VideoFrame): VideoFrame | Promise<VideoFrame>;
}

/**
 * Options for creating a Vega player instance.
 */
export interface VegaOptions {
  /** Target canvas element for video rendering */
  canvas: HTMLCanvasElement | OffscreenCanvas;

  /** Renderer backend type. Defaults to "2d" */
  rendererType?: RendererType;

  /** Optional VideoFrame adapter for custom frame processing */
  adapter?: VideoFrameAdapter;

  /** Initial volume (0.0 to 1.0). Defaults to 1.0 */
  volume?: number;

  /** Whether to loop playback. Defaults to false */
  loop?: boolean;

  /** Whether to automatically start playback after loading. Defaults to false */
  autoplay?: boolean;
}

/**
 * Information about a video track.
 */
export interface VideoTrackInfo {
  /** Video codec string (e.g., "avc1.42E01E") */
  codec: string;
  /** Video width in pixels */
  width: number;
  /** Video height in pixels */
  height: number;
  /** Frame rate (frames per second) */
  frameRate: number;
  /** Bitrate in bits per second */
  bitrate?: number;
}

/**
 * Information about an audio track.
 */
export interface AudioTrackInfo {
  /** Audio codec string (e.g., "mp4a.40.2") */
  codec: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of audio channels */
  channelCount: number;
  /** Bitrate in bits per second */
  bitrate?: number;
}

/**
 * Media file information returned after loading.
 */
export interface MediaInfo {
  /** Total duration in seconds */
  duration: number;
  /** Video track information (undefined if no video track) */
  videoTrack?: VideoTrackInfo;
  /** Audio track information (undefined if no audio track) */
  audioTrack?: AudioTrackInfo;
  /** Whether the file is fragmented */
  isFragmented?: boolean;
  /** Container brands (e.g., ["isom", "mp42"]) */
  brands?: string[];
}

/**
 * Event types emitted by the Vega player.
 */
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

/**
 * Event callback function type.
 */
export type VegaEventCallback<T = unknown> = (data?: T) => void;

/**
 * Error event data.
 */
export interface VegaErrorEvent {
  /** Error message */
  message: string;
  /** Original error object */
  error?: Error;
  /** Error code for categorization */
  code?: VegaErrorCode;
}

/**
 * Error codes for categorizing errors.
 */
export type VegaErrorCode =
  | "LOAD_ERROR"
  | "DECODE_ERROR"
  | "DEMUX_ERROR"
  | "RENDER_ERROR"
  | "ADAPTER_ERROR"
  | "UNSUPPORTED_FORMAT"
  | "NETWORK_ERROR";

/**
 * Playback state of the player.
 */
export type PlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "seeking"
  | "ended"
  | "error";

/**
 * Main Vega player interface.
 */
export interface Vega {
  /**
   * Load a media source for playback.
   * @param source - URL string, File, or Blob containing the media
   * @returns Promise resolving to media information
   */
  load(source: string | File | Blob): Promise<MediaInfo>;

  /**
   * Start or resume playback.
   */
  play(): Promise<void>;

  /**
   * Pause playback.
   */
  pause(): void;

  /**
   * Seek to a specific time.
   * @param time - Target time in seconds
   */
  seek(time: number): Promise<void>;

  /**
   * Stop playback and reset to the beginning.
   */
  stop(): void;

  /** Current playback time in seconds */
  readonly currentTime: number;

  /** Total duration in seconds */
  readonly duration: number;

  /** Whether playback is paused */
  readonly paused: boolean;

  /** Whether playback has ended */
  readonly ended: boolean;

  /** Current volume (0.0 to 1.0) */
  readonly volume: number;

  /** Whether audio is muted */
  readonly muted: boolean;

  /** Current playback state */
  readonly state: PlaybackState;

  /** Loaded media information */
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
   * Set or replace the VideoFrame adapter.
   * @param adapter - New adapter or null to remove
   */
  setAdapter(adapter: VideoFrameAdapter | null): void;

  /**
   * Get the current VideoFrame adapter.
   */
  getAdapter(): VideoFrameAdapter | null;

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

  /**
   * Destroy the player and release all resources.
   */
  destroy(): void;
}
