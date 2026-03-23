import type { VideoRenderer } from "../types/index.js";

const VERTEX_WGSL = `
struct VertexOutput {
  @builtin(position) Position: vec4f,
  @location(0) uv: vec2f,
}
@vertex
fn vert_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(1, 1), vec2f(1, -1), vec2f(-1, -1),
    vec2f(1, 1), vec2f(-1, -1), vec2f(-1, 1)
  );
  var uv = array<vec2f, 6>(
    vec2f(1, 0), vec2f(1, 1), vec2f(0, 1),
    vec2f(1, 0), vec2f(0, 1), vec2f(0, 0)
  );
  var o: VertexOutput;
  o.Position = vec4f(pos[vi], 0, 1);
  o.uv = uv[vi];
  return o;
}
`;

const FRAGMENT_WGSL = `
@group(0) @binding(1) var s: sampler;
@group(0) @binding(2) var t: texture_external;
@fragment
fn frag_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(t, s, uv);
}
`;

/**
 * WebGPU renderer. Async setup; draw() returns Promise. Uses importExternalTexture.
 * Per W3C WebCodecs sample. Throws if frame is closed/invalid (spec edge case).
 */
export class WebGPURenderer implements VideoRenderer {
  #canvas: HTMLCanvasElement;
  #started: Promise<void>;
  #initError: Error | null = null;
  #device!: GPUDevice;
  #ctx!: GPUCanvasContext;
  #format!: GPUTextureFormat;
  #pipeline!: GPURenderPipeline;
  #sampler!: GPUSampler;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#started = this.#init().catch((err) => {
      this.#initError = err instanceof Error ? err : new Error(String(err));
    });
  }

  async #init(): Promise<void> {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error("WebGPU is not available in this environment.");
    this.#device = await adapter.requestDevice();
    this.#format = navigator.gpu.getPreferredCanvasFormat();
    const ctx = this.#canvas.getContext("webgpu");
    if (!ctx) throw new Error("WebGPU canvas context is not available.");
    this.#ctx = ctx;
    this.#ctx.configure({ device: this.#device, format: this.#format, alphaMode: "opaque" });

    const vsModule = this.#device.createShaderModule({ code: VERTEX_WGSL });
    const fsModule = this.#device.createShaderModule({ code: FRAGMENT_WGSL });
    this.#pipeline = this.#device.createRenderPipeline({
      layout: "auto",
      vertex: { module: vsModule, entryPoint: "vert_main" },
      fragment: {
        module: fsModule,
        entryPoint: "frag_main",
        targets: [{ format: this.#format }],
      },
      primitive: { topology: "triangle-list" },
    });
    this.#sampler = this.#device.createSampler({});
  }

  async draw(frame: VideoFrame): Promise<void> {
    await this.#started;
    if (this.#initError) throw this.#initError;
    if (frame.displayWidth === 0 || frame.displayHeight === 0) {
      frame.close();
      throw new Error("VideoFrame has zero display dimensions.");
    }
    this.#canvas.width = frame.displayWidth;
    this.#canvas.height = frame.displayHeight;

    const externalTexture = this.#device.importExternalTexture({ source: frame });
    const bindGroup = this.#device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 1, resource: this.#sampler },
        { binding: 2, resource: externalTexture },
      ],
    });

    const encoder = this.#device.createCommandEncoder();
    const view = this.#ctx.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: [0, 0, 0, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.#pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6, 1, 0, 0);
    pass.end();
    this.#device.queue.submit([encoder.finish()]);
    frame.close();
  }
}
