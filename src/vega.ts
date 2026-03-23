import { Input, MP4, type InputFormat, VideoSampleSink } from "mediabunny";
import type {
  MediaInfo,
  MediaInput,
  PlaybackState,
  Vega,
  VegaErrorEvent,
  VegaEvent,
  VegaEventCallback,
  VegaOptions,
} from "./types/vega.js";
import { createSource } from "./input/create-source.js";
import { create as createRenderer } from "./factory.js";
import type { VideoRenderer } from "./types/index.js";

const DEFAULT_FORMATS: InputFormat[] = [MP4];

const DEFAULT_OPTIONS: Partial<VegaOptions> = {
  rendererType: "2d",
  volume: 1.0,
  loop: false,
  autoplay: false,
  formats: DEFAULT_FORMATS,
};

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "Unknown error");
}

class EventEmitter {
  private listeners = new Map<string, Set<VegaEventCallback>>();

  on(event: string, callback: VegaEventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: VegaEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  protected emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[Vega] ${event} callback failed`, error);
      }
    });
  }

  protected removeAllListeners(): void {
    this.listeners.clear();
  }
}

class VegaPlayer extends EventEmitter implements Vega {
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  private readonly renderer: VideoRenderer;
  private readonly formats: InputFormat[];
  private readonly autoplay: boolean;
  private readonly pipeline: {
    stream: TransformStream<VideoFrame, VideoFrame>;
    writer: WritableStreamDefaultWriter<VideoFrame>;
    reader: ReadableStreamDefaultReader<VideoFrame>;
  }[] = [];
  private input: Input | null = null;
  private videoSampleSink: VideoSampleSink | null = null;
  private _state: PlaybackState = "idle";
  private _mediaInfo: MediaInfo | null = null;
  private _currentTime = 0;
  private _volume = 1;
  private _muted = false;
  private _loop = false;
  private _lastSource: MediaInput | null = null;
  private playbackStartTime = 0;
  private playbackStartMediaTime = 0;
  private animationFrameId: number | null = null;
  private loopSession = 0;
  private lastRenderedTimestamp = -1;
  private destroyed = false;

  constructor(options: VegaOptions) {
    super();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.canvas = opts.canvas;
    this._volume = opts.volume ?? 1;
    this._loop = opts.loop ?? false;
    this.autoplay = opts.autoplay ?? false;
    this.formats = opts.formats ?? DEFAULT_FORMATS;

    if (this.canvas instanceof HTMLCanvasElement) {
      this.renderer = createRenderer(this.canvas, { type: opts.rendererType ?? "2d" });
    } else {
      const ctx = this.canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D context for OffscreenCanvas");
      this.renderer = {
        draw: (frame: VideoFrame) => {
          ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
          frame.close();
        },
      };
    }
  }

  async load(source: MediaInput): Promise<MediaInfo> {
    if (this.destroyed) throw new Error("Player has been destroyed");

    this._state = "loading";
    this._lastSource = source;
    this.stopRenderLoop();
    this.input?.dispose();
    this.input = null;
    this.videoSampleSink = null;
    this.lastRenderedTimestamp = -1;

    try {
      const input = new Input({ formats: this.formats, source: createSource(source) });
      const [videoTrack, audioTrack, duration] = await Promise.all([
        input.getPrimaryVideoTrack(),
        input.getPrimaryAudioTrack(),
        input.computeDuration(),
      ]);

      if (!videoTrack) {
        throw new Error("No primary video track found");
      }

      const videoStats = await videoTrack.computePacketStats();
      const codec = (await videoTrack.getCodecParameterString()) ?? "";
      const audioCodec = audioTrack ? ((await audioTrack.getCodecParameterString()) ?? "") : "";

      this.input = input;
      this.videoSampleSink = new VideoSampleSink(videoTrack);
      this._currentTime = 0;
      this.playbackStartMediaTime = 0;
      this.playbackStartTime = performance.now();
      this._mediaInfo = {
        duration,
        videoTrack: {
          codec,
          width: videoTrack.displayWidth,
          height: videoTrack.displayHeight,
          codedWidth: videoTrack.codedWidth,
          codedHeight: videoTrack.codedHeight,
          frameRate: videoStats.averagePacketRate,
          rotation: videoTrack.rotation,
          bitrate: videoStats.averageBitrate,
        },
        audioTrack: audioTrack
          ? {
              codec: audioCodec,
              sampleRate: audioTrack.sampleRate,
              channelCount: audioTrack.numberOfChannels,
            }
          : undefined,
      };

      this._state = "ready";
      this.emit("loadedmetadata", this._mediaInfo);
      this.emit("canplay");
      if (this.autoplay) await this.play();
      return this._mediaInfo;
    } catch (error) {
      this.handleError("Load failed", toError(error), "LOAD_ERROR");
      throw error;
    }
  }

  async play(): Promise<void> {
    if (this._state === "playing") return;
    if (this._state === "ended" && this._lastSource) {
      await this.load(this._lastSource);
    }
    if (this._state !== "ready" && this._state !== "paused") {
      throw new Error(`Cannot play in state: ${this._state}`);
    }
    this._state = "playing";
    this.playbackStartMediaTime = this._currentTime;
    this.playbackStartTime = performance.now();
    this.startRenderLoop();
    this.emit("play");
  }

  pause(): void {
    if (this._state !== "playing") return;
    this._currentTime = this.getCurrentPlaybackTime();
    this._state = "paused";
    this.stopRenderLoop();
    this.emit("pause");
  }

  async seek(time: number): Promise<void> {
    if (!this.videoSampleSink || !this._mediaInfo) throw new Error("No media loaded");
    const wasPlaying = this._state === "playing";
    this.stopRenderLoop();
    this._state = "seeking";
    this.emit("seeking");
    const targetTime = Math.max(0, Math.min(time, this._mediaInfo.duration));
    await this.renderTime(targetTime);
    this._currentTime = targetTime;
    this.playbackStartMediaTime = targetTime;
    this.playbackStartTime = performance.now();
    this._state = wasPlaying ? "playing" : "paused";
    this.emit("seeked");
    if (wasPlaying) this.startRenderLoop();
  }

  stop(): void {
    this.pause();
    this._currentTime = 0;
    this.playbackStartMediaTime = 0;
    this.lastRenderedTimestamp = -1;
    if (this._state !== "error") this._state = "ready";
  }

  pipeThrough(transform: TransformStream<VideoFrame, VideoFrame>): void {
    this.pipeline.push({
      stream: transform,
      writer: transform.writable.getWriter(),
      reader: transform.readable.getReader(),
    });
  }

  clearPipeline(): void {
    for (const stage of this.pipeline) {
      void stage.writer.abort();
      void stage.reader.cancel();
      stage.writer.releaseLock();
      stage.reader.releaseLock();
    }
    this.pipeline.length = 0;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopRenderLoop();
    this.input?.dispose();
    this.input = null;
    this.videoSampleSink = null;
    this.clearPipeline();
    this.removeAllListeners();
    this._state = "idle";
  }

  get currentTime(): number {
    return this._state === "playing" ? this.getCurrentPlaybackTime() : this._currentTime;
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
    this.emit("volumechange");
  }
  setMuted(muted: boolean): void {
    this._muted = muted;
    this.emit("volumechange");
  }

  private startRenderLoop(): void {
    if (this.animationFrameId !== null) return;
    const session = ++this.loopSession;
    const tick = async () => {
      if (session !== this.loopSession) return;
      if (this._state !== "playing") {
        this.animationFrameId = null;
        return;
      }
      const currentTime = this.getCurrentPlaybackTime();
      try {
        await this.renderTime(currentTime);
      } catch {
        // Ignore race conditions when input is disposed during teardown/load.
        return;
      }
      this._currentTime = currentTime;
      this.emit("timeupdate");
      if (this._mediaInfo && currentTime >= this._mediaInfo.duration) {
        this._state = "ended";
        this.stopRenderLoop();
        this.emit("ended");
        if (this._loop && this._lastSource) {
          await this.load(this._lastSource);
          await this.play();
        }
        return;
      }
      this.animationFrameId = requestAnimationFrame(() => {
        void tick();
      });
    };
    this.animationFrameId = requestAnimationFrame(() => {
      void tick();
    });
  }

  private stopRenderLoop(): void {
    this.loopSession++;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private async renderTime(time: number): Promise<void> {
    if (!this.videoSampleSink) return;
    const sample = await this.videoSampleSink.getSample(time);
    if (!sample) return;
    if (sample.timestamp === this.lastRenderedTimestamp) {
      sample.close();
      return;
    }
    this.lastRenderedTimestamp = sample.timestamp;
    let frame = sample.toVideoFrame();
    sample.close();

    try {
      frame = await this.applyPipeline(frame);
      await this.renderer.draw(frame);
    } catch (error) {
      frame.close();
      this.handleError("adapter error", toError(error), "ADAPTER_ERROR");
    }
  }

  private async applyPipeline(frame: VideoFrame): Promise<VideoFrame> {
    let current = frame;
    for (const stage of this.pipeline) {
      await stage.writer.write(current);
      const { value } = await stage.reader.read();
      if (value !== current) {
        current.close();
      }
      if (!value) throw new Error("Transform did not emit a frame");
      current = value;
    }
    return current;
  }

  private handleError(message: string, error?: Error, code?: VegaErrorEvent["code"]): void {
    this._state = "error";
    this.emit("error", { message, error, code } satisfies VegaErrorEvent);
  }

  private getCurrentPlaybackTime(): number {
    const elapsed = (performance.now() - this.playbackStartTime) / 1000;
    const raw = this.playbackStartMediaTime + elapsed;
    const duration = this._mediaInfo?.duration;
    return duration != null ? Math.min(raw, duration) : raw;
  }
}

export function createVega(options: VegaOptions): Vega {
  return new VegaPlayer(options);
}

export type { MediaInfo, Vega, VegaEvent, VegaOptions };
