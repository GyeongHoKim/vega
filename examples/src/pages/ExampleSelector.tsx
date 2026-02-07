export default function ExampleSelector() {
  const goToAudioVideo = () => {
    window.location.hash = "#/audio-video";
  };

  return (
    <section>
      <h2>Examples</h2>
      <ul>
        <li>
          <button type="button" onClick={goToAudioVideo}>
            Audio &amp; Video
          </button>
          <span> — Play sample video/audio and upload MP4</span>
        </li>
      </ul>
    </section>
  );
}
