/**
 * E2E tests for Vega player: load MP4 from fixtures, play, assert canvas and state.
 * Runs in browser (Vitest + Playwright Chromium). Fixture: tests/fixtures/h264.mp4
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createVega } from "../../src/index.js";

import h264FixtureUrl from "../fixtures/h264.mp4?url";

describe("Vega playback E2E", () => {
  let canvas: HTMLCanvasElement;
  let player: ReturnType<typeof createVega>;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
  });

  afterEach(() => {
    if (player && !player.state.match(/destroyed|error/)) {
      try {
        player.destroy();
      } catch {
        // ignore
      }
    }
  });

  it("creates player with canvas and state is idle", () => {
    player = createVega({ canvas, rendererType: "2d" });
    expect(player).toBeDefined();
    expect(player.state).toBe("idle");
    expect(typeof player.load).toBe("function");
    expect(typeof player.play).toBe("function");
    player.destroy();
  });

  it("loads fixture MP4, play(), then state is playing and currentTime advances", async () => {
    player = createVega({ canvas, rendererType: "2d" });
    await player.load(h264FixtureUrl);
    expect(player.state).toBe("ready");
    expect(player.mediaInfo).toBeTruthy();
    expect(player.duration).toBeGreaterThan(0);

    player.play();
    expect(player.state).toBe("playing");

    await new Promise((r) => setTimeout(r, 1500));
    expect(player.currentTime).toBeGreaterThan(0);
    expect(player.state).toBe("playing");
  }, 10000);

  it("after load+play, canvas has non-zero pixel data (frame drawn)", async () => {
    player = createVega({ canvas, rendererType: "2d" });
    await player.load(h264FixtureUrl);
    player.play();

    await new Promise((r) => setTimeout(r, 2000));

    const ctx = canvas.getContext("2d");
    expect(ctx).toBeTruthy();
    if (!ctx) return;
    const imageData = ctx.getImageData(
      0,
      0,
      Math.min(100, canvas.width),
      Math.min(100, canvas.height),
    );
    const sum = imageData.data.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0);
  }, 12000);

  it("pause() then state paused and currentTime stable; seek(t) then seeked and currentTime near t; play() then playing", async () => {
    player = createVega({ canvas, rendererType: "2d" });
    await player.load(h264FixtureUrl);
    player.play();
    await new Promise((r) => setTimeout(r, 1000));

    player.pause();
    expect(player.state).toBe("paused");
    const tBefore = player.currentTime;
    await new Promise((r) => setTimeout(r, 300));
    expect(player.state).toBe("paused");
    expect(Math.abs(player.currentTime - tBefore)).toBeLessThan(0.5);

    const seekTo = Math.min(2, player.duration * 0.5);
    const seeked = new Promise<void>((resolve) => {
      player.on("seeked", () => resolve());
    });
    await player.seek(seekTo);
    await seeked;
    expect(Math.abs(player.currentTime - seekTo)).toBeLessThan(0.5);

    await player.play();
    expect(player.state).toBe("playing");
  }, 15000);

  describe("custom adapter (US2)", () => {
    const identityAdapter = {
      process(frame: VideoFrame): VideoFrame {
        return frame;
      },
    };

    it("createVega with identity adapter: load, play, state and currentTime advance, canvas non-empty", async () => {
      player = createVega({ canvas, rendererType: "2d", adapter: identityAdapter });
      await player.load(h264FixtureUrl);
      player.play();
      await new Promise((r) => setTimeout(r, 1500));
      expect(player.state).toBe("playing");
      expect(player.currentTime).toBeGreaterThan(0);
      const ctx = canvas.getContext("2d");
      expect(ctx).toBeTruthy();
      if (ctx) {
        const id = ctx.getImageData(0, 0, 50, 50);
        expect(id.data.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
      }
    }, 10000);

    it("setAdapter(identity) after load, play(): playback and canvas updated", async () => {
      player = createVega({ canvas, rendererType: "2d" });
      await player.load(h264FixtureUrl);
      player.setAdapter(identityAdapter);
      player.play();
      await new Promise((r) => setTimeout(r, 1500));
      expect(player.state).toBe("playing");
      expect(player.getAdapter()).toBe(identityAdapter);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const id = ctx.getImageData(0, 0, 50, 50);
        expect(id.data.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
      }
    }, 10000);

    it("when adapter throws: playback does not crash and error is surfaced", async () => {
      player = createVega({ canvas, rendererType: "2d" });
      const errorEvent = new Promise<{ message: string }>((resolve) => {
        player.on("error", (e: { message: string }) => resolve(e));
      });
      const throwingAdapter = {
        process(_frame: VideoFrame): VideoFrame {
          throw new Error("adapter error");
        },
      };
      player.setAdapter(throwingAdapter);
      await player.load(h264FixtureUrl);
      player.play();
      const e = await errorEvent;
      expect(e.message).toContain("adapter");
      expect(player.state).not.toBe("destroyed");
      player.pause();
    }, 10000);
  });

  it("default options: load+play no error; then setAdapter(identity) playback continues", async () => {
    player = createVega({ canvas, rendererType: "2d" });
    await player.load(h264FixtureUrl);
    player.play();
    await new Promise((r) => setTimeout(r, 800));
    expect(player.state).toBe("playing");
    expect(player.currentTime).toBeGreaterThan(0);
    player.setAdapter({
      process(frame: VideoFrame) {
        return frame;
      },
    });
    await new Promise((r) => setTimeout(r, 800));
    expect(player.state).toBe("playing");
    expect(player.currentTime).toBeGreaterThan(0);
  }, 10000);

  it("load invalid data (non-MP4 blob): rejects or error event and state === 'error'", async () => {
    player = createVega({ canvas, rendererType: "2d" });
    const invalidBlob = new Blob(["not an mp4"], { type: "application/octet-stream" });
    await expect(player.load(invalidBlob)).rejects.toThrow();
    expect(player.state).toBe("error");
  }, 8000);
});
