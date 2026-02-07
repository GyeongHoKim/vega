import { useEffect, useState } from "react";
import ExampleSelector from "./pages/ExampleSelector";
import AudioVideoExample from "./pages/AudioVideoExample";

function getRouteFromHash(): string {
  const hash = window.location.hash.slice(1).replace(/^\/?|\/$/g, "") || "";
  return hash === "audio-video" ? "audio-video" : "";
}

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "audio-video") {
    return (
      <div>
        <h1>Vega Demo</h1>
        <AudioVideoExample />
      </div>
    );
  }

  return (
    <div>
      <h1>Vega Demo</h1>
      <p>Select an example to get started.</p>
      <ExampleSelector />
    </div>
  );
}
