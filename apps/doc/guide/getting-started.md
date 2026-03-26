# Getting Started

## Installation

::: code-group

```bash [npm]
npm install @gyeonghokim/vega
```

```bash [pnpm]
pnpm add @gyeonghokim/vega
```

```bash [yarn]
yarn add @gyeonghokim/vega
```

:::

## Quick start

```typescript
import { createVega } from "@gyeonghokim/vega";

const canvas = document.querySelector("canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Expected a canvas element");
}

const player = createVega({ canvas });
await player.load("https://example.com/video.mp4");
await player.play();
```

## Prerequisites

- **Secure context** — WebCodecs requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS or `localhost`).
- **WebCodecs** — Available in modern Chromium-based browsers, Safari 16.4+, and recent Firefox (see table below).

## Browser support

| Browser         | Minimum version |
| --------------- | --------------- |
| Google Chrome   | 94+             |
| Microsoft Edge  | 94+             |
| Safari          | 16.4+           |
| Firefox         | 130+            |

## Troubleshooting

| Symptom | What to check |
| ------- | ------------- |
| **Unsupported format** | Vega currently targets MP4 with codecs your browser can decode; try another file or re-encode. |
| **CORS errors** | Media loaded by URL must be served with CORS headers allowing your origin. |
| **Autoplay blocked** | Browsers require a user gesture for audio; call `play()` after interaction or start muted if policy allows. |
| **No WebCodecs** | Use a supported browser and HTTPS (or localhost). |

## Next steps

- Explore the full surface in the [API Reference](/api/).
- Try the [live demo](https://vega-demo.gyeongho.dev) to see playback and controls in the browser.
