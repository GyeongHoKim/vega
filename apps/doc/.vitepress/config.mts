import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DefaultTheme } from "vitepress";
import { defineConfig } from "vitepress";

const __dirname = dirname(fileURLToPath(import.meta.url));

const vegaPkg = JSON.parse(
	readFileSync(
		resolve(__dirname, "../../../packages/vega/package.json"),
		"utf-8",
	),
) as { version: string };

const apiSidebarPath = resolve(__dirname, "../api/typedoc-sidebar.json");

function stripMdFromLinks(
	items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] {
	return items.map((item) => ({
		...item,
		link: item.link?.replace(/\.md$/, ""),
		items: item.items ? stripMdFromLinks(item.items) : undefined,
	}));
}

function loadApiSidebar(): DefaultTheme.SidebarItem[] {
	if (!existsSync(apiSidebarPath)) return [];
	const raw = JSON.parse(
		readFileSync(apiSidebarPath, "utf-8"),
	) as DefaultTheme.SidebarItem[];
	return stripMdFromLinks(raw);
}

export default defineConfig({
	title: "Vega",
	description: "WebCodecs video player with custom frame processing",
	cleanUrls: true,
	markdown: {
		cjkFriendlyEmphasis: false,
	},
	themeConfig: {
		search: {
			provider: "local",
		},
		nav: [
			{ text: "Guide", link: "/guide/what-is-vega" },
			{ text: "API Reference", link: "/api/" },
			{
				text: `v${vegaPkg.version}`,
				items: [
					{
						text: "npm",
						link: "https://www.npmjs.com/package/@gyeonghokim/vega",
					},
					{
						text: "Releases",
						link: "https://github.com/GyeongHoKim/vega/releases",
					},
				],
			},
			{ text: "Live Demo", link: "https://vega-demo.vercel.app" },
		],
		sidebar: {
			"/guide/": [
				{
					text: "Introduction",
					items: [
						{ text: "What is Vega?", link: "/guide/what-is-vega" },
						{ text: "Getting Started", link: "/guide/getting-started" },
					],
				},
			],
			"/api/": [{ text: "Overview", link: "/api/" }, ...loadApiSidebar()],
		},
		socialLinks: [
			{ icon: "github", link: "https://github.com/GyeongHoKim/vega" },
		],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © present GyeongHo Kim",
		},
	},
});
