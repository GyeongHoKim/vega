import { useRef, useEffect, useState } from "react";
import { createVega } from "vega";

const SAMPLE_VIDEO_URL = `${import.meta.env.BASE_URL}sample.mp4`;
const LARGE_FILE_BYTES = 200 * 1024 * 1024; // 200 MB

function useUnsupportedBrowser(): string | null {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (typeof VideoDecoder === "undefined" || typeof AudioDecoder === "undefined") {
      setMsg("Your browser may not support WebCodecs. Try Chrome or Edge for full playback.");
    }
  }, []);
  return msg;
}

export default function AudioVideoExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<ReturnType<typeof createVega> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const unsupportedMsg = useUnsupportedBrowser();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const player = createVega({ canvas, rendererType: "2d" });
    playerRef.current = player;

    player.on("error", (data: unknown) => {
      setError((data as { message?: string })?.message ?? "Playback error");
    });
    player.on("loadedmetadata", () => {
      setDuration(player.duration);
      setError(null);
    });
    player.on("timeupdate", () => setCurrentTime(player.currentTime));
    player.on("play", () => setIsPlaying(true));
    player.on("pause", () => setIsPlaying(false));
    player.on("ended", () => setIsPlaying(false));

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, []);

  const playSample = async () => {
    const player = playerRef.current;
    if (!player) return;
    setError(null);
    try {
      await player.load(SAMPLE_VIDEO_URL);
      await player.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample");
    }
  };

  const togglePlayPause = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.state === "playing") player.pause();
    else player.play();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const player = playerRef.current;
    if (!player) return;
    const t = Number.parseFloat(e.target.value);
    if (Number.isFinite(t)) player.seek(t);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !playerRef.current) return;
    setError(null);
    if (file.size > LARGE_FILE_BYTES) {
      setError("File is very large. Playback may be slow or limited by browser memory.");
      return;
    }
    try {
      await playerRef.current.load(file);
      await playerRef.current.play();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Cannot play this file. Please choose an MP4 file.",
      );
    }
  };

  return (
    <section>
      <h2>Audio &amp; Video</h2>
      {unsupportedMsg && <p style={{ color: "#666", fontSize: "0.9rem" }}>{unsupportedMsg}</p>}
      {error && (
        <p role="alert" style={{ color: "var(--error, #c00)" }}>
          {error}
        </p>
      )}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ display: "block", maxWidth: "100%", background: "#111" }}
      />
      <div
        style={{
          marginTop: "0.5rem",
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span>Upload MP4</span>
          <input
            type="file"
            accept="video/mp4,.mp4"
            onChange={handleFileSelect}
            aria-label="Choose MP4 file to play"
          />
        </label>
        <button type="button" onClick={playSample}>
          Play sample
        </button>
        <button type="button" onClick={togglePlayPause} disabled={duration === 0}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span>Seek</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={duration === 0}
            style={{ width: "120px" }}
          />
        </label>
        <span style={{ fontSize: "0.9rem", color: "#666" }}>
          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </span>
      </div>
    </section>
  );
}
