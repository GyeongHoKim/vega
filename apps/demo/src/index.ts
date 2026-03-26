import { VegaPlayer } from "./vega-player.js";

const player = document.querySelector("#player");
const urlInput = document.querySelector("#url");
const fileInput = document.querySelector("#file");

if (player instanceof VegaPlayer && urlInput instanceof HTMLInputElement) {
	urlInput.addEventListener("change", () => {
		const v = urlInput.value.trim();
		player.src = v;
	});
}

if (player instanceof VegaPlayer && fileInput instanceof HTMLInputElement) {
	fileInput.addEventListener("change", (e) => {
		void player.handleFileSelect(e);
	});
}
