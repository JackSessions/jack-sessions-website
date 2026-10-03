---
title: "At 22, I've Published Two DFIR Tools on PyPI. This Is Just the Start"
description: "What it took to ship Hayabusa Lens and PhantomTrace, the mistake I made on release day, and what I'm building next."
pubDate: "Oct 04 2026"
tags: ["DFIR", "tools", "personal", "python", "career"]
---

Two open-source DFIR tools of mine are now on PyPI, and anyone in the world can install them with one command. I'm 22. I wanted to write down how that felt, what it took, and where it's going, because I think the honest version is more useful than the highlight reel.

```bash
pipx install hayabusa-lens
pipx install phantom-trace-ntfs
```

## The two tools

- **[Hayabusa Lens](/blog/hayabusa-lens-from-evtx-to-an-attack-story/)** turns Windows event logs into a dashboard, a 3D attack map, and a plain-English investigation by an AI that keeps an audit trail of every question it asks.
- **[PhantomTrace](/blog/phantomtrace-checking-whether-ntfs-agrees-with-itself/)** checks whether an NTFS disk agrees with itself, a possible sign of tampering, without ever writing to it.

They come from the same place: DFIR taught me that the interesting question is usually not "what does this say?" but "does this agree with everything else?"

## Building is the easy half

I expected the hard part to be the code. It wasn't. The hard part was everything around it: writing a README that answers "why would I use this?", being honest about what the tool can't do, making the tests prove something real, adding a security policy, working out how trusted publishing on PyPI works, and fixing the things that only break on a clean machine.

A few lessons I'd pass on to anyone starting out:

- **Say what it isn't.** Both READMEs say these tools produce leads, not proof. That sentence costs nothing and builds more trust than any feature.
- **Test against the real thing.** PhantomTrace's tests build real NTFS volumes, tamper with them, and check that clean ones stay quiet. A forensic tool that cries wolf is worse than none.
- **Make the AI accountable.** If an AI helps an investigation, you should be able to see every question it asked and every answer it gave. That became Hayabusa Lens's audit trail.
- **Keep it local-first.** Logs are sensitive. Nothing leaves your machine unless you choose it and say yes.

## The mistake I made on release day

I'll be honest about this one. I released PhantomTrace before I had committed its redesign, so the first version on PyPI had the old look while my screenshots showed the new one. PyPI doesn't let you replace a version, so the fix is a follow-up release. Nobody was harmed, since the checks were identical, but it was a good reminder: check what you actually shipped by installing it from the registry, not from your own machine. I do that now.

## How I build

I build these with AI assistance (Claude), and both READMEs say so. I decide what the tools do and which risks matter, I run the tests, and I read what ships. I think that's the future of how a lot of security tooling gets made, and I'd rather be open about it than quiet.

## What's next

Both tools are early. They've been tested mostly on Linux and on images made with open-source tools, so the most useful thing anyone can do is try them on their own data and tell me where they're wrong. Next for me: validating PhantomTrace on Windows-made volumes and real anti-forensic tooling, more checks, more ways to share findings with the SIEMs people already run, and more talks. This is the start, not the finish.

If you try either tool, open an issue on GitHub, especially for false positives and misses. And if you're 22 and sitting on a half-finished tool: write the README, run it on a clean machine, and ship it.

- [Hayabusa Lens on PyPI](https://pypi.org/project/hayabusa-lens/) · [GitHub](https://github.com/JackSessions/hayabusa-lens)
- [PhantomTrace on PyPI](https://pypi.org/project/phantom-trace-ntfs/) · [GitHub](https://github.com/JackSessions/PhantomTrace)
