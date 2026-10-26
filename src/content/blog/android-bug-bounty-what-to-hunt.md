---
title: "Android Bug Bounty: What to Hunt and How to Prove It"
description: "The vulnerability classes that actually pay on Android, which tools to use for each, and why apkleaks first always is the only rule you need to remember."
pubDate: "Oct 22 2026"
tags: ["android", "bug bounty", "mobile security", "frida", "mitmproxy", "apkleaks", "jadx"]
---

I wrote a post a while back about "prove it or delete it," the idea that a finding with no reproducible evidence isn't a finding. Mobile bug bounty is where that principle costs you the most money when you ignore it, and earns you the most money when you don't. So here's how I actually hunt: the classes of bugs worth your time, the tools that find them, and what separates a valid submission from a note-to-self.

This assumes you have the lab set up already, rootable AVD, frida-server, mitmproxy on the host. If you don't, [start there](/blog/android-security-lab-setup).

## apkleaks first. Always.

Before you touch the device. Before you open jadx. Before you write a single line of Frida script. Run apkleaks.

```bash
apkleaks -f target.apk -o secrets.txt
cat secrets.txt | grep -Ei "aws|stripe|twilio|firebase|sendgrid|google"
```

apkleaks scans the binary and decompiled strings for API keys, credentials, Firebase URLs, and hardcoded secrets. It takes maybe thirty seconds. And the thing is: valid AWS access keys in production APKs exist. They get pushed by accident, stay in for months, and occasionally have IAM permissions broad enough to make your eyes water. I've seen S3 buckets, SES send-as, DynamoDB read access, all from a thirty-second scan.

The catch, and it matters: **the key has to be live.** An expired key is an information disclosure, not a real finding. Verify before you report:

```bash
AWS_ACCESS_KEY_ID=AKIA... AWS_SECRET_ACCESS_KEY=... \
  aws sts get-caller-identity
```

If it returns an ARN, you have something. Screenshot it. Don't use the access. Don't modify anything. Report it.

**Firebase** is the other high-value apkleaks hit. If the output contains a `firebaseio.com` URL, test it:

```bash
curl -s "https://PROJECT.firebaseio.com/.json" | head -c 500
```

If that returns actual data instead of a 401, you've found a misconfigured Firebase project. This is legitimately critical, real user data with no auth required, and it pays accordingly.

## Decompile and read the manifest

apkleaks scans strings. For everything structural, exported components, backup flags, deep link handlers, dangerous permissions, you need the full decompile:

```bash
jadx -d jadx-out/ target.apk          # Java source
apktool d -f target.apk -o apk-src/   # smali + manifest
```

Then read the manifest. I'm not joking. Read it. The answers to several questions that take hours to find dynamically are just *printed there*:

```bash
# Exported components (callable by any app without permission)
grep "exported" apk-src/AndroidManifest.xml | grep "true"

# Backup allowed (adb can pull private storage without root)
grep "allowBackup" apk-src/AndroidManifest.xml

# Deep link URL schemes
grep -A10 "intent-filter" apk-src/AndroidManifest.xml | grep -E "scheme|host"
```

An activity with `exported="true"` and no `android:permission` attribute is callable by any app on the device, or by you from adb:

```bash
adb shell am start -n com.target.app/.ui.SettingsActivity
adb shell am start -n com.target.app/.admin.AdminPanelActivity
```

If that lands you on a logged-in screen without credentials, or in an admin panel, that's a finding. The impact is: no authentication required to reach a protected screen. Directly demonstrable, no interpretation needed.

## SSL pinning bypass: what's actually in the traffic

The bypass itself, using objection or the httptoolkit Frida script, is not a finding. "I can see the traffic" is not a finding. What's *in* the traffic is the finding.

```bash
objection -g com.target.app explore
# android sslpinning disable
```

With mitmproxy running on the host and the proxy configured on the device, use every feature in the app while watching the traffic. The things I'm looking for:

- **User IDs in URLs**: `/api/v1/users/1234/messages` is begging to be changed to `5678`
- **Tokens in query parameters**: leaks into logs, referrers, CDN access logs
- **Responses containing data I shouldn't receive**: trying an endpoint while unauthenticated
- **Sequential resource IDs**: UUIDs are boring to guess; integers are not

The mitmproxy filter I use most is simple: `~d api.target.com && ~m GET` to see all authenticated reads to the API. That's where the IDOR surface lives.

## IDOR: the highest ROI bug class for mobile

Two accounts. Before you start any session, create a second test account and note its user ID. You get Account A's ID from Account A's own API responses. You get Account B's ID the same way, log in as B, browse, catch the ID in traffic.

Then log in as A, and swap B's ID into A's requests. If the server hands you B's data, you have an IDOR. The impact is immediate and concrete: authenticated user can read (or write, or delete) another user's private data.

```
GET /api/v1/users/1234/profile  →  change to /api/v1/users/5678/profile
GET /api/v1/orders?user_id=1234 →  change to ?user_id=5678
```

In mitmproxy: select the request, press `e` to edit, change the ID, press `r` to replay. If the response body contains Account B's name, email, order history, or anything else B owns, that's the screenshot you need.

## Deep link abuse

The URL scheme (`myapp://`) or App Link intent filters define the inputs the app accepts from the outside world. If those inputs aren't validated, and frequently they aren't, you can drive the app into states it wasn't meant to reach externally.

The interesting cases:
1. **Deep link loads a URL in a WebView**: pass `myapp://open?url=https://attacker.com` and see if it opens
2. **Auth callback with OAuth token**: pass a crafted redirect and see where the token lands
3. **Unauthenticated deep link**: some flows trust the scheme implicitly

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "myapp://auth/callback?token=INJECTED"
adb shell am start -a android.intent.action.VIEW \
  -d "myapp://open?url=https://evil.example.com"
```

A deep link that opens an arbitrary URL in a WebView with JS enabled is a problem if there's any JS bridge attached. `addJavascriptInterface` with native methods becomes callable from the page you control.

In jadx:

```bash
grep -rn "addJavascriptInterface"               jadx-out/ --include="*.java"
grep -rn "setWebContentsDebuggingEnabled(true)" jadx-out/ --include="*.java"
```

The second one is a gift: if it's there, open `chrome://inspect/#devices` on your host machine and you'll have full DevTools against the running WebView. JS console, DOM inspector, network tab, the works.

## Local storage after login

With the AVD rooted and the app logged in, read everything under `/data/data/com.target.app/`:

```bash
adb root
cat /data/data/com.target.app/shared_prefs/*.xml
sqlite3 /data/data/com.target.app/databases/*.db ".dump"
```

What I'm looking for: auth tokens, session keys, PII, or private keys stored in plaintext XML or in an unencrypted SQLite database. The bar for a valid finding is "plaintext credential or PII that gives meaningful account access." A cache of the user's own display name is boring. A JWT that grants full account access is not.

## Where to hunt

A few programs worth starting with:

- **Google Play Security Reward Program**: pays for vulns in top Play Store apps; Google fronts the bounty on behalf of the developer. RCE in a top-100 app = real money.
- **HackerOne**: filter by Android scope in the directory. Check disclosed reports for your target before you start. Five minutes reading what's already been found will save you hours of duplicate work.
- **Samsung Mobile Security**: covers One UI, the Galaxy app ecosystem, and Samsung-specific firmware components. KNOX bypass is critical.
- **Meta**: WhatsApp and Instagram have well-defined Android scope. Instagram's API is a reasonable IDOR hunting ground.
- **Intigriti**: European platform, less competition on many programs, strong telco and fintech presence.

One rule: **read the disclosed reports before you hunt a program.** Not because the bugs are gone, new features ship constantly, but because you'll understand what the triage team actually values and what they won't accept. That's worth more than a second tool.

## What makes a report pay

Three things, same as always:

1. **Exact reproduction steps**: steps that work on a clean install, not "install the app and kind of poke around"
2. **Evidence**: traffic capture, screenshot of the response, video of the exploit path
3. **Impact statement**: "an authenticated attacker can read any user's private messages without that user's knowledge." Specific. No weasel words. Not "may allow." *Can.*

Programs don't pay for scanner output. They pay for demonstrated impact. If you can't show it, you don't have it yet, and "yet" is the right word, because the tools we have make demonstrating impact pretty tractable once you know what you're looking for.

That's the actual loop. apkleaks, manifest, traffic analysis, IDOR sweep, local storage, rinse, file. Keep the [cheatsheet open](https://claude.ai/artifact/VLVSYpAoTXyPR9MHf5Ek67) while you're working.
