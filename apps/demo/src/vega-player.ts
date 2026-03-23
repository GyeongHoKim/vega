import { createVega } from "@gyeonghokim/vega";
import type { PlaybackState, Vega, VegaErrorCode, VegaErrorEvent } from "@gyeonghokim/vega";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { PropertyValues } from "lit";

const ERROR_CODE_MESSAGES: Record<VegaErrorCode, string> = {
  LOAD_ERROR: "Could not load media.",
  DECODE_ERROR: "Decoding failed.",
  DEMUX_ERROR: "Could not read the container.",
  RENDER_ERROR: "Rendering failed.",
  ADAPTER_ERROR: "Media adapter error.",
  UNSUPPORTED_FORMAT: "This format is not supported.",
  NETWORK_ERROR: "Network error while loading media.",
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

@customElement("vega-player")
export class VegaPlayer extends LitElement {
  /** Remote media URL to load (optional). */
  @property({ type: String, reflect: true }) src = "";

  @query("canvas") canvas!: HTMLCanvasElement;

  @state() private _state: PlaybackState = "idle";
  @state() private _currentTime = 0;
  @state() private _duration = 0;
  @state() private _error: string | null = null;
  @state() private _webCodecsSupported = true;

  private player: Vega | null = null;

  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      max-width: 960px;
      margin: 0 auto;
    }

    .wrap {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    canvas {
      width: 100%;
      max-height: 70vh;
      background: #111;
      border-radius: 8px;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    button {
      padding: 0.4rem 0.9rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
      background: Field;
      color: FieldText;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    input[type="range"] {
      flex: 1 1 180px;
      min-width: 120px;
    }

    .time {
      font-variant-numeric: tabular-nums;
      min-width: 7ch;
    }

    .banner {
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      background: color-mix(in srgb, CanvasText 6%, transparent);
    }

    .banner[role="alert"] {
      border-color: rgba(200, 60, 60, 0.5);
      background: rgba(200, 60, 60, 0.12);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._webCodecsSupported = typeof VideoDecoder !== "undefined";
    if (!this._webCodecsSupported) {
      this._error =
        "WebCodecs is not available in this browser. Use a recent Chrome, Edge, Safari, or Firefox.";
    }
  }

  disconnectedCallback(): void {
    this.teardownPlayer();
    super.disconnectedCallback();
  }

  firstUpdated(): void {
    if (!this._webCodecsSupported) return;
    this.initPlayer();
  }

  protected updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has("src") && this.player && this.src) {
      void this.loadUrl(this.src);
    }
  }

  private teardownPlayer(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  private initPlayer(): void {
    if (!this._webCodecsSupported) return;
    this.teardownPlayer();
    this._error = null;
    this.player = createVega({ canvas: this.canvas });
    const p = this.player;
    p.on("timeupdate", () => {
      this._currentTime = p.currentTime;
      this._duration = p.duration;
      this._state = p.state;
      this.requestUpdate();
    });
    p.on("error", (data: unknown) => {
      const ev = data as VegaErrorEvent | undefined;
      const msg = ev?.code
        ? (ERROR_CODE_MESSAGES[ev.code] ?? ev.message)
        : (ev?.message ?? "Playback error");
      this._error = msg;
      this._state = p.state;
      this.requestUpdate();
    });
    p.on("play", () => {
      this._state = p.state;
      this.requestUpdate();
    });
    p.on("pause", () => {
      this._state = p.state;
      this.requestUpdate();
    });
    p.on("ended", () => {
      this._state = p.state;
      this.requestUpdate();
    });
  }

  /** Load media from a remote URL (also used when `src` attribute is set). */
  async loadUrl(url: string): Promise<void> {
    if (!this.player || !url) return;
    this._error = null;
    this._state = "loading";
    try {
      await this.player.load(url);
      this._duration = this.player.duration;
      this._state = this.player.state;
    } catch (e) {
      this._error = e instanceof Error ? e.message : "Load failed";
      this._state = "error";
    }
  }

  /** Load a user-selected file from a file input `change` event. */
  async handleFileSelect(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!this.player || !file) return;
    this._error = null;
    this._state = "loading";
    try {
      await this.player.load(file);
      this._duration = this.player.duration;
      this._state = this.player.state;
    } catch (e) {
      this._error = e instanceof Error ? e.message : "Load failed";
      this._state = "error";
    }
  }

  private async togglePlay(): Promise<void> {
    if (!this.player) return;
    if (this.player.state === "playing") {
      this.player.pause();
    } else {
      await this.player.play();
    }
    this._state = this.player.state;
  }

  private async onSeekInput(e: Event) {
    if (!this.player) return;
    const input = e.target as HTMLInputElement;
    const t = Number.parseFloat(input.value);
    await this.player.seek(t);
    this._currentTime = this.player.currentTime;
  }

  render() {
    const canPlay =
      this._state === "ready" || this._state === "playing" || this._state === "paused";

    return html`
      <div class="wrap">
        ${
          !this._webCodecsSupported
            ? html`<div class="banner" role="alert">${this._error}</div>`
            : nothing
        }
        ${
          this._webCodecsSupported && this._error
            ? html`<div class="banner" role="alert">${this._error}</div>`
            : nothing
        }
        <canvas width="1280" height="720"></canvas>
        <div class="controls">
          <button type="button" ?disabled=${!canPlay} @click=${() => this.togglePlay()}>
            ${this._state === "playing" ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min="0"
            max=${this._duration > 0 ? String(this._duration) : "0"}
            step="0.25"
            .value=${String(this._currentTime)}
            ?disabled=${!canPlay || this._duration <= 0}
            @input=${(e: Event) => this.onSeekInput(e)}
          />
          <span class="time"
            >${formatTime(this._currentTime)} / ${formatTime(this._duration)}</span
          >
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "vega-player": VegaPlayer;
  }
}
