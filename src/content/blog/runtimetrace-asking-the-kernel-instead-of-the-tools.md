---
title: "RuntimeTrace: Asking the Kernel Instead of the Tools That Ask It"
description: "An eBPF-powered consistency checker for live Linux systems, and the two real bugs that showed up the moment I tested it on hardware different from my own."
pubDate: "Oct 04 2026"
tags: ["DFIR", "tools", "python", "eBPF", "Linux"]
---

[PhantomTrace](/blog/phantomtrace-checking-whether-ntfs-agrees-with-itself/) asks whether an offline NTFS disk agrees with itself. I wanted the same question one layer up, on a live system: does the kernel's own view of what's running agree with what `ps`, `lsmod` and the rest report back? A process-hiding rootkit, or some anti-forensic tooling, usually works by making exactly one of those views lie. So I built **RuntimeTrace**, which watches the kernel directly through eBPF instead of trusting the normal APIs a rootkit would already have compromised.

```bash
sudo apt install python3-bpfcc
runtime-trace                      # instant checks, no root needed
sudo runtime-trace --watch 30      # also watches live process execution for 30 seconds
```

## What it checks

It compares what the kernel's scheduler and module list actually contain against what userspace tools report: hidden processes, hidden kernel modules, and a live watch mode that catches a process that executes and exits before `ps` would ever see it. That last one only eBPF can really do, since anything polling `/proc` on an interval can miss a process that lives for less than the polling interval.

## It did not work the first time

I tested it on my own machine, it looked right, and then I tested it on a different kernel and it immediately fell over. Two real problems showed up:

- A field eBPF exposes for a process's filename is not guaranteed to exist the same way across kernel versions. My first version assumed a field that was there on my kernel and missing on another, which crashed instead of degrading.
- A colour code I referenced in the terminal output (`cyan`) was never defined in the colour map, so any finding that tried to print in that colour crashed the whole run instead of just looking wrong.

Neither of those would have shown up if I'd only ever run it on the one machine I built it on. Both are fixed now, and the lesson is the same one PhantomTrace already taught me: test the thing on hardware and kernels that are not your own before you call it done.

## Try it

```bash
pipx install runtime-trace
```

MIT licensed, standard-library-plus-bcc, no telemetry, nothing leaves the machine. A finding is a lead to confirm by hand, not proof on its own, the same honesty bar as the rest of these tools.

- Source: [github.com/JackSessions/runtime-trace](https://github.com/JackSessions/runtime-trace)
- Package: [pypi.org/project/runtime-trace](https://pypi.org/project/runtime-trace/)

I build these with AI assistance (Claude), and the README says so. I decide what it does, I run the tests, and I read what ships.
