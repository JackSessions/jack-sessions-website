---
title: "Boeing 787 Cabin Network: When the Ping Comes Back"
description: "How passive WiFi scanning and ICMP on two Scoot Airlines 787 flights confirmed a network segmentation failure between the passenger cabin and internal aircraft systems — and why that matters more than the in-flight entertainment menu."
pubDate: 2026-10-27
tags: ["Aerospace", "Network Security", "Responsible Disclosure", "WiGLE", "Boeing"]
---

I was sitting in economy on a Scoot 787, somewhere over the South China Sea, eating a mediocre $14 chicken rice. Normal Tuesday. Then I opened a terminal.

This is not a story about hacking an aircraft. This is a story about what happened when I sent a ping and it came back.

---

## Background: why aircraft networks are supposed to be isolated

Modern commercial aircraft like the Boeing 787 Dreamliner carry multiple network domains: the crew and operations network, the avionics domain (flight control, ARINC 429 data buses, AFDX), and the passenger entertainment and connectivity network. These domains are required to be isolated from each other under airworthiness security standards — specifically **DO-326A** (Airworthiness Security Process Specification) and its European equivalent **ED-12C**.

The short version: your Netflix stream should never share a path with the flight management system. Network isolation is not optional. It is a certification requirement.

The in-flight WiFi is supposed to be a walled garden. A very expensive, very slow walled garden where the best you can do is stream a film at 480p and wonder why you paid for it.

![Boeing 787 cabin network threat model — untrusted passenger zone, segmentation boundary, and restricted operational zone](/research/boeing-threat-model.jpg)
*Threat model from the DefCamp "Cabin Pressure" talk: the segmentation boundary is the only thing keeping passenger Wi-Fi away from operational systems.*

---

## The flights

I was transiting between Sydney and Singapore twice in June 2026 — outbound on **TR11 SYD→SIN** (23 June) and return on **TR14 SIN→SYD** (30 June). Both operated by Scoot Airlines on Boeing 787-9 Dreamliners.

Bored at cruise altitude, I ran passive WiFi scanning with WiGLE and took a look at what was visible from the passenger cabin.

---

## What WiGLE found

The passenger WiFi SSIDs (`ScootWiFi`, `Scoot_WiFi`) were expected. What was more interesting was the hardware fingerprint behind them.

WiGLE identified the access points by BSSID prefix: **00:24:a8:xx:xx:xx** — HP ProCurve Networking hardware, confirmed across both flights. The same manufacturer appeared on TR14 under the Hewlett Packard OUI range.

This matters because it tells you something about the network architecture: you're looking at commercial enterprise switching hardware managing the cabin network, not a purpose-built avionics-grade isolation layer.

Evidence from both flights:

- **TR11 SYD→SIN · 23 June 2026** — BSSIDs in the 00:24:a8:85:8d range, ProCurve confirmed
- **TR14 SIN→SYD · 30 June 2026** — Hewlett Packard + ProCurve hardware confirmed independently

---

## The ping

Once connected to the passenger WiFi, I sent standard ICMP echo requests (`ping`) to addresses in the local network range.

Some of them came back.

Not from other passengers' devices. From IP addresses in ranges that shouldn't be reachable from the passenger domain at all — internal aircraft addresses that have no business responding to a request from seat 32C.

ICMP echo replies from internal aircraft infrastructure across the cabin network boundary, on a live commercial 787 flight, at cruise altitude. Twice.

I did not probe further. I documented the responses, took note of the IP ranges, closed the terminal, and went back to the chicken rice.

To be clear: **no exploitation was attempted**. This write-up stops at the point where I confirmed a network segmentation failure. What lies beyond that boundary is a question for Boeing's engineers, not a blog post.

---

## Why this is a serious finding

An ICMP reply from an internal address is not just a misconfiguration curiosity. It is evidence that a packet originating in the passenger domain crossed a network boundary that is supposed to be impermeable.

If ICMP can cross the boundary, the question becomes: what else can?

The theoretical attack surface that follows from confirmed boundary permeability is substantial:

**Lateral movement to operational networks (est. CVSS 9.5).** An attacker with cabin WiFi access and knowledge of the internal address space could attempt to reach crew or operational systems. You don't need to land the plane. Access to crew communication systems, cabin management, or maintenance interfaces is serious on its own.

**Cross-domain protocol injection into ARINC 429 / AFDX (est. CVSS 10.0).** ARINC 429 and AFDX are the data bus protocols used in 787 avionics. If the network isolation has failed at the IP layer, the question of whether deeper avionics interfaces are reachable becomes non-theoretical. This is the worst-case scenario and the reason DO-326A exists.

I want to be precise here: I confirmed boundary permeability at the ICMP layer. I did not reach avionics systems. The CVSS estimates above are for the theoretical attack surface that a confirmed segmentation failure opens, not for actions I took.

---

## Disclosure

I reported the finding to every relevant authority I could identify:

- **Boeing PSIRT** (primary vendor)
- **FAA** (US airworthiness regulator)
- **CAAS Singapore** (Civil Aviation Authority of Singapore — Scoot's regulator)
- **SingCERT** (Singapore's national CERT)
- **CERT/CC** (Carnegie Mellon coordination center)
- **ASD** (Australian Signals Directorate)

The list is long because the jurisdictional overlap is genuinely complicated: US manufacturer, Singapore airline, Australian researcher, international airspace. When you're not sure whose problem it is, you tell everyone whose problem it might be.

The finding was acknowledged. Boeing PSIRT reviewed the technical report. The disclosure was handled through coordinated responsible disclosure and I'm not going to detail the outcome beyond that — Scoot is still flying 787s and I have flown on them since.

---

## The broader point

Passenger in-flight WiFi is not a high-security environment. People use it to check email and watch films. The assumption is that the worst thing a passenger can do is run up a large data bill.

But the passenger network is also connected to hardware on the same aircraft as flight-critical systems. If the isolation between those domains is implemented with commercial enterprise switching gear and not verified against airworthiness certification standards, the gap between "annoying cabin WiFi" and "adjacent to operational networks" is smaller than regulators and passengers would like.

I am not suggesting 787s are easy to hack. The full attack path from ICMP response to meaningful avionics access — if it exists — would require capability, knowledge, and intent well beyond a curious researcher with a laptop in economy.

But the first step of that path — confirming that the boundary can be crossed at all — is what I found. Twice. On the same route. Six days apart.

That seems worth reporting.

---

The Scoot chicken rice is a 6/10. The network segmentation is a different score entirely.
