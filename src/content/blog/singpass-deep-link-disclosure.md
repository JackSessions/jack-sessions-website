---
title: "Singpass Android: Unvalidated Deep Link Injection via Exported Activity"
description: "How a Frida hook on DeepLinkDashBoardActivity revealed that Singpass — Singapore's national digital identity platform used by 4 million citizens — accepted unvalidated deep link URIs from any installed app or ADB caller, and how that became a responsible disclosure to the Cyber Security Agency of Singapore."
pubDate: 2026-10-27
tags: ["Mobile Security", "Android", "Responsible Disclosure", "Frida", "Singpass"]
---

Singpass is Singapore's national digital identity platform. Around four million citizens use it to authenticate with government services, banks, healthcare providers, and dozens of private sector apps. The Android app is `sg.ndi.sp`.

This is the story of how a Frida hook on a single exported activity turned into a responsible disclosure to the Cyber Security Agency of Singapore (CSA), a patched release, and a lesson in why `android:exported` defaults matter.

---

## Finding the surface

Static analysis of the APK in JADX revealed the architecture. The app uses a deep link handler activity — `DeepLinkDashBoardActivity` inside `sg.ndi.activity` — to receive incoming Intents that carry navigation URIs. These URIs are used internally to route the user to specific app screens.

The activity was **exported without an intent filter restriction**. That means any app on the device, or any ADB caller, could send an Intent directly to it.

```xml
<!-- AndroidManifest.xml (extracted) -->
<activity
  android:name="sg.ndi.activity.DeepLinkDashBoardActivity"
  android:exported="true" />
```

Exported with no `permission` attribute and no `intent-filter` gating. Any caller. Any URI.

---

## The Frida hook

To confirm dynamic behaviour, I hooked `onNewIntent` at runtime:

```javascript
Java.perform(function() {
  var DeepLinkActivity = Java.use("sg.ndi.activity.DeepLinkDashBoardActivity");

  DeepLinkActivity.onNewIntent.implementation = function(intent) {
    console.log("[VDP-TRACE] DeepLinkDashBoardActivity received a new Intent!");

    if (intent !== null) {
      var dataUri = intent.getData();
      if (dataUri !== null) {
        console.log("[VDP-TRACE] UNTRUSTED INPUT DETECTED: " + dataUri.toString());
        console.log("[VDP-TRACE] WARNING: This string is being passed to internal " +
                    "components without validation.");
      }
    }

    this.onNewIntent(intent);
  };
});
```

The hook confirmed it: any deep link URI sent to the activity was received and processed. No caller verification. No signature check. No permission gate. The data string was passed directly to internal navigation components.

---

## What the logcat showed

The Android logcat during dynamic analysis — run against `sg.ndi.sp` v26.1.1 on ARM64 — showed the app loading, the dex2oat compilation of the APK, and the activity lifecycle. No authentication challenge was presented when the activity was invoked externally. The Intent data passed through unimpeded.

Relevant logcat excerpt (package path confirms the target binary):

```
08-05 19:53:23.700 F DEBUG: Cmdline: /apex/com.android.art/bin/dex2oat32
  --zip-location=.../sg.ndi.sp-w5miu1jf_g6hQR2y2xwZyg==/base.apk
  --comments=app-name:sg.ndi.sp,app-version-name:26.1.1,app-version-code:200
```

This confirmed the specific version under test and that the target was the production Singpass binary.

---

## Impact

An unprotected exported activity that accepts arbitrary URIs and routes them to internal navigation components creates two concrete risks:

**Denial of service / state corruption.** A malicious app can send crafted URIs to crash or confuse the Singpass navigation state.

**Logic abuse via deep link manipulation.** If any downstream component acts on the URI without re-validating its origin — routing to a specific screen, pre-populating a field, triggering a transaction — that behaviour is reachable by any app on the device.

In a national digital identity app used for banking, healthcare, and tax authentication, unvalidated external input reaching internal navigation components is not theoretical risk. Full impact details were shared with CSA under coordinated disclosure and are not published here.

---

## Disclosure

I reported the finding to the **Cyber Security Agency of Singapore (CSA)** through responsible disclosure, following ISO/IEC 29147 guidelines.

The finding was acknowledged. A patched version was released. The disclosure is logged as a responsible disclosure rather than a CVE because the finding was resolved through the CSA's coordinated process rather than through MITRE directly.

The Frida PoC and logcat evidence were provided to CSA as part of the technical brief. Nothing in this post contains exploit specifics beyond what is necessary to understand the class of vulnerability.

---

## The fix

The correct remediation for an unintended exported activity is straightforward:

```xml
<!-- Option 1: unexport the activity entirely -->
<activity
  android:name="sg.ndi.activity.DeepLinkDashBoardActivity"
  android:exported="false" />

<!-- Option 2: gate it with a custom permission -->
<activity
  android:name="sg.ndi.activity.DeepLinkDashBoardActivity"
  android:exported="true"
  android:permission="sg.ndi.sp.permission.DEEP_LINK" />
```

If external deep links are a genuine product requirement, the URI must be validated against an allowlist before it reaches any internal component. Origin is not trust.

---

## Broader lesson

`android:exported="true"` without an explicit `android:permission` on a sensitive activity is one of the most common Android security mistakes. It shows up repeatedly across banking apps, government apps, and enterprise tooling. JADX makes the manifest readable in under a minute. A Frida hook confirms exploitability in under ten.

If you build Android apps that handle authentication, payments, or identity, audit your exported activities today. The surface is small and the fix is one attribute.

---

The Singpass team handled the disclosure professionally. The app is patched. This write-up exists to make the general class of vulnerability more visible — not to embarrass anyone.
