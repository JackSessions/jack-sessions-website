---
title: "Building an Android Security Lab on Ubuntu: AVD, Frida, and a Proper Intercept Setup"
description: "How I set up a rootable Android emulator, Frida, mitmproxy, and a full intercept pipeline on Ubuntu for bug bounty and mobile security research, including the parts that fought me."
pubDate: "Oct 22 2026"
tags: ["android", "frida", "mitmproxy", "bug bounty", "mobile security", "ubuntu", "linux"]
---

I've been doing more mobile security work lately and I needed a proper environment for it, something reproducible, isolated, and fast to spin up instead of the "adb shell and pray" lifestyle I'd been leading. So I built one. This is what it looks like and what it cost me in time.

The goal was simple: an Android emulator I can install anything on, intercept all its traffic, hook into any running process with Frida, and tear the whole thing down to a clean state whenever I want. No real device. No jailbreak gymnastics. No explaining to customs why my phone has a modified kernel.

## The emulator: AVD with a google_apis image

The key word here is `google_apis` and not `google_play`. Play Store images ship with a locked bootloader and `adb root` just returns "adbd cannot run as root in production builds," which is charming but useless for security work. The `google_apis` variant is the one that lets you actually root.

I created an AVD I named `bounty-34`:

- **Device:** Pixel 7 profile
- **API level:** Android 14 / API 34
- **Architecture:** x86_64 (runs natively on an Intel/AMD laptop without ARM translation)
- **Image type:** google_apis (not google_play, see above)

```bash
sdkmanager "system-images;android-34;google_apis;x86_64"
avdmanager create avd \
  --name bounty-34 \
  --package "system-images;android-34;google_apis;x86_64" \
  --device "pixel_7"
```

Every session I launch it with `-writable-system` and `-no-snapshot-load`. Writable system is what lets me push the mitmproxy CA cert into `/system/etc/security/cacerts/` later, and clean boot every time means I'm not carrying state from the last session into this one. Clean state matters. A finding you can't reproduce on a fresh boot isn't a finding.

## The intercept chain: mitmproxy via 10.0.2.2

The Android emulator has a loopback address you don't always see documented: `10.0.2.2` maps to your host machine's `localhost`. So if mitmproxy is listening on port 8080 on your host, the emulator can reach it at `10.0.2.2:8080`. That's the whole proxy trick.

```bash
adb shell "settings put global http_proxy 10.0.2.2:8080"
```

One line. And then the mitmproxy CA cert gets pushed as a *system* cert rather than a user cert, because Android 7+ doesn't trust user-installed CAs for app traffic:

```bash
CERT_HASH=$(openssl x509 -inform PEM -subject_hash_old -in ~/.mitmproxy/mitmproxy-ca-cert.cer | head -1)
adb push ~/.mitmproxy/mitmproxy-ca-cert.cer \
  "/system/etc/security/cacerts/${CERT_HASH}.0"
adb shell "chmod 644 /system/etc/security/cacerts/${CERT_HASH}.0"
```

The `subject_hash_old` part is one of those things you have to get exactly right, and you discover this after staring at the cert not being trusted for twenty minutes. `openssl x509` has two different hashing commands, `subject_hash` and `subject_hash_old`, and Android uses the *old* one. Don't ask me. It just does.

## Frida: the right binary for x86_64

Frida has architecture-specific server binaries and you need the matching one. Since the AVD is x86_64, that means `frida-server-android-x86_64`. Not arm64, not arm, x86_64.

At time of writing I'm on Frida 17.24.3. The server binary was 164 MB compressed; I kept the `.xz` version around and decompress fresh when needed.

```bash
# Push and start the server on the device
adb push frida-server-android-x86_64 /data/local/tmp/frida-server
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "/data/local/tmp/frida-server &"
```

Verify with `frida-ps -U`, and if you get a process list back it's running.

One thing that bit me: if the server is already running from a previous session and the snapshot loaded, it's listening on a dead PID and frida-ps just hangs. Fix is `adb shell pkill frida-server` before starting fresh. I automated this into the start script.

## Tools and the pipx detour

Ubuntu 26.04 ships with PEP 668 enforced, which means `pip3 install` into the system Python will just tell you to use a virtual environment or a package manager. Reasonable policy. Extremely annoying the first time it blocks you mid-setup.

Everything Python-based went through `pipx` instead:

```bash
pipx install frida-tools    # frida-ps, frida, frida-trace
pipx install objection      # the Frida-based app exploration framework
```

For the rest:
- `jadx`: `.deb` via GitHub releases, or unzip the GUI build and put it in `~/tools/jadx/bin/`
- `apktool`: `sudo apt install apktool`
- `apkleaks`: `pipx install apkleaks`
- `androguard`: `pipx install androguard`
- `mitmproxy`: `sudo apt install mitmproxy` (or pipx, both work)
- Android build-tools (apksigner, zipalign, aapt2): `sdkmanager "build-tools;35.0.0"`

## The start script

Once I'd done the manual setup twice, I automated it. The script does the whole thing in order: launch AVD, wait for boot, `adb root`, `adb remount`, push frida-server, configure the proxy, install the CA cert, open mitmproxy in a new kitty window.

```bash
# ./start-avd.sh              full session
# ./start-avd.sh --no-proxy   just AVD + Frida
# ./start-avd.sh --headless   no GUI window
# ./start-avd.sh --stop       kill everything
```

The boot wait is the slow part. I used `getprop sys.boot_completed` in a loop, which returns `1` when the system is actually ready, not just when the screen lights up:

```bash
for i in $(seq 1 60); do
  BOOT=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [[ "$BOOT" == "1" ]] && break
  sleep 2
done
```

Polling in a loop, two-second sleep, sixty attempts, two minutes max before it gives up. Clean and boring, which is what a setup script should be.

## The APK patching script

Some apps ship with a `network_security_config.xml` that explicitly says "trust only system CAs and nothing else." Even with the mitmproxy cert installed as a system cert, certain builds with custom NSC files or compiled-in pinning won't route traffic through the proxy. The fix is to recompile the APK with a patched security config.

```bash
./patch-apk.sh target.apk            # outputs target-patched.apk
./patch-apk.sh target.apk --install  # patch + install on device
```

The script decompiles with apktool, injects or patches `res/xml/network_security_config.xml` to allow user certificates, wires up the manifest reference if it's missing, recompiles, zipaligns, signs with a debug keystore. If the app has native SSL pinning in code (OkHttp certificate pinner, TrustKit, custom SSLContext), patching the XML alone won't help. That's where Frida comes in.

## Bypassing SSL pinning at runtime

When XML patching isn't enough, objection usually is:

```bash
objection -g com.target.app explore
# then:
android sslpinning disable
```

objection patches the most common pinning implementations in memory. When it fails (custom pinning, NDK-level, or certificate transparency checks), there are Frida Codeshare scripts that go deeper:

```bash
frida -U -f com.target.app \
  --codeshare httptoolkit/frida-android-unpinning --no-pause
```

That one patches OkHttp, conscrypt, the system SSLContext, WebView, and a handful of others. Between objection and httptoolkit's script I've never had a target that didn't eventually yield.

## What I'd do differently

Not much, honestly. The only thing I'd change in retrospect is the Android SDK version. I installed `build-tools;35.0.0` but some older apps have packaging quirks that `apktool` handles fine and `aapt2` trips over. Keeping a second build-tools version around (`33.0.0`) turns out to be handy.

The `google_apis` vs `google_play` lesson is probably the one thing I'd shout at past me about, because it took me a while to figure out why my "working" emulator wouldn't root. The image name is the whole answer. Now I know. So do you.

Setup guide and all the scripts live at `~/tools/android-sec/` if you want the full walk-through. The README has the cheatsheet I actually use day-to-day. More on what you can do with this environment, specifically the bug classes worth hunting, in the follow-up post.
