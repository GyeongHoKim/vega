/**
 * VideoRenderer (Worker-side)
 * Handles video decoding and frame buffering.
 * Frames are sent to the main thread for rendering.
 */

const FRAME_BUFFER_TARGET_SIZE = 3;
const ENABLE_DEBUG_LOGGING = false;

function debugLog(...args: unknown[]): void {
  if (ENABLE_DEBUG_LOGGING) {
    console.debug("[VideoRenderer]", ...args);
  }
}

export interface VideoRendererCallbacks {
  onFrame: (frame: VideoFrame) => void;
  onError: (error: Error) => void;
}

/**
 * Manages video decoding and frame buffering.
 */
export class VideoRendererWorker {
  private decoder: VideoDecoder | null = null;
  private frameBuffer: VideoFrame[] = [];
  private fillInProgress = false;
  private initResolver: (() => void) | null = null;
  private callbacks: VideoRendererCallbacks;

  // Demuxer reference
  private getNextChunk: (() => Promise<EncodedVideoChunk | null>) | null = null;

  constructor(callbacks: VideoRendererCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initialize the video decoder.
   */
  async initialize(
    config: VideoDecoderConfig,
    getNextChunk: () => Promise<EncodedVideoChunk | null>,
  ): Promise<void> {
    this.getNextChunk = getNextChunk;

    this.decoder = new VideoDecoder({
      output: this.bufferFrame.bind(this),
      error: (e) => {
        console.error("[VideoRenderer] Decoder error:", e);
        this.callbacks.onError(new Error(`Video decode error: ${e.message}`));
      },
    });

    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) {
      throw new Error(`Video codec not supported: ${config.codec}`);
    }

    debugLog("Configuring decoder:", config);
    this.decoder.configure(config);

    return new Promise((resolve) => {
      this.initResolver = resolve;
      this.fillFrameBuffer();
    });
  }

  /**
   * Render a frame for the given timestamp.
   * @param timestamp - Target timestamp in microseconds
   */
  render(timestamp: number): void {
    debugLog("render(%d)", timestamp);

    const frame = this.chooseFrame(timestamp);
    this.fillFrameBuffer();

    if (frame === null) {
      debugLog("No frame available");
      return;
    }

    // Send frame to main thread
    this.callbacks.onFrame(frame);
  }

  /**
   * Get the next buffered frame without timestamp selection.
   * Useful for stepping through frames.
   */
  getNextFrame(): VideoFrame | null {
    if (this.frameBuffer.length === 0) {
      return null;
    }
    return this.frameBuffer.shift() || null;
  }

  /**
   * Check if frames are buffered and ready.
   */
  hasBufferedFrames(): boolean {
    return this.frameBuffer.length > 0;
  }

  /**
   * Get the number of buffered frames.
   */
  getBufferSize(): number {
    return this.frameBuffer.length;
  }

  /**
   * Flush decoder and clear buffer (for seeking).
   */
  async flush(): Promise<void> {
    // Clear existing frames
    for (const frame of this.frameBuffer) {
      frame.close();
    }
    this.frameBuffer = [];

    // Flush decoder
    if (this.decoder && this.decoder.state === "configured") {
      await this.decoder.flush();
    }
  }

  /**
   * Destroy the renderer and release resources.
   */
  destroy(): void {
    for (const frame of this.frameBuffer) {
      frame.close();
    }
    this.frameBuffer = [];

    if (this.decoder?.state !== "closed") {
      this.decoder?.close();
    }
    this.decoder = null;
  }

  /**
   * Choose the best frame for the given timestamp.
   * Closes stale frames that are too old.
   */
  private chooseFrame(timestamp: number): VideoFrame | null {
    if (this.frameBuffer.length === 0) {
      return null;
    }

    let minTimeDelta = Number.MAX_VALUE;
    let frameIndex = -1;

    // Find frame closest to target timestamp
    for (let i = 0; i < this.frameBuffer.length; i++) {
      const timeDelta = Math.abs(timestamp - this.frameBuffer[i].timestamp);
      if (timeDelta < minTimeDelta) {
        minTimeDelta = timeDelta;
        frameIndex = i;
      } else {
        // Timestamps are monotonically increasing, so we can stop
        break;
      }
    }

    if (frameIndex === -1) {
      return null;
    }

    // Close and remove stale frames (older than chosen)
    if (frameIndex > 0) {
      debugLog("Dropping %d stale frames", frameIndex);
      for (let i = 0; i < frameIndex; i++) {
        this.frameBuffer[i].close();
      }
      this.frameBuffer.splice(0, frameIndex);
    }

    const chosenFrame = this.frameBuffer[0];
    debugLog(
      "Frame time delta = %dms (%d vs %d)",
      minTimeDelta / 1000,
      timestamp,
      chosenFrame.timestamp,
    );

    return chosenFrame;
  }

  /**
   * Fill the frame buffer by decoding more chunks.
   */
  private async fillFrameBuffer(): Promise<void> {
    if (this.frameBufferFull()) {
      debugLog("Frame buffer full");

      if (this.initResolver) {
        this.initResolver();
        this.initResolver = null;
      }
      return;
    }

    // Prevent concurrent fills
    if (this.fillInProgress) {
      return;
    }
    this.fillInProgress = true;

    try {
      while (
        this.frameBuffer.length < FRAME_BUFFER_TARGET_SIZE &&
        this.decoder &&
        this.decoder.decodeQueueSize < FRAME_BUFFER_TARGET_SIZE
      ) {
        if (!this.getNextChunk) break;

        const chunk = await this.getNextChunk();
        if (!chunk) {
          debugLog("No more video chunks");
          break;
        }

        this.decoder.decode(chunk);
      }
    } catch (error) {
      console.error("[VideoRenderer] Fill error:", error);
    }

    this.fillInProgress = false;

    // Schedule another fill attempt
    setTimeout(() => this.fillFrameBuffer(), 0);
  }

  private frameBufferFull(): boolean {
    return this.frameBuffer.length >= FRAME_BUFFER_TARGET_SIZE;
  }

  private bufferFrame(frame: VideoFrame): void {
    debugLog("Buffered frame:", frame.timestamp);
    this.frameBuffer.push(frame);
  }
}
