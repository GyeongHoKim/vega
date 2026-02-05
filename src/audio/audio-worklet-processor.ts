/**
 * AudioWorklet Processor for Vega
 * Reads audio samples from a SharedArrayBuffer ring buffer
 * and outputs them to the audio context.
 *
 * This file is meant to be loaded as an AudioWorklet module.
 * It runs in a separate AudioWorklet scope, not the main thread.
 *
 * NOTE: This file is not compiled with the main bundle.
 * It's used as a reference and the actual processor code is inlined
 * in audio-renderer.ts as a string.
 */

// AudioWorklet types - these are available in AudioWorklet scope
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

interface RingBufferReader {
  capacity: number;
  readPtr: Uint32Array;
  writePtr: Uint32Array;
  storageView: Float32Array;
}

function createRingBufferReader(sab: SharedArrayBuffer): RingBufferReader {
  const capacity = (sab.byteLength - 8) / Float32Array.BYTES_PER_ELEMENT;
  return {
    capacity,
    readPtr: new Uint32Array(sab, 0, 1),
    writePtr: new Uint32Array(sab, 4, 1),
    storageView: new Float32Array(sab, 8, capacity),
  };
}

function ringBufferPop(rb: RingBufferReader, output: Float32Array): number {
  const read = Atomics.load(rb.readPtr, 0);
  const write = Atomics.load(rb.writePtr, 0);

  const availableRead = write - read;
  const toRead = Math.min(availableRead, output.length);

  if (toRead === 0) {
    return 0;
  }

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

class VegaAudioProcessor extends AudioWorkletProcessor {
  private ringBuffer: RingBufferReader | null = null;
  private channelCount = 2;
  private interleavedBuffer: Float32Array | null = null;
  private playing = false;

  constructor() {
    super();

    this.port.onmessage = (event: MessageEvent) => {
      const { type, data } = event.data;

      switch (type) {
        case "init":
          this.ringBuffer = createRingBufferReader(data.sharedArrayBuffer);
          this.channelCount = data.channelCount || 2;
          // Pre-allocate buffer for interleaved samples
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

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) {
      return true;
    }

    const outputChannel0 = output[0];
    const outputChannel1 = output[1] || output[0];
    const frameCount = outputChannel0.length;

    // If not playing or no buffer, output silence
    if (!this.playing || !this.ringBuffer || !this.interleavedBuffer) {
      for (let i = 0; i < frameCount; i++) {
        outputChannel0[i] = 0;
        if (output[1]) outputChannel1[i] = 0;
      }
      return true;
    }

    // Read interleaved samples from ring buffer
    const samplesToRead = frameCount * this.channelCount;
    const samplesRead = ringBufferPop(
      this.ringBuffer,
      this.interleavedBuffer.subarray(0, samplesToRead),
    );

    // De-interleave into output channels
    const framesRead = Math.floor(samplesRead / this.channelCount);
    for (let i = 0; i < framesRead; i++) {
      outputChannel0[i] = this.interleavedBuffer[i * this.channelCount];
      if (this.channelCount > 1) {
        outputChannel1[i] = this.interleavedBuffer[i * this.channelCount + 1];
      } else {
        outputChannel1[i] = outputChannel0[i]; // Mono to stereo
      }
    }

    // Fill remaining with silence if we didn't get enough samples
    for (let i = framesRead; i < frameCount; i++) {
      outputChannel0[i] = 0;
      if (output[1]) outputChannel1[i] = 0;
    }

    // Report buffer health periodically
    if (Math.random() < 0.01) {
      const available =
        Atomics.load(this.ringBuffer.writePtr, 0) - Atomics.load(this.ringBuffer.readPtr, 0);
      const health = (available / this.ringBuffer.capacity) * 100;
      this.port.postMessage({ type: "buffer-health", health });
    }

    return true;
  }
}

registerProcessor("vega-audio-processor", VegaAudioProcessor);
