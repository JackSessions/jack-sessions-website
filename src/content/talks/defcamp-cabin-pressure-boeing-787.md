---
title: "Cabin Pressure: Boeing 787 Cabin Network Segmentation — Research, Coordinated Disclosure, and Detection"
event: "DefCamp"
date: 2026-11-01
datePrecision: month
location: "Bucharest, Romania"
description: "How a lab-based investigation of Boeing 787 cabin network architecture found segmentation weaknesses across three classes — VLAN integrity, ACL enforcement gaps, and implicit trust of maintenance traffic — and how coordinated disclosure under ISO/IEC 29147 turned a safety-critical finding into actionable Sigma and YARA-L detections for defenders."
slidesUrl: "/slides/defcamp-cabin-pressure-2026.pdf"
tags: ["Aviation", "Network Security", "DO-326A", "Boeing", "Coordinated Disclosure", "Detection Engineering", "DefCamp"]
---

Presented at **DefCamp**, Bucharest — Eastern Europe's largest security conference.

The talk covers the full arc of the Boeing 787 cabin network segmentation research: the threat model, the lab methodology, the three classes of weakness found, the coordinated disclosure process under ISO/IEC 29147, and the defensive detections that ship as a result.

Exploit specifics are responsibly withheld pending remediation. The focus is on impact, process, and defence — not a reproduction recipe.

**Key takeaways:**
- Position is not trust: segmentation must be enforced and monitored, never assumed from a diagram
- Coordinated disclosure through CERT/CC, SingCERT, CAAS, FAA and ASD turned a safety-critical finding into a remediation process
- East-west telemetry and Sigma / YARA-L rules catch this class of lateral movement today
