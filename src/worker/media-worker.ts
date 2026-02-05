/**
 * Media Worker
 * Handles demuxing and decoding in a background Web Worker.
 * Based on W3C WebCodecs media_worker.js pattern.
 */

import type {
  WorkerCommand,
  WorkerResponse,
  InitializeDoneResponse,
  FrameReadyResponse,
  ErrorResponse,
} from "../types/worker-messages.js";
import type { MediaInfo } from "../types/vega.js";
import type {
  MP4BoxFile,
  MP4Info,
  MP4VideoTrackInfo,
  MP4AudioTrackInfo,
  MP4Sample,
} from "../demuxer/mp4box-types.js";
// Load full mp4box; some internals expect globals (DataStream), so expose them in worker scope
import * as mp4box from "mp4box";

const mp4boxExports = mp4box as unknown as { createFile: () => MP4BoxFile; DataStream?: unknown };
if (typeof globalThis !== "undefined" && mp4boxExports.DataStream) {
  (globalThis as unknown as { DataStream: unknown }).DataStream = mp4boxExports.DataStream;
}
const createFile = mp4boxExports.createFile;

// State
let playing = false;
let lastMediaTimeSecs = 0;
let lastMediaTimeCapturePoint = 0;
let animationFrameId: number | null = null;

// Components (initialized lazily)
let demuxer: MP4DemuxerWorker | null = null;
let videoRenderer: VideoDecoderWrapper | null = null;
const audioDecoder: AudioDecoder | null = null;

// Buffers
const videoFrameBuffer: VideoFrame[] = [];
const audioDataBuffer: AudioData[] = [];

const FRAME_BUFFER_TARGET = 3;
const _AUDIO_BUFFER_TARGET = 5;

/**
 * Post a response message to the main thread.
 */
function postResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Post an error response.
 */
function postError(message: string, code?: string): void {
  const response: ErrorResponse = { type: "error", message, code };
  postResponse(response);
}

/**
 * Update the media time reference.
 */
function updateMediaTime(mediaTimeSecs: number, capturedAtHighResTimestamp: number): void {
  lastMediaTimeSecs = mediaTimeSecs;
  // Translate to worker's time origin
  lastMediaTimeCapturePoint = capturedAtHighResTimestamp - performance.timeOrigin;
}

/**
 * Estimate current media time based on last known time.
 */
function getMediaTimeMicroseconds(): number {
  const msecsSinceCapture = performance.now() - lastMediaTimeCapturePoint;
  return (lastMediaTimeSecs * 1000 + msecsSinceCapture) * 1000;
}

/**
 * Simple MP4 Demuxer for Worker context.
 */
const DEMUXER_GET_INFO_TIMEOUT_MS = 5000;

class MP4DemuxerWorker {
  private file: MP4BoxFile;
  private info: MP4Info | null = null;
  private infoResolver: ((info: MP4Info) => void) | null = null;
  private errorResolver: ((reason: Error) => void) | null = null;
  private loadError: Error | null = null;
  private videoTrack: MP4VideoTrackInfo | null = null;
  private audioTrack: MP4AudioTrackInfo | null = null;
  private videoSamples: MP4Sample[] = [];
  private audioSamples: MP4Sample[] = [];
  private videoSampleResolver: ((sample: MP4Sample) => void) | null = null;
  private audioSampleResolver: ((sample: MP4Sample) => void) | null = null;

  constructor() {
    this.file = createFile();
    this.file.onError = (e: string) => {
      this.loadError = new Error(e || "Invalid or unsupported media");
      if (this.errorResolver) {
        this.errorResolver(this.loadError);
        this.errorResolver = null;
      }
      this.infoResolver = null;
    };
    this.file.onReady = this.onReady.bind(this);
    this.file.onSamples = this.onSamples.bind(this);
  }

  async loadFromUrl(url: string): Promise<void> {
    this.loadError = null;
    this.info = null;
    const response = await fetch(url);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is null");
    let offset = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        this.file.flush();
        break;
      }

      const buffer = value.buffer as ArrayBuffer & { fileStart: number };
      buffer.fileStart = offset;
      offset += buffer.byteLength;
      this.file.appendBuffer(buffer);
    }
  }

  async loadFromBuffer(data: ArrayBuffer): Promise<void> {
    this.loadError = null;
    this.info = null;
    const buffer = data as ArrayBuffer & { fileStart: number };
    buffer.fileStart = 0;
    this.file.appendBuffer(buffer);
    this.file.flush();
  }

  private onReady(info: MP4Info): void {
    this.info = info;
    this.videoTrack = info.videoTracks[0];
    this.audioTrack = info.audioTracks[0];

    if (this.infoResolver) {
      this.infoResolver(info);
      this.infoResolver = null;
    }
  }

  private onSamples(trackId: number, _ref: unknown, samples: MP4Sample[]): void {
    if (this.videoTrack && trackId === this.videoTrack.id) {
      this.videoSamples.push(...samples);
      if (this.videoSampleResolver && this.videoSamples.length > 0) {
        const sample = this.videoSamples.shift();
        if (sample !== undefined) this.videoSampleResolver(sample);
        this.videoSampleResolver = null;
      }
    } else if (this.audioTrack && trackId === this.audioTrack.id) {
      this.audioSamples.push(...samples);
      if (this.audioSampleResolver && this.audioSamples.length > 0) {
        const sample = this.audioSamples.shift();
        if (sample !== undefined) this.audioSampleResolver(sample);
        this.audioSampleResolver = null;
      }
    }
  }

  async getInfo(): Promise<MP4Info> {
    if (this.info) return this.info;
    if (this.loadError) return Promise.reject(this.loadError);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Invalid or unsupported media")),
        DEMUXER_GET_INFO_TIMEOUT_MS,
      );
    });
    const infoPromise = new Promise<MP4Info>((resolve, reject) => {
      this.infoResolver = resolve;
      this.errorResolver = reject;
    });
    return Promise.race([infoPromise, timeout]);
  }

  getVideoDecoderConfig(): VideoDecoderConfig | null {
    if (!this.videoTrack) return null;

    const codec = this.videoTrack.codec.startsWith("vp08") ? "vp8" : this.videoTrack.codec;

    const description = this.getVideoDescription();

    return {
      codec,
      codedWidth: this.videoTrack.video.width,
      codedHeight: this.videoTrack.video.height,
      ...(description && { description }),
    };
  }

  getAudioDecoderConfig(): AudioDecoderConfig | null {
    if (!this.audioTrack) return null;

    const description = this.getAudioDescription();

    return {
      codec: this.audioTrack.codec,
      sampleRate: this.audioTrack.audio.sample_rate,
      numberOfChannels: this.audioTrack.audio.channel_count,
      ...(description && { description }),
    };
  }

  private getVideoDescription(): ArrayBuffer | undefined {
    if (!this.videoTrack) return undefined;
    const track = this.file.getTrackById(this.videoTrack.id);
    if (!track) return undefined;

    for (const entry of track.mdia.minf.stbl.stsd.entries) {
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box) {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(stream);
        return stream.buffer.slice(8);
      }
    }
    return undefined;
  }

  private getAudioDescription(): ArrayBuffer | undefined {
    if (!this.audioTrack) return undefined;
    const track = this.file.getTrackById(this.audioTrack.id);
    if (!track) return undefined;

    const entry = track.mdia.minf.stbl.stsd.entries[0];
    if (entry?.esds?.esd?.descs?.[0]?.descs?.[0]?.data) {
      const data = entry.esds.esd.descs[0].descs[0].data;
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    }
    return undefined;
  }

  startVideoExtraction(): void {
    if (this.videoTrack) {
      this.file.setExtractionOptions(this.videoTrack.id, null, { nbSamples: 50 });
      this.file.start();
    }
  }

  startAudioExtraction(): void {
    if (this.audioTrack) {
      this.file.setExtractionOptions(this.audioTrack.id, null, { nbSamples: 50 });
      this.file.start();
    }
  }

  async getNextVideoSample(): Promise<MP4Sample | null> {
    if (this.videoSamples.length > 0) {
      return this.videoSamples.shift() ?? null;
    }
    if (!this.videoTrack) return null;

    return new Promise((resolve) => {
      this.videoSampleResolver = resolve;
      this.file.start();
    });
  }

  async getNextAudioSample(): Promise<MP4Sample | null> {
    if (this.audioSamples.length > 0) {
      return this.audioSamples.shift() ?? null;
    }
    if (!this.audioTrack) return null;

    return new Promise((resolve) => {
      this.audioSampleResolver = resolve;
      this.file.start();
    });
  }

  getMediaInfo(): MediaInfo {
    const info = this.info;
    if (!info) throw new Error("Demuxer not initialized");
    const mediaInfo: MediaInfo = {
      duration: info.duration / info.timescale,
      isFragmented: info.isFragmented,
      brands: info.brands,
    };

    if (this.videoTrack) {
      const frameRate =
        this.videoTrack.nb_samples / (this.videoTrack.duration / this.videoTrack.timescale);
      mediaInfo.videoTrack = {
        codec: this.videoTrack.codec,
        width: this.videoTrack.video.width,
        height: this.videoTrack.video.height,
        frameRate,
        bitrate: this.videoTrack.bitrate,
      };
    }

    if (this.audioTrack) {
      mediaInfo.audioTrack = {
        codec: this.audioTrack.codec,
        sampleRate: this.audioTrack.audio.sample_rate,
        channelCount: this.audioTrack.audio.channel_count,
        bitrate: this.audioTrack.bitrate,
      };
    }

    return mediaInfo;
  }

  hasVideoTrack(): boolean {
    return this.videoTrack !== null;
  }

  hasAudioTrack(): boolean {
    return this.audioTrack !== null;
  }
}

/**
 * Video Decoder Wrapper
 */
class VideoDecoderWrapper {
  private decoder: VideoDecoder;
  private fillInProgress = false;
  private getNextSample: () => Promise<MP4Sample | null>;

  constructor(getNextSample: () => Promise<MP4Sample | null>) {
    this.getNextSample = getNextSample;
    this.decoder = new VideoDecoder({
      output: (frame) => {
        videoFrameBuffer.push(frame);
      },
      error: (e) => {
        console.error("[VideoDecoder]", e);
        postError(`Video decode error: ${e.message}`, "DECODE_ERROR");
      },
    });
  }

  async configure(config: VideoDecoderConfig): Promise<void> {
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) {
      throw new Error(`Video codec not supported: ${config.codec}`);
    }
    this.decoder.configure(config);
  }

  async fillBuffer(): Promise<void> {
    if (this.fillInProgress) return;
    this.fillInProgress = true;

    try {
      while (
        videoFrameBuffer.length < FRAME_BUFFER_TARGET &&
        this.decoder.decodeQueueSize < FRAME_BUFFER_TARGET
      ) {
        const sample = await this.getNextSample();
        if (!sample) break;

        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (sample.cts * 1_000_000) / sample.timescale,
          duration: (sample.duration * 1_000_000) / sample.timescale,
          data: sample.data,
        });

        this.decoder.decode(chunk);
      }
    } catch (e) {
      console.error("[VideoDecoder] Fill error:", e);
    }

    this.fillInProgress = false;
  }

  async flush(): Promise<void> {
    if (this.decoder.state === "configured") {
      await this.decoder.flush();
    }
  }

  close(): void {
    if (this.decoder.state !== "closed") {
      this.decoder.close();
    }
  }
}

/**
 * Render video frame for current time.
 */
function renderVideo(): void {
  if (!playing) return;

  const timestamp = getMediaTimeMicroseconds();

  // Choose best frame
  let bestFrame: VideoFrame | null = null;
  let bestIndex = -1;
  let minDelta = Number.MAX_VALUE;

  for (let i = 0; i < videoFrameBuffer.length; i++) {
    const delta = Math.abs(timestamp - videoFrameBuffer[i].timestamp);
    if (delta < minDelta) {
      minDelta = delta;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    // Close stale frames
    for (let i = 0; i < bestIndex; i++) {
      videoFrameBuffer[i].close();
    }
    videoFrameBuffer.splice(0, bestIndex);
    bestFrame = videoFrameBuffer.shift() || null;
  }

  if (bestFrame) {
    // Transfer frame to main thread
    const response: FrameReadyResponse = {
      type: "frame-ready",
      frame: bestFrame,
      timestamp: bestFrame.timestamp,
    };
    postResponse(response);
  }

  // Fill buffer
  videoRenderer?.fillBuffer();

  // Schedule next render
  animationFrameId = requestAnimationFrame(renderVideo);
}

/**
 * Handle incoming commands from main thread.
 */
async function handleCommand(command: WorkerCommand): Promise<void> {
  switch (command.command) {
    case "initialize": {
      try {
        // Create demuxer
        demuxer = new MP4DemuxerWorker();

        if (typeof command.source === "string") {
          await demuxer.loadFromUrl(command.source);
        } else {
          await demuxer.loadFromBuffer(command.source);
        }

        await demuxer.getInfo();

        // Initialize video decoder
        if (demuxer.hasVideoTrack()) {
          const videoConfig = demuxer.getVideoDecoderConfig();
          if (videoConfig) {
            const d = demuxer;
            videoRenderer = new VideoDecoderWrapper(() =>
              d ? d.getNextVideoSample() : Promise.resolve(null),
            );
            await videoRenderer.configure(videoConfig);
            demuxer.startVideoExtraction();
            await videoRenderer.fillBuffer();
          }
        }

        // Initialize audio decoder
        let audioConfig: AudioDecoderConfig | null = null;
        let sharedArrayBuffer: SharedArrayBuffer | undefined;

        if (demuxer.hasAudioTrack()) {
          audioConfig = demuxer.getAudioDecoderConfig();
          if (audioConfig) {
            demuxer.startAudioExtraction();
            // Audio is processed on main thread via AudioRenderer
          }
        }

        const mediaInfo = demuxer.getMediaInfo();
        const response: InitializeDoneResponse = {
          type: "initialize-done",
          mediaInfo,
          sampleRate: audioConfig?.sampleRate,
          channelCount: audioConfig?.numberOfChannels,
          sharedArrayBuffer,
        };
        postResponse(response);
      } catch (e) {
        const error = e as Error;
        postError(error.message, "LOAD_ERROR");
      }
      break;
    }

    case "play": {
      playing = true;
      updateMediaTime(command.mediaTimeSecs, command.mediaTimeCapturedAtHighResTimestamp);
      animationFrameId = requestAnimationFrame(renderVideo);
      break;
    }

    case "pause": {
      playing = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      break;
    }

    case "update-media-time": {
      updateMediaTime(command.mediaTimeSecs, command.mediaTimeCapturedAtHighResTimestamp);
      break;
    }

    case "seek": {
      // Clear buffers
      for (const frame of videoFrameBuffer) {
        frame.close();
      }
      videoFrameBuffer.length = 0;

      for (const data of audioDataBuffer) {
        data.close();
      }
      audioDataBuffer.length = 0;

      // Flush decoders
      await videoRenderer?.flush();

      // Refill buffers
      await videoRenderer?.fillBuffer();

      postResponse({ type: "seek-done", time: command.time });
      break;
    }

    case "stop": {
      playing = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      // Clear buffers
      for (const frame of videoFrameBuffer) {
        frame.close();
      }
      videoFrameBuffer.length = 0;
      break;
    }

    case "destroy": {
      playing = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      for (const frame of videoFrameBuffer) {
        frame.close();
      }
      videoFrameBuffer.length = 0;

      videoRenderer?.close();
      audioDecoder?.close();
      break;
    }
  }
}

// Listen for messages
self.addEventListener("message", async (e: MessageEvent<WorkerCommand>) => {
  await handleCommand(e.data);
});

console.info("[MediaWorker] Started");
