/**
 * Renderer backend type: "2d" (Canvas 2D), "webgl", or "webgpu".
 */
export type RendererType = "2d" | "webgl" | "webgpu";

/**
 * Options when creating a VideoRenderer. Defaults to "2d" if omitted.
 */
export interface VideoRendererOptions {
  /** Which backend to use. */
  type: RendererType;
}

/**
 * Interface for drawing a VideoFrame to a canvas. Implementations may be 2D, WebGL, or WebGPU.
 * WebGPU backend may return a Promise from draw().
 */
export interface VideoRenderer {
  /**
   * Draws the given VideoFrame to the canvas associated with this renderer.
   * The implementation may call frame.close() after use; do not use the frame after draw.
   * @param frame - A valid, non-closed VideoFrame from WebCodecs or similar.
   */
  draw(frame: VideoFrame): void | Promise<void>;
}
