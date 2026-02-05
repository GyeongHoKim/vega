import type { VideoRenderer } from "../types/index.js";

const VERTEX_SHADER = `
attribute vec2 xy;
varying highp vec2 uv;
void main(void) {
  gl_Position = vec4(xy, 0.0, 1.0);
  uv = vec2((1.0 + xy.x) / 2.0, (1.0 - xy.y) / 2.0);
}
`;

const FRAGMENT_SHADER = `
varying highp vec2 uv;
uniform sampler2D texture;
void main(void) {
  gl_FragColor = texture2D(texture, uv);
}
`;

/**
 * WebGL renderer. Draws VideoFrame to canvas via WebGL texture and fullscreen quad.
 * Per W3C WebCodecs sample. Throws if frame is closed/invalid (spec edge case).
 */
export class WebGLRenderer implements VideoRenderer {
  #canvas: HTMLCanvasElement;
  #gl: WebGLRenderingContext;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl || !("createShader" in gl)) {
      throw new Error("WebGL is not available in this environment.");
    }
    this.#gl = gl as WebGLRenderingContext;

    const vs = this.#compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.#compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = this.#linkProgram(vs, fs);
    gl.useProgram(program);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const xyLoc = gl.getAttribLocation(program, "xy");
    gl.vertexAttribPointer(xyLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(xyLoc);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  #compileShader(type: number, source: string): WebGLShader {
    const gl = this.#gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  }

  #linkProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const gl = this.#gl;
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${log}`);
    }
    return program;
  }

  draw(frame: VideoFrame): void {
    if (frame.displayWidth === 0 || frame.displayHeight === 0) {
      frame.close();
      throw new Error("VideoFrame has zero display dimensions.");
    }
    const gl = this.#gl;
    this.#canvas.width = frame.displayWidth;
    this.#canvas.height = frame.displayHeight;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    frame.close();

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }
}
