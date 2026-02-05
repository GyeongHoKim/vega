/**
 * MP4 Demuxer
 * Wraps MP4Box.js to provide pull-based demuxing for WebCodecs.
 * Based on W3C WebCodecs sample patterns.
 */

import type {
  MP4BoxFile,
  MP4Info,
  MP4Sample,
  MP4VideoTrackInfo,
  MP4AudioTrackInfo,
  ArrayBufferWithFileStart,
} from "./mp4box-types.js";
import type { MediaInfo } from "../types/vega.js";

const SAMPLE_BUFFER_TARGET_SIZE = 50;
const ENABLE_DEBUG_LOGGING = false;
const GET_INFO_TIMEOUT_MS = 5000;

function debugLog(...args: unknown[]): void {
  if (ENABLE_DEBUG_LOGGING) {
    console.debug("[MP4Demuxer]", ...args);
  }
}

export type StreamType = "video" | "audio";

/**
 * MP4 Source - handles file fetching and MP4Box interaction
 */
class MP4Source {
  private file: MP4BoxFile;
  private info: MP4Info | null = null;
  private infoResolver: ((info: MP4Info) => void) | null = null;
  private errorResolver: ((reason: Error) => void) | null = null;
  private loadError: Error | null = null;
  private onSamplesCallback: ((samples: MP4Sample[]) => void) | null = null;

  constructor() {
    // MP4Box is loaded globally via importScripts in worker context
    this.file = MP4Box.createFile();
    this.file.onError = (error: string) => {
      this.loadError = new Error(error || "Invalid or unsupported media");
      if (this.errorResolver) {
        this.errorResolver(this.loadError);
        this.errorResolver = null;
      }
      this.infoResolver = null;
    };
    this.file.onReady = this.onReady.bind(this);
    this.file.onSamples = this.onSamples.bind(this);
  }

  /**
   * Load from a URL by fetching and streaming data.
   */
  async loadFromUrl(uri: string): Promise<void> {
    this.loadError = null;
    this.info = null;
    debugLog("Fetching file:", uri);
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    let offset = 0;

    const processChunk = async ({
      done,
      value,
    }: ReadableStreamReadResult<Uint8Array>): Promise<void> => {
      if (done) {
        this.file.flush();
        return;
      }

      const buffer = value.buffer as ArrayBufferWithFileStart;
      buffer.fileStart = offset;
      offset += buffer.byteLength;
      this.file.appendBuffer(buffer);

      const result = await reader.read();
      return processChunk(result);
    };

    const firstChunk = await reader.read();
    await processChunk(firstChunk);
  }

  /**
   * Load from an ArrayBuffer (for File/Blob sources).
   */
  async loadFromBuffer(data: ArrayBuffer): Promise<void> {
    this.loadError = null;
    this.info = null;
    const buffer = data as ArrayBufferWithFileStart;
    buffer.fileStart = 0;
    this.file.appendBuffer(buffer);
    this.file.flush();
  }

  private onReady(info: MP4Info): void {
    debugLog("MP4 ready:", info);
    this.info = info;

    if (this.infoResolver) {
      this.infoResolver(info);
      this.infoResolver = null;
    }
  }

  /**
   * Get file info, waiting if necessary. Rejects if MP4Box reported an error (e.g. invalid/corrupt data),
   * or if neither onReady nor onError fires within GET_INFO_TIMEOUT_MS (e.g. non-MP4 data).
   */
  getInfo(): Promise<MP4Info> {
    if (this.info) {
      return Promise.resolve(this.info);
    }
    if (this.loadError) {
      return Promise.reject(this.loadError);
    }
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Invalid or unsupported media"));
      }, GET_INFO_TIMEOUT_MS);
    });
    const infoPromise = new Promise<MP4Info>((resolve, reject) => {
      this.infoResolver = resolve;
      this.errorResolver = reject;
    });
    return Promise.race([infoPromise, timeout]);
  }

  /**
   * Get the video decoder description box.
   */
  getVideoDescriptionBox(trackId: number): ArrayBuffer | undefined {
    const track = this.file.getTrackById(trackId);
    if (!track) return undefined;

    for (const entry of track.mdia.minf.stbl.stsd.entries) {
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box) {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(stream);
        // Remove the 8-byte box header
        return stream.buffer.slice(8);
      }
    }
    return undefined;
  }

  /**
   * Get the audio decoder description (AudioSpecificConfig for AAC).
   */
  getAudioDescription(trackId: number): ArrayBuffer | undefined {
    const track = this.file.getTrackById(trackId);
    if (!track) return undefined;

    const entry = track.mdia.minf.stbl.stsd.entries[0];
    if (!entry?.esds?.esd?.descs?.[0]?.descs?.[0]?.data) {
      return undefined;
    }

    // 0x04 is DecoderConfigDescrTag, 0x40 is Audio OTI, 0x05 is DecSpecificInfoTag
    const desc = entry.esds.esd.descs[0];
    if (desc.tag === 0x04 && desc.descs?.[0]?.tag === 0x05) {
      // Convert Uint8Array to ArrayBuffer
      const data = desc.descs[0].data;
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    }
    return undefined;
  }

  selectTrack(trackId: number): void {
    debugLog("Selecting track:", trackId);
    this.file.setExtractionOptions(trackId, null, { nbSamples: SAMPLE_BUFFER_TARGET_SIZE });
  }

  start(onSamples: (samples: MP4Sample[]) => void): void {
    this.onSamplesCallback = onSamples;
    this.file.start();
  }

  stop(): void {
    this.file.stop();
  }

  seek(time: number): { offset: number; time: number } {
    return this.file.seek(time, true);
  }

  private onSamples(_trackId: number, _ref: unknown, samples: MP4Sample[]): void {
    if (this.onSamplesCallback) {
      this.onSamplesCallback(samples);
    }
  }
}

/**
 * MP4PullDemuxer - Pull-based demuxer for a single track (video or audio).
 */
export class MP4PullDemuxer {
  private source: MP4Source;
  private streamType: StreamType;
  private readySamples: MP4Sample[] = [];
  private pendingReadResolver: ((sample: MP4Sample) => void) | null = null;
  private videoTrack: MP4VideoTrackInfo | null = null;
  private audioTrack: MP4AudioTrackInfo | null = null;
  private selectedTrack: MP4VideoTrackInfo | MP4AudioTrackInfo | null = null;
  private initResolver: (() => void) | null = null;
  private info: MP4Info | null = null;

  constructor(source: MP4Source, streamType: StreamType) {
    this.source = source;
    this.streamType = streamType;
  }

  /**
   * Initialize the demuxer for the specified stream type.
   */
  async initialize(): Promise<void> {
    this.info = await this.source.getInfo();
    this.videoTrack = this.info.videoTracks[0] || null;
    this.audioTrack = this.info.audioTracks[0] || null;

    const track = this.streamType === "video" ? this.videoTrack : this.audioTrack;
    if (!track) {
      throw new Error(`No ${this.streamType} track found`);
    }

    this.selectTrack(track);
    return new Promise((resolve) => {
      this.initResolver = resolve;
    });
  }

  /**
   * Get the decoder configuration for the selected track.
   */
  getDecoderConfig(): VideoDecoderConfig | AudioDecoderConfig {
    if (this.streamType === "video" && this.videoTrack) {
      const codec = this.videoTrack.codec.startsWith("vp08") ? "vp8" : this.videoTrack.codec;

      const description = this.source.getVideoDescriptionBox(this.videoTrack.id);

      return {
        codec,
        codedWidth: this.videoTrack.video.width,
        codedHeight: this.videoTrack.video.height,
        ...(description && { description }),
      } as VideoDecoderConfig;
    }

    if (this.streamType === "audio" && this.audioTrack) {
      const description = this.source.getAudioDescription(this.audioTrack.id);

      return {
        codec: this.audioTrack.codec,
        sampleRate: this.audioTrack.audio.sample_rate,
        numberOfChannels: this.audioTrack.audio.channel_count,
        ...(description && { description: new Uint8Array(description) }),
      } as AudioDecoderConfig;
    }

    throw new Error("No track selected");
  }

  /**
   * Get the next encoded chunk.
   */
  async getNextChunk(): Promise<EncodedVideoChunk | EncodedAudioChunk> {
    const sample = await this.readSample();

    const type = sample.is_sync ? "key" : "delta";
    const timestamp = (sample.cts * 1_000_000) / sample.timescale;
    const duration = (sample.duration * 1_000_000) / sample.timescale;

    if (this.streamType === "video") {
      return new EncodedVideoChunk({
        type,
        timestamp,
        duration,
        data: sample.data,
      });
    }

    return new EncodedAudioChunk({
      type,
      timestamp,
      duration,
      data: sample.data,
    });
  }

  /**
   * Get media info for the file.
   */
  getMediaInfo(): MediaInfo {
    if (!this.info) {
      throw new Error("Demuxer not initialized");
    }

    const mediaInfo: MediaInfo = {
      duration: this.info.duration / this.info.timescale,
      isFragmented: this.info.isFragmented,
      brands: this.info.brands,
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

  private selectTrack(track: MP4VideoTrackInfo | MP4AudioTrackInfo): void {
    if (this.selectedTrack) {
      throw new Error("Changing tracks is not supported");
    }
    this.selectedTrack = track;
    this.source.selectTrack(track.id);
  }

  private async readSample(): Promise<MP4Sample> {
    if (!this.selectedTrack) {
      throw new Error("No track selected");
    }

    if (this.readySamples.length > 0) {
      const sample = this.readySamples.shift();
      if (sample) return sample;
    }

    return new Promise((resolve) => {
      this.pendingReadResolver = resolve;
      this.source.start(this.onSamples.bind(this));
    });
  }

  private onSamples(samples: MP4Sample[]): void {
    debugLog(`Received ${samples.length} samples`);
    this.readySamples.push(...samples);

    if (this.readySamples.length >= SAMPLE_BUFFER_TARGET_SIZE) {
      this.source.stop();
    }

    // Signal initialization complete when first samples arrive
    if (this.initResolver) {
      this.initResolver();
      this.initResolver = null;
    }

    if (this.pendingReadResolver) {
      const sample = this.readySamples.shift();
      if (sample) {
        this.pendingReadResolver(sample);
        this.pendingReadResolver = null;
      }
    }
  }
}

/**
 * MP4Demuxer - Main demuxer class managing both video and audio tracks.
 */
export class MP4Demuxer {
  private source: MP4Source;
  private videoDemuxer: MP4PullDemuxer | null = null;
  private audioDemuxer: MP4PullDemuxer | null = null;
  private mediaInfo: MediaInfo | null = null;

  constructor() {
    this.source = new MP4Source();
  }

  /**
   * Load and parse an MP4 file from a URL.
   */
  async loadFromUrl(uri: string): Promise<MediaInfo> {
    await this.source.loadFromUrl(uri);
    return this.initialize();
  }

  /**
   * Load and parse an MP4 file from an ArrayBuffer.
   */
  async loadFromBuffer(data: ArrayBuffer): Promise<MediaInfo> {
    await this.source.loadFromBuffer(data);
    return this.initialize();
  }

  private async initialize(): Promise<MediaInfo> {
    const info = await this.source.getInfo();

    // Create demuxers for available tracks
    if (info.videoTracks.length > 0) {
      this.videoDemuxer = new MP4PullDemuxer(this.source, "video");
      await this.videoDemuxer.initialize();
    }

    if (info.audioTracks.length > 0) {
      this.audioDemuxer = new MP4PullDemuxer(this.source, "audio");
      await this.audioDemuxer.initialize();
    }

    // Get media info from whichever demuxer is available
    const demuxer = this.videoDemuxer || this.audioDemuxer;
    if (!demuxer) {
      throw new Error("No video or audio tracks found");
    }

    this.mediaInfo = demuxer.getMediaInfo();
    return this.mediaInfo;
  }

  /**
   * Get video decoder configuration.
   */
  getVideoDecoderConfig(): VideoDecoderConfig | null {
    if (!this.videoDemuxer) return null;
    return this.videoDemuxer.getDecoderConfig() as VideoDecoderConfig;
  }

  /**
   * Get audio decoder configuration.
   */
  getAudioDecoderConfig(): AudioDecoderConfig | null {
    if (!this.audioDemuxer) return null;
    return this.audioDemuxer.getDecoderConfig() as AudioDecoderConfig;
  }

  /**
   * Get the next video chunk.
   */
  async getNextVideoChunk(): Promise<EncodedVideoChunk | null> {
    if (!this.videoDemuxer) return null;
    return this.videoDemuxer.getNextChunk() as Promise<EncodedVideoChunk>;
  }

  /**
   * Get the next audio chunk.
   */
  async getNextAudioChunk(): Promise<EncodedAudioChunk | null> {
    if (!this.audioDemuxer) return null;
    return this.audioDemuxer.getNextChunk() as Promise<EncodedAudioChunk>;
  }

  /**
   * Check if video track is available.
   */
  hasVideoTrack(): boolean {
    return this.videoDemuxer !== null;
  }

  /**
   * Check if audio track is available.
   */
  hasAudioTrack(): boolean {
    return this.audioDemuxer !== null;
  }

  /**
   * Get loaded media information.
   */
  getMediaInfo(): MediaInfo | null {
    return this.mediaInfo;
  }
}
