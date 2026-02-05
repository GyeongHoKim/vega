import { describe, it, expect } from "vitest";
import { VideoRendererFactory } from "../../src/factory.js";

describe("WebGPURenderer", () => {
  it("creates a renderer with type webgpu when WebGPU is available", () => {
    if (!navigator.gpu) return;
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "webgpu" });
    expect(renderer).toBeDefined();
    expect(typeof renderer.draw).toBe("function");
  });

  it("draw returns a Promise and either resolves or throws when init fails", async () => {
    if (!navigator.gpu) return;
    if (typeof VideoFrame === "undefined") return;
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "webgpu" });
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    const frame = new VideoFrame(data, {
      format: "RGBA",
      codedWidth: width,
      codedHeight: height,
      displayWidth: width,
      displayHeight: height,
      timestamp: 0,
    });
    const result = renderer.draw(frame);
    expect(result).toBeInstanceOf(Promise);
    try {
      await result;
      expect(canvas.width).toBe(width);
      expect(canvas.height).toBe(height);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("WebGPU");
    }
  });
});
