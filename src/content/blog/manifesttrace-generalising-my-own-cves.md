---
title: "ManifestTrace: Generalising My Own CVEs Into a Tool"
description: "An Android manifest exposure scanner built from a from-scratch binary XML parser, the exact bug classes behind my own CVE-2025-50861 and CVE-2025-50862, and a bug the tool's own suggestions had until real data caught it."
pubDate: "Oct 04 2026"
tags: ["DFIR", "tools", "python", "Android", "CVE"]
---

I hold two CVEs from real Android apps: CVE-2025-50861, an exported activity reachable without authentication, and CVE-2025-50862, `allowBackup=true` left on, letting `adb backup` pull an app's private data with no root needed. Both were found by reading one manifest by hand. **ManifestTrace** is that same read, generalised into a scanner that checks a whole batch of APKs at once.

```bash
pipx install manifest-trace
manifest-trace app.apk
```

## How it reads the manifest

No androguard, no Android SDK. It parses the compiled binary `AndroidManifest.xml` straight out of the APK's zip, from scratch, with nothing but the Python standard library: the string pool, the resource map, every start and end element chunk. Writing that parser surfaced its own bug before it ever got near a real app: the header size field already covers the whole 16-byte common node header, and my first pass double-read the line number and comment fields eight bytes past where they actually live, which quietly corrupted everything parsed after it. Caught by building a hand-crafted binary document byte-for-byte in the test suite and checking the parser read it back correctly, independent of any real APK.

## The five checks

Exported activities, services, receivers and providers with no permission requirement, `allowBackup`, `debuggable`, and cleartext traffic allowed, each one following Android's actual default-exported rules rather than assuming every component behaves the same way.

## Testing it against a real vulnerable app

I ran it against InsecureBankv2, a well-known deliberately vulnerable Android training app, without tuning anything to that specific app first. It found the documented exported activities and the exported content provider on its own, and stayed quiet on the parts of a clean, real open-source app that are genuinely fine.

## A bug the "next step" feature had until real data caught it

The newest feature suggests a real command to confirm each finding: `adb shell am start` for an exported activity, `content query` with the actual authority for a provider, and so on. My first version used `adb shell am start` for every exported component regardless of what kind it was. Testing it against InsecureBankv2's real `MyBroadCastReceiver` finding showed the problem immediately: `am start` only works for activities. A receiver needs `am broadcast`, a service needs `am startservice`. It's fixed now and keyed off the actual component kind, but it's a good example of why I test every feature against real data before calling it done, not just data I wrote myself to make the feature look right.

It also checks, with `shutil.which()`, whether jadx or apktool is already on your machine, and tailors its suggestion accordingly. It never runs a decompiler, or anything else, on its own.

## The one rule that matters most

Before acting on any finding, including one against an app you didn't expect to scan, or one that turns out to belong to your own employer: do you have clear, documented authorisation to test this specific app. If a finding shows up incidentally in your own company's software, that goes through an internal security channel, not personal validation. That question, and coordinated disclosure guidance (ISO/IEC 29147) for anything found in someone else's app, is written down permanently in [`docs/VALIDATING.md`](https://github.com/JackSessions/manifest-trace-/blob/main/docs/VALIDATING.md), not left as something you have to remember.

## Try it

```bash
pipx install manifest-trace
manifest-trace --help
```

MIT licensed, static analysis only: it never runs the APK or touches a device. A finding is a lead for a human to confirm, not proof.

- Source: [github.com/JackSessions/manifest-trace-](https://github.com/JackSessions/manifest-trace-)
- Package: [pypi.org/project/manifest-trace](https://pypi.org/project/manifest-trace/)

I build these with AI assistance (Claude), and the README says so. I decide what it does, I run the tests, and I read what ships.
