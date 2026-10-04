---
title: "Building This Site With Astro and Cloudflare"
description: "How this site is actually built and deployed: Astro, content collections for blog posts and projects, and Cloudflare Workers redeploying on every push to main."
pubDate: "Oct 04 2026"
tags: ["web", "cloudflare", "astro", "personal"]
---

People ask how this site works, so here's the actual setup, not a generic tutorial. It's [Astro](https://astro.build/) for the framework and [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/) for hosting, and the whole thing redeploys itself about a minute after I push to `main`.

## Why Astro

I wanted a site that's mostly static markdown with a bit of interactivity (a three.js homelab map, a music player), and Astro ships zero JavaScript by default unless a component actually needs it. Blog posts and project cards both live as content collections, markdown files with a typed frontmatter schema, so a new post is just a new file, not a database entry.

```
src/content/blog/my-post.md
src/content/projects/my-tool.md
```

Each one has frontmatter Astro validates against a schema (`src/content/config.ts`), so a typo in a field fails the build instead of silently breaking the page.

## Deploying on Cloudflare

1. **Connect the repo.** Cloudflare dashboard → Workers & Pages → Create → Import a repository, pick the GitHub repo.
2. **Build settings.** Build command `npm run build`, deploy command `npx wrangler deploy`. Astro's Cloudflare adapter handles the rest.
3. **Custom domain.** Project → Settings → Domains & Routes → Add → Custom domain.
4. **Push to deploy.** `git add -A && git commit -m "..." && git push`. Cloudflare picks up the push and rebuilds automatically, no manual deploy step needed day to day.

That's genuinely the whole workflow. I write a post locally, preview it with `npm run dev`, push, and it's live within a minute.

## What I'd tell someone starting from scratch

- **Start from a template, not a blank repo.** This site started from Astro's own blog starter and I reshaped it, rather than building the content-collection plumbing myself.
- **Validate your frontmatter schema early.** Catching a missing field at build time beats finding out a page rendered blank in production.
- **Keep large binaries out of git.** Images go in `public/`, not committed as base64 or anything clever, and anything that's actually a build artifact (like `dist/`) stays gitignored.
- **Let the host do the redeploying.** I don't run a manual deploy command for routine updates. Push to `main` and Cloudflare's build pipeline does it, which means publishing a post is just a normal git commit.

Source for this site is on [GitHub](https://github.com/JackSessions/jack-sessions-website) if you want to see the actual config, the content schema, and how the project cards and blog list are wired together.
