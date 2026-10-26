---
title: "I found a network segmentation failure on a Boeing 787 at 38,000 feet"
description: "How passive WiFi scanning on two Scoot Airlines flights led to a responsible disclosure to Boeing PSIRT, the FAA, ASD, CAAS Singapore, SingCERT, and CERT/CC."
pubDate: 2026-10-26
tags: ["Aviation", "Network Security", "Responsible Disclosure", "DO-326A"]
---

In June 2026, I was a passenger on two Scoot Airlines Boeing 787 flights between Sydney and Singapore. I had my phone, WiGLE WiFi, and a habit of looking at things I probably shouldn't look at.

By the end of the second flight, I had confirmed a network segmentation failure between the passenger cabin WiFi and what appeared to be internal aircraft network infrastructure, documented it with passive scans, and started writing a disclosure report addressed to Boeing PSIRT, the FAA, the Australian Signals Directorate, CAAS Singapore, SingCERT, CERT/CC, Singapore Airlines, and Scoot.

This is that story.

---

## The flights

**TR11** — Sydney to Singapore, 23 June 2026.
**TR14** — Singapore to Sydney, 30 June 2026.

Both Scoot Airlines. Both Boeing 787. Both running HP ProCurve-based passenger WiFi infrastructure.

I connected to passenger WiFi as a normal, ticketed passenger. That's it. No special equipment, no tools beyond what I had on my phone, no network access I wasn't given.

---

## Finding the hardware

The first thing I noticed was the WiGLE scan. Multiple access points broadcasting under the `ScootWiFi` and `Scoot_WiFi` SSIDs, all with manufacturer strings of "ProCurve Networking by HP" and BSSIDs in the `00:24:a8:xx:xx:xx` range. HP ProCurve is enterprise switching and wireless infrastructure. Not surprising on its own, but confirming the specific hardware stack matters for what came next.

On TR14, the same pattern: Hewlett Packard and ProCurve Networking by HP hardware, the same BSSID prefix, the same setup.

---

## The finding

I performed basic ICMP echo requests from the passenger WiFi network. Standard connectivity testing. What I got back was not what you expect from a correctly segmented network.

**ICMP replies from internal aircraft IP addresses.**

On a correctly configured 787 cabin network, the passenger WiFi domain is completely isolated from all other network domains. Passengers should be able to reach the internet through the Panasonic Avionics IFE system and nothing else. Internal aircraft IP space should be invisible, unreachable, and silent.

It wasn't.

The replies indicated a failure of network isolation between the passenger entertainment domain and at least one internal network domain. Whether that internal domain was cabin management, crew services, or something else, I did not determine. I stopped immediately.

A second finding: HP ProCurve devices on the network accepted malformed packets with incorrect protocol structures without dropping them. That indicates insufficient input validation in the firmware stack, a separate but related issue.

---

## What I did not do

This section matters, so I'm going to be specific.

I did not attempt to access, modify, or exfiltrate any operational data. I did not attempt to reach avionics, flight controls, or safety-critical systems. I did not perform active exploitation of any kind. I did not attempt MITM attacks, credential harvesting, ARP spoofing, or lateral movement. I did not continue testing after confirming the segmentation failure.

I confirmed the finding, documented it, stopped, and wrote the disclosure report.

---

## Why this matters

Boeing 787 network architecture is governed by **DO-326A/ED-202A** (Airworthiness Security Process Specification) and **ED-12C**, which require strict isolation between passenger-accessible network domains and operational aircraft systems. The confirmed segmentation failure is a violation of those standards.

The theoretical attack surface from this class of vulnerability is significant:

| Vector | Estimated CVSS |
|---|---|
| MITM via ARP spoofing on crew comms | 8.1 (High) |
| SSL stripping / HTTPS downgrade | 7.5 (High) |
| Lateral movement to operational networks | 9.5 (Critical) |
| HP ProCurve management interface access | 9.0 (Critical) |
| Cross-domain protocol injection (ARINC 429/AFDX) | 10.0 (Critical) |

I want to be clear: these are *theoretical*. I did not test any of them. I cannot confirm their exploitability. I included them in the disclosure to help Boeing understand the potential severity of the class of failure, not to claim I achieved any of them.

The CVSS 10.0 vector — cross-domain protocol injection into ARINC 429 or AFDX — is the one that gets aviation security engineers out of bed. ARINC 429 is the databus that connects avionics: navigation, flight management, engine monitoring. Injecting into it from a passenger's seat is the nightmare scenario. I have no evidence it's reachable. But a confirmed segmentation failure is the first step on that path.

---

## Fleet implications

HP ProCurve-based cabin WiFi is a standardised Boeing OEM configuration used across multiple airlines. If the segmentation failure exists on the two Scoot 787s I flew, it likely exists on other 787s running the same configuration. That's a fleet-wide concern, not a one-aircraft issue.

---

## The disclosure

I submitted the report on 1 July 2026 to:

- Boeing Product Security (`product.security@boeing.com`)
- FAA Aviation Safety Cybersecurity (`9-AWA-AVS-Cybersecurity@faa.gov`)
- Australian Signals Directorate (`asd.ascs@defence.gov.au`)
- CAAS Singapore (`caas_security@caas.gov.sg`)
- SingCERT (`singcert@csa.gov.sg`)
- CERT/CC (`cert@cert.org`)
- Singapore Airlines (`security@singaporeair.com`)
- Scoot (`privacy@flyscoot.com`)

The report was submitted under ISO/IEC 29147 coordinated disclosure guidelines, with a request for an NDA, a coordinated timeline, and CVE/CNA guidance.

Boeing PSIRT acknowledged the report.

I have maintained strict confidentiality since submission and have not disclosed technical specifics beyond what is written here.

---

## The WiGLE scans

The passive scans are documented on the [Research](/research) page. They show HP ProCurve hardware BSSIDs on both flights, which constitutes the hardware fingerprint evidence included in the original report.

---

## Lessons

**Passive scanning is not hacking.** WiGLE is a publicly available tool that passively catalogues WiFi networks. Every device with WiFi enabled is doing the equivalent of this passively. The act of connecting to passenger WiFi and running ping is not meaningfully different from what any connected passenger does.

**Scope and ethics are not optional.** The moment I confirmed the segmentation failure, I stopped. Not because I was worried about getting caught. Because that's the correct boundary. The goal is to make the finding actionable for the vendor, not to see how far the rabbit hole goes.

**Aviation security has a disclosure problem.** There is no well-publicised, clearly accessible vulnerability disclosure programme for civil aviation infrastructure equivalent to what tech companies run. The FAA cybersecurity inbox and Boeing PSIRT exist, but the pathway is not obvious. It should be.

---

If you work in aviation cybersecurity or at a CERT and want to discuss the technical specifics under NDA, contact me at [JackSessions@protonmail.com](mailto:JackSessions@protonmail.com).
