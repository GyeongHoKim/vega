import type { VideoRenderer, VideoRendererOptions } from "./types/index.js";
import { Canvas2DRenderer } from "./renderers/renderer-2d.js";
import { WebGLRenderer } from "./renderers/renderer-webgl.js";
import { WebGPURenderer } from "./renderers/renderer-webgpu.js";

const DEFAULT_TYPE = "2d" as const;

/**
 * Creates a VideoRenderer for the given canvas and options.
 * Default backend is "2d" if options are omitted.
 * For WebGPU, draw() returns a Promise; for 2D and WebGL it is synchronous.
 * @param canvas - The target canvas element.
 * @param options - Optional. type: "2d" | "webgl" | "webgpu". Defaults to "2d".
 * @returns A VideoRenderer instance.
 * @throws When the requested backend is unavailable or context creation fails.
 */
export function create(
  canvas: HTMLCanvasElement,
  options?: Partial<VideoRendererOptions>,
): VideoRenderer {
  const type = options?.type ?? DEFAULT_TYPE;

  if (type === "2d") {
    return new Canvas2DRenderer(canvas);
  }
  if (type === "webgl") {
    return new WebGLRenderer(canvas);
  }
  if (type === "webgpu") {
    if (typeof navigator !== "undefined" && !navigator.gpu) {
      throw new Error("WebGPU is not available in this environment.");
    }
    return new WebGPURenderer(canvas);
  }

  throw new Error(`Unsupported renderer type: ${type}`);
}

/** Factory object for API compatibility. */
export const VideoRendererFactory = { create };
