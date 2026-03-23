import { describe, it, expect } from "vitest";
import { rawToVideoFrame, getRawByteLength } from "../../src/index.js";
import { VideoRendererFactory } from "../../src/factory.js";

/** External reference: ffmpeg-decode first I-frame from h264.mp4 to RGBA (1920×1080). */
import rgbaFixtureUrl from "../fixtures/frame_1920x1080_rgba.raw?url";
const RGBA_FIXTURE_WIDTH = 1920;
const RGBA_FIXTURE_HEIGHT = 1080;

describe("Canvas2DRenderer", () => {
  it("getRawByteLength matches fixture sizes for I420 and RGBA 1920×1080", () => {
    expect(getRawByteLength("I420", 1920, 1080)).toBe(3_110_400);
    expect(getRawByteLength("RGBA", 1920, 1080)).toBe(8_294_400);
  });

  it("draws RGBA fixture via rawToVideoFrame and canvas pixels match reference", async () => {
    if (typeof VideoFrame === "undefined") return;
    const res = await fetch(rgbaFixtureUrl);
    expect(res.ok).toBe(true);
    const ab = await res.arrayBuffer();
    const frame = rawToVideoFrame(ab, "RGBA", RGBA_FIXTURE_WIDTH, RGBA_FIXTURE_HEIGHT);
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "2d" });
    renderer.draw(frame);
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeTruthy();
    if (!ctx) throw new Error("2d context missing");
    const imageData = ctx.getImageData(0, 0, RGBA_FIXTURE_WIDTH, RGBA_FIXTURE_HEIGHT);
    const expected = new Uint8ClampedArray(ab);
    expect(imageData.data.length).toBe(expected.length);
    expect(Array.from(imageData.data)).toEqual(Array.from(expected));
  });

  it("draws external RGBA fixture (h264 I-frame) and canvas pixels match reference", async () => {
    if (typeof VideoFrame === "undefined") return;
    const res = await fetch(rgbaFixtureUrl);
    expect(res.ok).toBe(true);
    const ab = await res.arrayBuffer();
    expect(ab.byteLength).toBe(RGBA_FIXTURE_WIDTH * RGBA_FIXTURE_HEIGHT * 4);
    const data = new Uint8ClampedArray(ab);
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "2d" });
    const frame = new VideoFrame(data, {
      format: "RGBA",
      codedWidth: RGBA_FIXTURE_WIDTH,
      codedHeight: RGBA_FIXTURE_HEIGHT,
      displayWidth: RGBA_FIXTURE_WIDTH,
      displayHeight: RGBA_FIXTURE_HEIGHT,
      timestamp: 0,
    });
    renderer.draw(frame);
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeTruthy();
    if (!ctx) throw new Error("2d context missing");
    const imageData = ctx.getImageData(0, 0, RGBA_FIXTURE_WIDTH, RGBA_FIXTURE_HEIGHT);
    expect(imageData.data.length).toBe(data.length);
    expect(Array.from(imageData.data)).toEqual(Array.from(data));
  });

  it("creates a renderer with type 2d and draws a frame to canvas", () => {
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "2d" });
    expect(renderer).toBeDefined();
    expect(typeof renderer.draw).toBe("function");

    // Create a minimal VideoFrame-like object for testing (browser has real VideoFrame)
    if (typeof VideoFrame !== "undefined") {
      const width = 320;
      const height = 240;
      const data = new Uint8ClampedArray(width * height * 4);
      const frame = new VideoFrame(data, {
        format: "RGBA",
        codedWidth: width,
        codedHeight: height,
        displayWidth: width,
        displayHeight: height,
        timestamp: 0,
      });
      renderer.draw(frame);
      expect(canvas.width).toBe(width);
      expect(canvas.height).toBe(height);
    } else {
      expect(canvas).toBeDefined();
    }
  });

  it("creates a renderer when type is webgl (if WebGL available)", () => {
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "webgl" });
    expect(renderer).toBeDefined();
    expect(typeof renderer.draw).toBe("function");
  });

  it("throws when type is webgpu and WebGPU is not available", () => {
    const canvas = document.createElement("canvas");
    if (navigator.gpu) {
      expect(VideoRendererFactory.create(canvas, { type: "webgpu" })).toBeDefined();
    } else {
      expect(() => VideoRendererFactory.create(canvas, { type: "webgpu" })).toThrow();
    }
  });
});
