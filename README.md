# jack.sessions

My personal site: security research, talks, a 3D homelab map and music.

```json
{
  "name": "jack.sessions",
  "owner": "Jack Sessions",
  "about": "Security researcher: mobile security, DFIR, anti-forensics, counterintelligence. CS student at UNSW.",
  "live": "https://jacksessions.dev",
  "repo": "https://github.com/JackSessions/jack-sessions-website",

  "pages": {
    "home":     "night-vision hero, typing bio, certs",
    "blog":     "writing on mobile pentesting, music, goals",
    "talks":    "12 talks and panels with slides and recordings",
    "projects": "PhantomTrace, CVE advisories, SOC/DFIR, agents",
    "lab":      "5 interactive 3D maps of my Proxmox homelab + range builder + build-your-own guide",
    "videos":   "latest uploads from my YouTube channel",
    "music":    "tracks I generated with code, plus a portable-console visualiser",
    "about":    "bio, research, photo reel, collab buttons"
  },

  "stack": {
    "framework": "Astro 5 (static pages, content collections)",
    "3d":        "three.js (lab maps, fighter jets, range builder)",
    "hosting":   "Cloudflare Workers (static assets)",
    "language":  "Astro, TypeScript, plain CSS. No UI framework."
  },

  "how_i_built_it": [
    "Started from Astro's blog template and rebuilt every page",
    "Talks, blog posts and projects are markdown files in src/content",
    "Lab maps, range builder rules and the guide are data files in src/data and src/lib",
    "Music is generated with Python synth scripts in tools/ (no samples, no AI vocals)",
    "Built with AI assistance (Claude); design, content and decisions are mine"
  ],

  "cost": {
    "domain": "$12",
    "everything_else": "free tools and my own time"
  },

  "license": "Content (writing, music, photos) © Jack Sessions"
}
```

## Run it locally

```bash
git clone https://github.com/JackSessions/jack-sessions-website
cd jack-sessions-website
npm install
npm run dev          # http://localhost:4321
```

Useful commands: `npm run build` (output in `dist/`), `npm run preview` (build and run it the way Cloudflare does), `npm run check` (build, type-check, dry-run deploy).

## Where things live

| What | Where |
|---|---|
| Talks, blog posts, projects | `src/content/*` (one markdown file each) |
| Homelab maps, build-your-own guide | `src/data/homelab.ts`, `src/data/labguide.ts` |
| Range-builder rules and 3D models | `src/lib/homelab/` |
| Music list and player | `src/data/music.ts`, `public/music/` |
| Slides | `public/slides/` (link them with `slidesUrl` in a talk) |
| Generators for the music | `tools/` |

## Publishing a blog post or a project

```bash
python3 tools/new_post.py post "Title" --tags DFIR,tools --desc "One sentence for the card"
python3 tools/new_post.py project "Tool name" --repo https://github.com/you/tool --status released --featured --desc "One sentence"
```

Each command prints the new markdown file. Write in it, put screenshots in `public/blog/` and link them as `![alt](/blog/name.png)`, preview with `npm run dev`, then `git add -A && git commit && git push`. Cloudflare redeploys by itself in about a minute.

**Release checklist for a tool** (so the blog, the repo and PyPI tell the same story): publish the GitHub release and wait for the PyPI page to go live, then publish the post and project entry that link to it, and share.

## Deploy it on Cloudflare

Push to GitHub and Cloudflare builds and publishes the site on every commit to `main`.

1. **Connect the repo.** In the Cloudflare dashboard go to *Workers & Pages* → *Create* → *Import a repository*, and pick the repo. Or use the one-click button:
   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/JackSessions/jack-sessions-website)
2. **Build settings** (if it asks): build command `npm run build`, deploy command `npx wrangler deploy`.
3. **Add your domain.** Open the project → *Settings* → *Domains & Routes* → *Add* → *Custom domain*. If the domain is bought through Cloudflare, it is set up for you.
4. **Tell the site its address.** Change `site` in `astro.config.mjs` to your domain so the sitemap, RSS feed and link previews are right.
5. **Update the site.** `git add -A && git commit -m "..." && git push`, and Cloudflare redeploys by itself in about a minute.

Docs: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/) · [Astro on Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/) · [Custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [Workers builds](https://developers.cloudflare.com/workers/ci-cd/builds/)

## Credit

Created and maintained by **Jack Sessions**. Started from [Astro's blog template](https://github.com/cloudflare/templates/tree/main/astro-blog-starter-template), itself based on [Bear Blog](https://github.com/HermanMartinus/bearblog/). 3D by [three.js](https://threejs.org/).
