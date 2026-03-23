import { BlobSource, BufferSource, ReadableStreamSource, Source, UrlSource } from "mediabunny";
import type { MediaInput } from "../types/vega.js";

export function createSource(input: MediaInput): Source {
  if (input instanceof Source) {
    return input;
  }

  if (typeof input === "string" || input instanceof URL) {
    return new UrlSource(input);
  }

  if (input instanceof Blob) {
    return new BlobSource(input);
  }

  if (input instanceof ReadableStream) {
    return new ReadableStreamSource(input);
  }

  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    return new BufferSource(input);
  }

  throw new TypeError("Unsupported media input type");
}
