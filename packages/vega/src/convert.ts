/**
 * Converter utilities: raw binary buffers ↔ VideoFrame for WebCodecs VideoPixelFormat.
 * Covers 8-bit formats only. Layout follows W3C WebCodecs:
 * https://w3c.github.io/webcodecs/#enumdef-videopixelformat
 */

/** 8-bit VideoPixelFormat variants supported by this converter. */
export type SupportedPixelFormat =
  | "I420" // 4:2:0 Y, U, V
  | "I420A" // 4:2:0 Y, U, V, A
  | "I422" // 4:2:2 Y, U, V
  | "I444" // 4:4:4 Y, U, V
  | "I444A" // 4:4:4 Y, U, V, A
  | "NV12" // 4:2:0 Y, UV (interleaved)
  | "RGBA" // 4:4:4 RGBA
  | "RGBX" // 4:4:4 RGBX (opaque)
  | "BGRA" // 4:4:4 BGRA
  | "BGRX"; // 4:4:4 BGRX (opaque)

const W = (w: number, h: number) => Math.ceil(w / 2) * Math.ceil(h / 2);
const H422 = (w: number, h: number) => Math.ceil(w / 2) * h;

/**
 * Byte length of a tightly-packed raw buffer for the given format and dimensions (8-bit).
 */
export function getRawByteLength(
  format: SupportedPixelFormat,
  width: number,
  height: number,
): number {
  const wh = width * height;
  switch (format) {
    case "I420":
      return wh + W(width, height) * 2;
    case "I420A":
      return wh * 2 + W(width, height) * 2;
    case "I422":
      return wh + H422(width, height) * 2;
    case "I444":
      return wh * 3;
    case "I444A":
      return wh * 4;
    case "NV12":
      return wh + W(width, height) * 2;
    case "RGBA":
    case "RGBX":
    case "BGRA":
    case "BGRX":
      return wh * 4;
    default: {
      const _: never = format;
      return 0;
    }
  }
}

export interface RawToVideoFrameInit {
  timestamp?: number;
  displayWidth?: number;
  displayHeight?: number;
}

/**
 * Build a VideoFrame from a tightly-packed raw buffer (e.g. ffmpeg raw output).
 * Buffer layout must match the format’s plane order per WebCodecs.
 */
export function rawToVideoFrame(
  data: BufferSource,
  format: SupportedPixelFormat,
  width: number,
  height: number,
  init: RawToVideoFrameInit = {},
): VideoFrame {
  const expected = getRawByteLength(format, width, height);
  const ab = data instanceof ArrayBuffer ? data : data.buffer;
  const byteLength = ab.byteLength;
  if (byteLength < expected) {
    throw new RangeError(
      `Raw buffer too small for ${format} ${width}x${height}: need ${expected}, got ${byteLength}`,
    );
  }
  const buffer = ab.slice(0, expected);
  const initObj: VideoFrameBufferInit = {
    format: format as VideoPixelFormat,
    codedWidth: width,
    codedHeight: height,
    timestamp: init.timestamp ?? 0,
    displayWidth: init.displayWidth ?? width,
    displayHeight: init.displayHeight ?? height,
  };
  return new VideoFrame(buffer, initObj);
}

/**
 * Copy a VideoFrame’s pixel data into a new ArrayBuffer in the frame’s format.
 * Uses the frame’s allocationSize() for the destination; resolves when copy completes.
 */
export async function videoFrameToRaw(frame: VideoFrame): Promise<ArrayBuffer> {
  const format = frame.format;
  if (format === null) {
    throw new TypeError("VideoFrame has no format (detached or unsupported).");
  }
  const supported: SupportedPixelFormat[] = [
    "I420",
    "I420A",
    "I422",
    "I444",
    "I444A",
    "NV12",
    "RGBA",
    "RGBX",
    "BGRA",
    "BGRX",
  ];
  if (!supported.includes(format as SupportedPixelFormat)) {
    throw new TypeError(`Unsupported format for raw export: ${format}`);
  }
  const length = frame.allocationSize();
  const buffer = new ArrayBuffer(length);
  await frame.copyTo(buffer);
  return buffer;
}
