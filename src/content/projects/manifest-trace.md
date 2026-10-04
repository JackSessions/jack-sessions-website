---
title: "ManifestTrace"
description: "Android manifest exposure scanner, generalising my own CVE-2025-50861 and CVE-2025-50862 into five checks against a from-scratch AXML parser. On PyPI."
date: 2026-10-04
repoUrl: "https://github.com/JackSessions/manifest-trace-"
url: "/blog/manifesttrace-generalising-my-own-cves"
pypiUrl: "https://pypi.org/project/manifest-trace/"
install: "pipx install manifest-trace"
status: "released"
featured: true
tags: ["DFIR", "Android", "mobile-security", "python", "CVE"]
---

`pipx install manifest-trace`. Reads an APK's compiled manifest directly (no androguard, no Android SDK) and flags exported components, exported providers, allowBackup, debuggable, and cleartext traffic, the bug classes behind my own CVE-2025-50861 and CVE-2025-50862. Every finding comes with a real next command to confirm it. [Read the write-up](/blog/manifesttrace-generalising-my-own-cves) or see the [package on PyPI](https://pypi.org/project/manifest-trace/).
