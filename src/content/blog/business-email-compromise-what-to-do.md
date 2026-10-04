---
title: "Business Email Compromise: The First Hour Matters Most"
description: "A practical, ordered checklist for responding to a suspected business email compromise, from the first hour of containment through to the fix that actually stops it happening again."
pubDate: "Oct 04 2026"
tags: ["DFIR", "BEC", "incident response", "email security"]
---

Business email compromise doesn't look dramatic when it starts. Someone in finance gets an email, apparently from the CEO or a known vendor, asking for an urgent wire transfer or a change to payment details. By the time anyone's suspicious, the account may have been sitting compromised for days or weeks, quietly reading mail and waiting for the right moment. Here's the order I actually work through.

## The first hour: contain, don't investigate yet

1. **Reset the compromised account's password**, and revoke all active sessions and refresh tokens, not just the password. A password reset alone often doesn't kill an already-issued OAuth token or session cookie.
2. **Check and remove mailbox forwarding rules and delegate access.** This is the single most common persistence mechanism in BEC: a rule that quietly forwards or hides specific incoming mail (often anything matching "invoice," "wire," or "payment") so the victim never sees the real conversation thread the attacker is hijacking.
3. **Enable or enforce MFA on the account immediately**, if it wasn't already on, which it usually wasn't.
4. **Pause any pending or recent wire transfers** tied to the compromised account's correspondence. If money has already moved, call the receiving bank's fraud line immediately. Hours matter: some transfers can still be recalled or frozen within the first 24 to 48 hours, essentially none after that.

Do all four before you start digging into how it happened. Containment first, root cause second.

## The investigation: what actually happened, and for how long

- **Pull the sign-in logs** for the account: source IPs, impossible travel, new device or application registrations, and the actual timestamp of the first anomalous login, which is usually earlier than anyone expects.
- **Find every mailbox rule, delegate, and app registration** created during the suspected window, not just the ones currently active. An attacker who's already been caught once will sometimes leave a second, quieter persistence mechanism behind.
- **Read the actual hijacked thread.** BEC usually doesn't start a new conversation, it inserts itself into a real one, often by registering a lookalike domain one character off from the real vendor's, then replying from that lookalike domain once the real thread has enough context to be convincing.
- **Check for lateral spread.** Did the compromised account send phishing to other internal staff or external contacts, which is both a secondary risk and often the actual delivery vector that got this account compromised in the first place?

## Fixing it so it doesn't happen again

- **Enforce MFA organization-wide**, with phishing-resistant methods (security keys or an authenticator app, not SMS) if the environment supports it, since SMS-based MFA has its own well-documented bypass techniques.
- **Add a callback verification step for any payment detail change**, a phone call to a known, previously-verified number, not one in the email. This single process change stops more BEC fraud than any technical control.
- **Monitor for lookalike domain registrations** of your own and your major vendors' domains. Several free and commercial services do this continuously.
- **Review and alert on new mailbox forwarding rules** going forward; most mail platforms can flag this as a detection rule on its own, and it should be treated as a near-certain compromise indicator when it targets financial keywords.

## The one habit that would have stopped most of the cases I've seen

A callback to a known number before any payment detail ever changes. It costs one phone call and it defeats the entire premise of the attack, which depends entirely on the victim trusting the email itself.
