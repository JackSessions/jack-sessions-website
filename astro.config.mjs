// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// The site is fully static, so `astro dev` doesn't need the Cloudflare runtime.
// Astro 7 + adapter 14 crash it at startup ("Missing field `moduleType`"), so only
// load the adapter for build/preview.
const isDev = process.argv.includes("dev");

// https://astro.build/config
export default defineConfig({
	site: "https://jacksessions.dev",
	integrations: [mdx(), sitemap()],
	adapter: isDev ? undefined : cloudflare(),
});
