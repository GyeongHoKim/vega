/**
 * AudioRenderer
 * Handles audio decoding and playback using WebCodecs and WebAudio.
 * Based on W3C WebCodecs audio-video-player sample pattern.
 */

import { RingBuffer, getStorageForCapacity } from "./ring-buffer.js";

const DATA_BUFFER_DECODE_TARGET_DURATION = 0.3; // seconds
const DATA_BUFFER_DURATION = 0.6; // seconds
const DECODER_QUEUE_SIZE_MAX = 5;
const ENABLE_DEBUG_LOGGING = false;

function debugLog(...args: unknown[]): void {
  if (ENABLE_DEBUG_LOGGING) {
    console.debug("[AudioRenderer]", ...args);
  }
}

// AudioWorklet processor code as a string (for inline loading)
const WORKLET_CODE = `
class VegaAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ringBuffer = null;
    this.channelCount = 2;
    this.interleavedBuffer = null;
    this.playing = false;

    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      switch (type) {
        case "init":
          this.ringBuffer = this.createReader(data.sharedArrayBuffer);
          this.channelCount = data.channelCount || 2;
          this.interleavedBuffer = new Float32Array(128 * this.channelCount);
          break;
        case "play":
          this.playing = true;
          break;
        case "pause":
          this.playing = false;
          break;
      }
    };
  }

  createReader(sab) {
    const capacity = (sab.byteLength - 8) / Float32Array.BYTES_PER_ELEMENT;
    return {
      capacity,
      readPtr: new Uint32Array(sab, 0, 1),
      writePtr: new Uint32Array(sab, 4, 1),
      storageView: new Float32Array(sab, 8, capacity),
    };
  }

  pop(rb, output) {
    const read = Atomics.load(rb.readPtr, 0);
    const write = Atomics.load(rb.writePtr, 0);
    const availableRead = write - read;
    const toRead = Math.min(availableRead, output.length);
    if (toRead === 0) return 0;

    const readIndex = read % rb.capacity;
    const firstPart = Math.min(toRead, rb.capacity - readIndex);
    const secondPart = toRead - firstPart;

    output.set(rb.storageView.subarray(readIndex, readIndex + firstPart));
    if (secondPart > 0) {
      output.set(rb.storageView.subarray(0, secondPart), firstPart);
    }
    Atomics.store(rb.readPtr, 0, read + toRead);
    return toRead;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const ch0 = output[0];
    const ch1 = output[1] || output[0];
    const frameCount = ch0.length;

    if (!this.playing || !this.ringBuffer || !this.interleavedBuffer) {
      for (let i = 0; i < frameCount; i++) {
        ch0[i] = 0;
        if (output[1]) ch1[i] = 0;
      }
      return true;
    }

    const samplesToRead = frameCount * this.channelCount;
    const samplesRead = this.pop(
      this.ringBuffer,
      this.interleavedBuffer.subarray(0, samplesToRead)
    );

    const framesRead = Math.floor(samplesRead / this.channelCount);
    for (let i = 0; i < framesRead; i++) {
      ch0[i] = this.interleavedBuffer[i * this.channelCount];
      ch1[i] = this.channelCount > 1
        ? this.interleavedBuffer[i * this.channelCount + 1]
        : ch0[i];
    }

    for (let i = framesRead; i < frameCount; i++) {
      ch0[i] = 0;
      if (output[1]) ch1[i] = 0;
    }

    return true;
  }
}

registerProcessor("vega-audio-processor", VegaAudioProcessor);
`;

export interface AudioRendererConfig {
  sampleRate: number;
  channelCount: number;
}

/**
 * AudioRenderer handles decoding audio chunks and playing them via WebAudio.
 */
export class AudioRenderer {
  private decoder: AudioDecoder | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private ringBuffer: RingBuffer | null = null;
  private gainNode: GainNode | null = null;

  private sampleRate = 0;
  private channelCount = 0;
  private fillInProgress = false;
  private playing = false;
  private initResolver: (() => void) | null = null;
  private interleavingBuffers: Float32Array[] = [];

  // Demuxer reference for getting chunks
  private getNextChunk: (() => Promise<EncodedAudioChunk | null>) | null = null;

  /**
   * Initialize the audio renderer with decoder configuration.
   */
  async initialize(
    config: AudioDecoderConfig,
    getNextChunk: () => Promise<EncodedAudioChunk | null>,
  ): Promise<{ sampleRate: number; channelCount: number; sharedArrayBuffer: SharedArrayBuffer }> {
    this.getNextChunk = getNextChunk;
    this.sampleRate = config.sampleRate;
    this.channelCount = config.numberOfChannels;

    // Create audio decoder
    this.decoder = new AudioDecoder({
      output: this.bufferAudioData.bind(this),
      error: (e) => console.error("[AudioRenderer] Decoder error:", e),
    });

    const support = await AudioDecoder.isConfigSupported(config);
    if (!support.supported) {
      throw new Error(`Audio codec not supported: ${config.codec}`);
    }
    this.decoder.configure(config);

    // Initialize ring buffer for audio data
    const sampleCountInBuffer = DATA_BUFFER_DURATION * this.sampleRate * this.channelCount;
    const sab = getStorageForCapacity(Math.ceil(sampleCountInBuffer), Float32Array);
    this.ringBuffer = new RingBuffer(sab, Float32Array);

    // Pre-allocate interleaving buffers
    this.interleavingBuffers = [];

    // Start filling the buffer
    return new Promise((resolve) => {
      this.initResolver = () => {
        resolve({
          sampleRate: this.sampleRate,
          channelCount: this.channelCount,
          sharedArrayBuffer: sab,
        });
      };
      this.fillDataBuffer();
    });
  }

  /**
   * Initialize audio playback on the main thread.
   * Must be called after initialize() with the SharedArrayBuffer.
   */
  async initializePlayback(sharedArrayBuffer: SharedArrayBuffer): Promise<void> {
    // Create AudioContext
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });

    // Load AudioWorklet
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    // Create worklet node
    this.workletNode = new AudioWorkletNode(this.audioContext, "vega-audio-processor", {
      outputChannelCount: [this.channelCount],
    });

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();

    // Connect nodes
    this.workletNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Initialize worklet with SharedArrayBuffer
    this.workletNode.port.postMessage({
      type: "init",
      data: {
        sharedArrayBuffer,
        channelCount: this.channelCount,
      },
    });
  }

  /**
   * Start audio playback.
   */
  play(): void {
    debugLog("Play");
    this.playing = true;

    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }

    this.workletNode?.port.postMessage({ type: "play" });
    this.fillDataBuffer();
  }

  /**
   * Pause audio playback.
   */
  pause(): void {
    debugLog("Pause");
    this.playing = false;
    this.workletNode?.port.postMessage({ type: "pause" });
  }

  /**
   * Set playback volume.
   * @param volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current volume.
   */
  getVolume(): number {
    return this.gainNode?.gain.value ?? 1;
  }

  /**
   * Get the current audio context time.
   */
  getCurrentTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  /**
   * Get buffer health percentage (0-100).
   */
  getBufferHealth(): number {
    if (!this.ringBuffer) return 0;
    const available = this.ringBuffer.getCapacity() - this.ringBuffer.available_write();
    return (available / this.ringBuffer.getCapacity()) * 100;
  }

  /**
   * Destroy the audio renderer and release resources.
   */
  destroy(): void {
    this.playing = false;

    if (this.decoder?.state !== "closed") {
      this.decoder?.close();
    }

    this.workletNode?.disconnect();
    this.gainNode?.disconnect();
    this.audioContext?.close();

    this.decoder = null;
    this.audioContext = null;
    this.workletNode = null;
    this.gainNode = null;
    this.ringBuffer = null;
  }

  private async fillDataBuffer(): Promise<void> {
    if (this.fillInProgress) return;
    this.fillInProgress = true;
    await this.fillDataBufferInternal();
    this.fillInProgress = false;
  }

  private async fillDataBufferInternal(): Promise<void> {
    if (!this.decoder || !this.ringBuffer || !this.getNextChunk) return;

    if (this.decoder.decodeQueueSize >= DECODER_QUEUE_SIZE_MAX) {
      debugLog("Decoder saturated");
      return;
    }

    const usedBufferElements = this.ringBuffer.getCapacity() - this.ringBuffer.available_write();
    let usedBufferSecs = usedBufferElements / (this.channelCount * this.sampleRate);

    if (usedBufferSecs >= DATA_BUFFER_DECODE_TARGET_DURATION) {
      debugLog(`Buffer full: ${usedBufferSecs.toFixed(3)}s`);

      if (this.playing) {
        // Schedule periodic refill
        setTimeout(() => this.fillDataBuffer(), (usedBufferSecs / 2) * 1000);
      }

      // Signal initialization complete on first fill
      if (this.initResolver) {
        this.initResolver();
        this.initResolver = null;
      }
      return;
    }

    // Decode until buffer target or decoder saturated
    while (
      usedBufferSecs < DATA_BUFFER_DECODE_TARGET_DURATION &&
      this.decoder.decodeQueueSize < DECODER_QUEUE_SIZE_MAX
    ) {
      const chunk = await this.getNextChunk();
      if (!chunk) {
        debugLog("No more audio chunks");
        break;
      }
      this.decoder.decode(chunk);

      // Recalculate buffer usage
      const newUsedElements = this.ringBuffer.getCapacity() - this.ringBuffer.available_write();
      usedBufferSecs = newUsedElements / (this.channelCount * this.sampleRate);
    }
  }

  private bufferAudioData(data: AudioData): void {
    if (!this.ringBuffer) return;

    // Ensure interleaving buffers match channel count
    if (this.interleavingBuffers.length !== data.numberOfChannels) {
      this.interleavingBuffers = new Array(data.numberOfChannels);
      for (let i = 0; i < data.numberOfChannels; i++) {
        this.interleavingBuffers[i] = new Float32Array(data.numberOfFrames);
      }
    } else if (this.interleavingBuffers[0].length < data.numberOfFrames) {
      // Resize if needed
      for (let i = 0; i < data.numberOfChannels; i++) {
        this.interleavingBuffers[i] = new Float32Array(data.numberOfFrames);
      }
    }

    debugLog(
      `Buffer audio: ts=${data.timestamp}, duration=${(data.duration / 1_000_000).toFixed(3)}s`,
    );

    // Copy planar audio data to temporary buffers
    for (let i = 0; i < data.numberOfChannels; i++) {
      data.copyTo(this.interleavingBuffers[i], {
        planeIndex: i,
        format: "f32-planar",
      });
    }

    // Interleave and write to ring buffer
    const totalSamples = data.numberOfFrames * data.numberOfChannels;
    const wrote = this.ringBuffer.writeCallback(totalSamples, (firstPart, secondPart) => {
      this.interleave(this.interleavingBuffers, 0, firstPart.length, firstPart, 0);
      if (secondPart.length > 0) {
        this.interleave(
          this.interleavingBuffers,
          firstPart.length,
          secondPart.length,
          secondPart,
          0,
        );
      }
    });

    if (wrote !== totalSamples) {
      console.warn("[AudioRenderer] Buffer overflow, dropped samples");
    }

    data.close();

    // Continue filling buffer
    this.fillDataBuffer();
  }

  /**
   * Interleave planar audio data into a single buffer.
   */
  private interleave(
    inputs: Float32Array[],
    inputOffset: number,
    inputSamplesToCopy: number,
    output: Float32Array,
    outputSampleOffset: number,
  ): void {
    const channelCount = inputs.length;
    let outIdx = outputSampleOffset;
    let inputIdx = Math.floor(inputOffset / channelCount);
    let channel = inputOffset % channelCount;

    for (let i = 0; i < inputSamplesToCopy; i++) {
      output[outIdx++] = inputs[channel][inputIdx];
      if (++channel === channelCount) {
        channel = 0;
        inputIdx++;
      }
    }
  }
}
