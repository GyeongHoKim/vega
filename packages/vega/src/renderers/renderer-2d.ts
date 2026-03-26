import type { VideoRenderer } from "../types/index.js";

/**
 * 2D Canvas renderer. Draws VideoFrame to canvas using Canvas 2D API.
 * Per W3C WebCodecs sample: sets canvas dimensions to frame size, drawImage, then frame.close().
 * Throws if frame is closed or invalid (spec edge case).
 */
export class Canvas2DRenderer implements VideoRenderer {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is not available.");
    }
    this.#ctx = ctx;
  }

  draw(frame: VideoFrame): void {
    if (frame.displayWidth === 0 || frame.displayHeight === 0) {
      frame.close();
      throw new Error("VideoFrame has zero visible dimensions.");
    }
    if (this.#ctx === null) {
      throw new Error("Canvas 2D context is no longer available (e.g. canvas detached).");
    }
    try {
      this.#canvas.width = frame.displayWidth;
      this.#canvas.height = frame.displayHeight;
      this.#ctx.drawImage(frame, 0, 0, frame.displayWidth, frame.displayHeight);
    } finally {
      frame.close();
    }
  }
}
