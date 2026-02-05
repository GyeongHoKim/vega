import { describe, it, expect } from "vitest";
import { VideoRendererFactory } from "../../src/index.js";

/** External reference: ffmpeg-decode first I-frame from h264.mp4 to RGBA (1920×1080). */
import rgbaFixtureUrl from "../fixtures/frame_1920x1080_rgba.raw?url";
const RGBA_FIXTURE_WIDTH = 1920;
const RGBA_FIXTURE_HEIGHT = 1080;

/** WebGL readPixels returns rows bottom-to-top; flip to top-to-bottom to match fixture. */
function readPixelsTopToBottom(
  gl: WebGLRenderingContext,
  x: number,
  y: number,
  width: number,
  height: number,
): Uint8Array {
  const rowBytes = width * 4;
  const buf = new Uint8Array(rowBytes * height);
  gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const flipped = new Uint8Array(buf.length);
  for (let r = 0; r < height; r++) {
    const srcRow = height - 1 - r;
    flipped.set(buf.subarray(srcRow * rowBytes, (srcRow + 1) * rowBytes), r * rowBytes);
  }
  return flipped;
}

describe("WebGLRenderer", () => {
  it("draws external RGBA fixture (h264 I-frame) and canvas pixels match reference", async () => {
    if (typeof VideoFrame === "undefined") return;
    const res = await fetch(rgbaFixtureUrl);
    expect(res.ok).toBe(true);
    const ab = await res.arrayBuffer();
    expect(ab.byteLength).toBe(RGBA_FIXTURE_WIDTH * RGBA_FIXTURE_HEIGHT * 4);
    const data = new Uint8ClampedArray(ab);
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "webgl" });
    const frame = new VideoFrame(data, {
      format: "RGBA",
      codedWidth: RGBA_FIXTURE_WIDTH,
      codedHeight: RGBA_FIXTURE_HEIGHT,
      displayWidth: RGBA_FIXTURE_WIDTH,
      displayHeight: RGBA_FIXTURE_HEIGHT,
      timestamp: 0,
    });
    renderer.draw(frame);
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    expect(gl).toBeTruthy();
    const readBack = readPixelsTopToBottom(
      gl as WebGLRenderingContext,
      0,
      0,
      RGBA_FIXTURE_WIDTH,
      RGBA_FIXTURE_HEIGHT,
    );
    expect(readBack.length).toBe(data.length);
    expect(Array.from(readBack)).toEqual(Array.from(data));
  });

  it("creates a renderer with type webgl and has draw method", () => {
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "webgl" });
    expect(renderer).toBeDefined();
    expect(typeof renderer.draw).toBe("function");
  });

  it("draws a VideoFrame to canvas when available", () => {
    if (typeof VideoFrame === "undefined") return;
    const canvas = document.createElement("canvas");
    const renderer = VideoRendererFactory.create(canvas, { type: "webgl" });
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
    renderer.draw(frame);
    expect(canvas.width).toBe(width);
    expect(canvas.height).toBe(height);
  });
});
