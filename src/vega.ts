/**
 * Vega - Main Video Player Class
 * Entry point for the Vega video player library.
 */

import type {
  Vega,
  VegaOptions,
  VideoFrameAdapter,
  MediaInfo,
  VegaEvent,
  VegaEventCallback,
  PlaybackState,
  VegaErrorEvent,
} from "./types/vega.js";
import type {
  WorkerCommand,
  WorkerResponse,
  FrameReadyResponse,
  InitializeDoneResponse,
} from "./types/worker-messages.js";
import type { VideoRenderer } from "./types/index.js";
import { create as createRenderer } from "./factory.js";
import type { AudioRenderer } from "./audio/audio-renderer.js";

import MediaWorkerUrl from "./worker/media-worker.ts?worker&url";

/**
 * Default options for Vega player.
 */
const DEFAULT_OPTIONS: Partial<VegaOptions> = {
  rendererType: "2d",
  volume: 1.0,
  loop: false,
  autoplay: false,
};

/**
 * Event emitter mixin for Vega.
 */
class EventEmitter {
  private listeners: Map<string, Set<VegaEventCallback>> = new Map();

  on(event: string, callback: VegaEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: VegaEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  protected emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error(`[Vega] Error in ${event} callback:`, e);
      }
    });
  }

  protected removeAllListeners(): void {
    this.listeners.clear();
  }
}

/**
 * VegaPlayer - Implementation of the Vega interface.
 */
class VegaPlayer extends EventEmitter implements Vega {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private renderer: VideoRenderer;
  private adapter: VideoFrameAdapter | null = null;
  private audioRenderer: AudioRenderer | null = null;
  private worker: Worker | null = null;

  private _state: PlaybackState = "idle";
  private _mediaInfo: MediaInfo | null = null;
  private _currentTime = 0;
  private _volume = 1.0;
  private _muted = false;
  private _loop = false;
  /** Last loaded source; used to re-load from start when playing after ended. */
  private _lastSource: string | File | Blob | null = null;

  private playbackStartTime = 0;
  private playbackStartMediaTime = 0;
  private animationFrameId: number | null = null;
  private pendingFrames: VideoFrame[] = [];
  private destroyed = false;

  constructor(options: VegaOptions) {
    super();

    const opts = { ...DEFAULT_OPTIONS, ...options };

    this.canvas = opts.canvas;
    this.adapter = opts.adapter || null;
    this._volume = opts.volume ?? 1.0;
    this._loop = opts.loop ?? false;

    if (this.canvas instanceof HTMLCanvasElement) {
      this.renderer = createRenderer(this.canvas, {
        type: opts.rendererType ?? "2d",
      });
    } else {
      const ctx = this.canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D context for OffscreenCanvas");
      }
      this.renderer = {
        draw: (frame: VideoFrame) => {
          ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
          frame.close();
        },
      };
    }
  }

  async load(source: string | File | Blob): Promise<MediaInfo> {
    if (this.destroyed) {
      throw new Error("Player has been destroyed");
    }

    this._state = "loading";
    this._lastSource = source;

    try {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      for (const frame of this.pendingFrames) {
        frame.close();
      }
      this.pendingFrames = [];

      let sourceData: string | ArrayBuffer;
      if (typeof source === "string") {
        sourceData = source;
      } else {
        sourceData = await source.arrayBuffer();
      }

      this.worker = new Worker(MediaWorkerUrl, { type: "module" });
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = (e) => {
        console.error("[Vega] Worker error:", e);
        this.handleError("Worker error", e.error);
      };

      const mediaInfo = await this.initializeWorker(sourceData);
      this._mediaInfo = mediaInfo;

      this._currentTime = 0;
      this.playbackStartMediaTime = 0;
      this.playbackStartTime = performance.now();

      if (mediaInfo.audioTrack) {
        await this.initializeAudio(mediaInfo);
      }

      this._state = "ready";
      this.emit("loadedmetadata", mediaInfo);
      this.emit("canplay");

      return mediaInfo;
    } catch (error) {
      this._state = "error";
      this.handleError("Load failed", error as Error);
      throw error;
    }
  }

  async play(): Promise<void> {
    if (this._state === "playing") return;
    if (this._state === "ended") {
      if (this._lastSource != null) {
        await this.load(this._lastSource);
      } else {
        await this.seek(0);
        this._state = "ready";
      }
    }
    if (this._state !== "ready" && this._state !== "paused") {
      throw new Error(`Cannot play in state: ${this._state}`);
    }

    this._state = "playing";
    this.playbackStartTime = performance.now();
    this.playbackStartMediaTime = this._currentTime;

    this.sendWorkerCommand({
      command: "play",
      mediaTimeSecs: this._currentTime,
      mediaTimeCapturedAtHighResTimestamp: performance.now() + performance.timeOrigin,
    });

    this.audioRenderer?.play();
    this.startRenderLoop();

    this.emit("play");
  }

  pause(): void {
    if (this._state !== "playing") return;

    this._state = "paused";

    this._currentTime = this.getCurrentPlaybackTime();
    this.sendWorkerCommand({ command: "pause" });
    this.audioRenderer?.pause();
    this.stopRenderLoop();

    this.emit("pause");
  }

  async seek(time: number): Promise<void> {
    if (!this._mediaInfo) {
      throw new Error("No media loaded");
    }

    const wasPlaying = this._state === "playing";
    if (wasPlaying) {
      this.pause();
    }

    this._state = "seeking";
    this.emit("seeking");

    const targetTime = Math.max(0, Math.min(time, this._mediaInfo.duration));

    for (const frame of this.pendingFrames) {
      frame.close();
    }
    this.pendingFrames = [];

    await new Promise<void>((resolve) => {
      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type === "seek-done") {
          this.worker?.removeEventListener("message", handler);
          resolve();
        }
      };
      this.worker?.addEventListener("message", handler);
      this.sendWorkerCommand({ command: "seek", time: targetTime });
    });

    this._currentTime = targetTime;
    this.playbackStartMediaTime = targetTime;
    this.playbackStartTime = performance.now();

    this._state = wasPlaying ? "playing" : "paused";
    this.emit("seeked");

    if (wasPlaying) {
      await this.play();
    }
  }

  stop(): void {
    this.pause();
    this._currentTime = 0;
    this.playbackStartMediaTime = 0;

    this.sendWorkerCommand({ command: "stop" });

    for (const frame of this.pendingFrames) {
      frame.close();
    }
    this.pendingFrames = [];

    this._state = "ready";
  }

  get currentTime(): number {
    if (this._state === "playing") {
      return this.getCurrentPlaybackTime();
    }
    return this._currentTime;
  }

  get duration(): number {
    return this._mediaInfo?.duration ?? 0;
  }

  get paused(): boolean {
    return this._state !== "playing";
  }

  get ended(): boolean {
    return this._state === "ended";
  }

  get volume(): number {
    return this._volume;
  }

  get muted(): boolean {
    return this._muted;
  }

  get state(): PlaybackState {
    return this._state;
  }

  get mediaInfo(): MediaInfo | null {
    return this._mediaInfo;
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (!this._muted) {
      this.audioRenderer?.setVolume(this._volume);
    }
    this.emit("volumechange");
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.audioRenderer?.setVolume(muted ? 0 : this._volume);
    this.emit("volumechange");
  }

  setAdapter(adapter: VideoFrameAdapter | null): void {
    this.adapter = adapter;
  }

  getAdapter(): VideoFrameAdapter | null {
    return this.adapter;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.stopRenderLoop();

    for (const frame of this.pendingFrames) {
      frame.close();
    }
    this.pendingFrames = [];

    this.sendWorkerCommand({ command: "destroy" });
    this.worker?.terminate();
    this.worker = null;

    this.audioRenderer?.destroy();
    this.audioRenderer = null;
    this.removeAllListeners();

    this._state = "idle";
  }

  private async initializeWorker(source: string | ArrayBuffer): Promise<MediaInfo> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type === "initialize-done") {
          this.worker?.removeEventListener("message", handler);
          resolve((e.data as InitializeDoneResponse).mediaInfo);
        } else if (e.data.type === "error") {
          this.worker?.removeEventListener("message", handler);
          reject(new Error(e.data.message));
        }
      };

      this.worker?.addEventListener("message", handler);
      this.sendWorkerCommand({ command: "initialize", source });
    });
  }

  /**
   * Audio playback not yet implemented (requires SharedArrayBuffer and AudioWorklet).
   */
  private async initializeAudio(mediaInfo: MediaInfo): Promise<void> {
    if (!mediaInfo.audioTrack) return;
    console.info("[Vega] Audio track available but audio playback not yet implemented");
  }

  private sendWorkerCommand(command: WorkerCommand): void {
    this.worker?.postMessage(command);
  }

  private handleWorkerMessage(e: MessageEvent<WorkerResponse>): void {
    const response = e.data;

    switch (response.type) {
      case "frame-ready": {
        const frameResponse = response as FrameReadyResponse;
        this.pendingFrames.push(frameResponse.frame);
        break;
      }

      case "ended": {
        this._state = "ended";
        this._currentTime = this.duration;
        this.stopRenderLoop();
        this.emit("timeupdate");
        this.emit("ended");

        if (this._loop) {
          this.seek(0).then(() => this.play());
        }
        break;
      }

      case "error": {
        this.handleError(response.message, undefined, response.code);
        break;
      }
    }
  }

  private handleError(message: string, error?: Error, code?: string): void {
    this._state = "error";
    const errorEvent: VegaErrorEvent = {
      message,
      error,
      code: code as VegaErrorEvent["code"],
    };
    this.emit("error", errorEvent);
  }

  private startRenderLoop(): void {
    if (this.animationFrameId !== null) return;

    const render = () => {
      if (this._state !== "playing") return;

      this.renderFrame();
      this.updateTimeDisplay();

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  private stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private async renderFrame(): Promise<void> {
    if (this.pendingFrames.length === 0) return;

    const targetTime = this.getCurrentPlaybackTime() * 1_000_000;

    let bestFrame: VideoFrame | null = null;
    let bestIndex = -1;
    let minDelta = Number.MAX_VALUE;

    for (let i = 0; i < this.pendingFrames.length; i++) {
      const delta = Math.abs(targetTime - this.pendingFrames[i].timestamp);
      if (delta < minDelta) {
        minDelta = delta;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      for (let i = 0; i < bestIndex; i++) {
        this.pendingFrames[i].close();
      }
      this.pendingFrames.splice(0, bestIndex);
      bestFrame = this.pendingFrames.shift() || null;
    }

    if (bestFrame) {
      try {
        let frameToRender = bestFrame;
        if (this.adapter) {
          const processed = await this.adapter.process(bestFrame);
          if (processed !== bestFrame) {
            bestFrame.close();
          }
          frameToRender = processed;
        }

        await this.renderer.draw(frameToRender);
      } catch (error) {
        bestFrame.close();
        const err = error as Error;
        this.emit("error", {
          message: err?.message ?? "Render error",
          error: err,
          code: "RENDER_ERROR",
        });
      }
    }
  }

  private updateTimeDisplay(): void {
    this._currentTime = this.getCurrentPlaybackTime();
    this.emit("timeupdate");
  }

  private getCurrentPlaybackTime(): number {
    const elapsed = (performance.now() - this.playbackStartTime) / 1000;
    const raw = this.playbackStartMediaTime + elapsed;
    const duration = this._mediaInfo?.duration;
    if (duration != null && raw >= duration) return duration;
    return raw;
  }
}

/**
 * Create a new Vega player instance.
 * @param options - Player options
 * @returns Vega player instance
 */
export function createVega(options: VegaOptions): Vega {
  return new VegaPlayer(options);
}

export type { Vega, VegaOptions, VideoFrameAdapter, MediaInfo, VegaEvent };
