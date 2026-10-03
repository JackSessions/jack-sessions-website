#!/usr/bin/env python3
"""Create a new blog post or project file with the right front matter.

  python3 tools/new_post.py post "Title of the post" --tags DFIR,tools --desc "One sentence for the card"
  python3 tools/new_post.py project "Tool name" --repo https://github.com/you/tool --status released --desc "One sentence"

Then edit the file it prints, run `npm run dev` to preview, and `git add -A && git commit && git push` to publish
(Cloudflare redeploys by itself). Screenshots go in public/blog/ and are linked as ![alt](/blog/name.png).
"""
import argparse
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def slug(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")[:70]


def q(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=["post", "project"])
    ap.add_argument("title")
    ap.add_argument("--desc", default="TODO: one sentence that shows on the card")
    ap.add_argument("--tags", default="", help="comma separated")
    ap.add_argument("--repo", default="", help="project: repository URL")
    ap.add_argument("--url", default="", help="project: link to a write-up or release")
    ap.add_argument("--status", default="active", choices=["active", "released", "archived", "research"])
    ap.add_argument("--featured", action="store_true", help="project: show on the home page")
    a = ap.parse_args()
    tags = "[" + ", ".join(q(t.strip()) for t in a.tags.split(",") if t.strip()) + "]"
    today = time.strftime("%b %d %Y")
    if a.kind == "post":
        path = os.path.join(ROOT, "src", "content", "blog", slug(a.title) + ".md")
        text = f"---\ntitle: {q(a.title)}\ndescription: {q(a.desc)}\npubDate: {q(today)}\ntags: {tags}\n---\n\nStart with the point of the post in two sentences.\n\n## What I did\n\n## What I learned\n\n## Try it\n"
    else:
        path = os.path.join(ROOT, "src", "content", "projects", slug(a.title) + ".md")
        lines = [f"title: {q(a.title)}", f"description: {q(a.desc)}", f"date: {time.strftime('%Y-%m-%d')}"]
        if a.repo:
            lines.append(f"repoUrl: {q(a.repo)}")
        if a.url:
            lines.append(f"url: {q(a.url)}")
        lines += [f'status: "{a.status}"', f"featured: {'true' if a.featured else 'false'}", f"tags: {tags}"]
        text = "---\n" + "\n".join(lines) + "\n---\n\nA short paragraph about it. Link the write-up and the package.\n"
    if os.path.exists(path):
        print(f"Already exists: {path}", file=sys.stderr)
        return 1
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
