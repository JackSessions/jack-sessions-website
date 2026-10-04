---
title: "RuntimeTrace"
description: "eBPF-powered runtime consistency checker for Linux: does the kernel's own view of what's running agree with ps, lsmod and friends? On PyPI."
date: 2026-10-04
repoUrl: "https://github.com/JackSessions/runtime-trace"
url: "/blog/runtimetrace-asking-the-kernel-instead-of-the-tools"
pypiUrl: "https://pypi.org/project/runtime-trace/"
install: "sudo runtime-trace --watch 30"
status: "released"
featured: true
tags: ["DFIR", "eBPF", "Linux", "python", "rootkit-detection"]
---

`sudo apt install python3-bpfcc && sudo runtime-trace --watch 30`. Watches the kernel's scheduler directly through eBPF and flags where it disagrees with `ps`, `lsmod` and friends, the exact gap a process-hiding rootkit lives in. [Read the write-up](/blog/runtimetrace-asking-the-kernel-instead-of-the-tools) or see the [package on PyPI](https://pypi.org/project/runtime-trace/).
