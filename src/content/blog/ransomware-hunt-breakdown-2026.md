---
title: "A Ransomware Hunt Breakdown: From Initial Access to Encryption"
description: "A step-by-step DFIR walkthrough of a 2026-pattern ransomware intrusion, composited from common TTPs rather than one named victim, with the artifacts that catch each stage."
pubDate: "Oct 04 2026"
tags: ["DFIR", "ransomware", "incident response", "threat hunting"]
---

This isn't a writeup of one named company's breach. It's a composite of the patterns I keep seeing across 2026 ransomware cases, walked through stage by stage, with the artifact that actually catches each one. The value is in the hunt methodology, not the specific IOCs, which rotate constantly.

## Stage 1: Initial access

The boring entry points still win. An exposed RDP or VPN endpoint with a reused or sprayed credential, or a phishing email with a legitimate-looking attachment that drops an initial loader. The access broker model means the group that gets in is often not the group that encrypts, which is itself a hunting signal: a gap of days or weeks between the first foothold and the actual ransomware deployment is normal, not a sign you missed something.

**What to pull:** VPN and RDP auth logs for logins outside normal hours or geography, and for the same account authenticating from two geographically implausible locations close together in time.

## Stage 2: Discovery and credential access

Once in, the actor maps the environment before doing anything loud. Expect `whoami /all`, `net group "domain admins" /domain`, and increasingly, legitimate admin tools rather than custom malware, because living-off-the-land binaries don't trip signature-based detection. Credential access usually means an LSASS dump, often via a renamed or repurposed legitimate tool rather than a known hacking utility, specifically to dodge signature matching.

**What to pull:** process creation events (Sysmon Event ID 1 or EDR equivalent) for any process opening a handle to `lsass.exe` that isn't a known AV or backup agent, and command-line logging for `net`, `nltest`, and `whoami` run in quick succession from a single host, which is a weak signal alone but a strong one in combination.

## Stage 3: Lateral movement

This is where a kernel-level or EDR-level view earns its keep over log-only detection, because a capable actor disables logging on the way through. Common movement: PsExec or a renamed equivalent, WMI, or RDP with stolen credentials, moving host to host toward a domain controller or backup server, since the ransomware's actual goal is usually to hit backups before anyone notices.

**What to pull:** new service creation events (Event ID 7045) clustered across multiple hosts in a short window, and any access to backup infrastructure from an account or host that's never touched it before.

## Stage 4: Staging and deployment

Before encryption, there's usually a drop of the actual payload and a disabling of recovery options: shadow copy deletion (`vssadmin delete shadows`), Windows Defender tamper or disable, and often a scheduled task or GPO push used to deploy the encryptor to many hosts simultaneously.

**What to pull:** `vssadmin`, `wmic shadowcopy delete`, and `bcdedit` command lines, which are about as close to a definitive ransomware signal as a single log line gets. A new GPO or scheduled task created and executed within the same hour across many hosts is the deployment mechanism showing itself.

## Stage 5: Encryption and the note

By the time file extensions are changing and the ransom note is dropping, detection has already failed; this stage is about scoping the blast radius, not catching it live. Pull file modification telemetry to build an actual timeline of which hosts were hit and in what order, since that order usually maps directly back to the lateral movement path from Stage 3.

## The actual lesson

Every stage above has a detection opportunity that doesn't depend on knowing the specific ransomware family. Shadow copy deletion looks the same whether it's this year's group or next year's. That's deliberate: IOCs (hashes, specific C2 domains) expire within days of a case going public, but a hunt built around behavior, an LSASS handle from an unexpected process, a service created across ten hosts in one minute, still catches the next group using the same playbook with a different name.

This is the kind of question [Hayabusa Lens](/blog/hayabusa-lens-from-evtx-to-an-attack-story/) is built to help answer faster: not "does this hash match," but "does this sequence of events, across these logs, tell the story above."
