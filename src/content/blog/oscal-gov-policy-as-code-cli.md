---
title: "oscal-gov: 111 Commands for Policy-as-Code"
description: "A CLI for NIST OSCAL that turns compliance frameworks into executable, version-controlled, CI/CD-integrated pipelines. Built for practitioners who are tired of compliance living in spreadsheets."
pubDate: "Oct 26 2026"
tags: ["OSCAL", "policy-as-code", "APRA CPS 234", "ASD Essential Eight", "GRC", "compliance", "open source"]
---

I built `oscal-gov` because I kept watching the same thing happen at every engagement: a compliance team with a 3,000-row spreadsheet, a security team with no idea the spreadsheet existed, and an audit that surfaced 40 gaps they both thought were covered. The root problem is not that people do not care about compliance. It is that compliance as a static document cannot be tested, diffed, or run in a pipeline.

NIST OSCAL (Open Security Controls Assessment Language) exists to solve this. It is a machine-readable XML/JSON/YAML format for expressing security controls, system security plans, component definitions, and assessment results. The spec is thorough and correct, and almost nobody uses it directly because the tooling is sparse. `oscal-gov` is 111 commands across the full OSCAL lifecycle, from authoring to gap analysis to audit artifact export.

## Why Policy-as-Code

When your compliance posture lives in a git repository, several things become possible that are impossible with documents. A pull request adding a new service must pass a gap analysis check before it merges. A control mapping can be diffed between versions. A risk score in AUD can be computed from the FAIR model and shown in a CI comment. An APRA CPS 234 self-assessment can run in under two minutes instead of two weeks.

```bash
$ oscal-gov init --framework apra-cps234 --org "Acme Bank" --output ./compliance

oscal-gov v2.4.1

  Initialising OSCAL workspace...
  ✔ Created system-security-plan.json
  ✔ Imported 37 APRA CPS 234 controls
  ✔ Generated component-definition.json (empty)
  ✔ Created .oscal-gov.yml (project config)
  ✔ Wrote .gitignore entries

  Next steps:
  1. oscal-gov component add --name "Core Banking API"
  2. oscal-gov gap-analysis run
  3. oscal-gov assess --output artifacts/
```

## Framework Coverage

The tool covers the frameworks that actually come up in Australian financial services and federal government contexts, with full OSCAL catalog and profile mappings for each.

- **APRA CPS 234** — full self-assessment flow, notification gap detection
- **ASD Essential Eight** — maturity level scoring, ML0-ML3 mapping
- **ISO 27001:2022** — Annex A control mapping, statement of applicability generation
- **NIST CSF 2.0** — function/category/subcategory full coverage
- **FedRAMP Rev5** — US federal authorisation package support
- **ISM (ACSC)** — Australian Government Information Security Manual controls

Each framework ships as an OSCAL catalog with resolved profiles, so you can map your component definitions against multiple frameworks simultaneously and see cross-framework coverage without re-entering data.

## Gap Analysis in Practice

```bash
$ oscal-gov gap-analysis run --framework apra-cps234 --format table

Gap Analysis — APRA CPS 234  2026-10-26T04:15:00Z

  COVERED (28/37)
  ┌──────────────┬──────────────────────────────────┬─────────────┐
  │ Control      │ Description                      │ Components  │
  ├──────────────┼──────────────────────────────────┼─────────────┤
  │ CPS234-23   │ Information security capability  │ Core API ✔  │
  │ CPS234-24   │ Board accountability             │ Policy ✔    │
  │ CPS234-27   │ Info asset identification        │ CMDB ✔      │
  └──────────────┴──────────────────────────────────┴─────────────┘

  GAPS (9/37)
  ┌──────────────┬──────────────────────────────────┬─────────────┐
  │ Control      │ Description                      │ Severity    │
  ├──────────────┼──────────────────────────────────┼─────────────┤
  │ CPS234-36   │ Third-party testing              │ HIGH        │
  │ CPS234-38   │ Incident notification (72hr)     │ HIGH        │
  │ CPS234-29   │ Change management controls       │ MEDIUM      │
  └──────────────┴──────────────────────────────────┴─────────────┘

  Coverage:  75.7%  |  Risk (FAIR):  $A 2.4M  annualised
```

## Command Surface

The 111 commands cover six major areas. Most are composable: pipe a gap analysis into a risk quantification, then into an OPA policy generation, then into a CI assertion.

| Command | What it does |
|---|---|
| `gap-analysis run` | Compares your OSCAL SSP against a framework catalog, outputs coverage with FAIR risk in AUD |
| `assess generate` | Produces OSCAL assessment results documents from the current SSP state, ready for auditor submission |
| `opa generate` | Emits OPA Rego policies from OSCAL control implementations |
| `servicenow sync` | Pushes OSCAL gap findings to ServiceNow IRM as risks with two-way sync |
| `terraform lint` | Checks Terraform plans against OSCAL control mappings, fails CI on gaps |
| `fair compute` | FAIR risk quantification from OSCAL findings, outputs loss exposure in AUD |

## Integrations

**MCP Server** — exposes the full command surface as Model Context Protocol tools, so any MCP-capable AI assistant can run gap analyses and query OSCAL state on your behalf.

**VS Code + Vim plugins** — OSCAL schema validation, control ID autocomplete, and inline gap warnings directly in your editor. The LSP server powers both plugins from a single binary.

**Terraform provider** — manage OSCAL documents as Terraform resources. Infrastructure changes and compliance changes live in the same PR and plan together.

**Bitbucket Pipelines** — drop-in pipe that runs gap analysis on every PR and comments with a coverage diff. Requires zero configuration beyond the framework name.

## The FAIR Risk Layer

One thing missing from most compliance tooling is a way to answer the question a board actually asks: how much does this gap cost us? `oscal-gov fair compute` takes OSCAL finding severity, asset criticality from your component definitions, and threat frequency estimates to produce a FAIR loss exposure in AUD. The numbers are estimates, not actuarial tables, but they are consistent, reproducible, and tied directly to the specific controls that are open.

```bash
$ oscal-gov fair compute --from gap-analysis.json --currency AUD

FAIR Risk Quantification  Monte Carlo n=10,000

  CPS234-36 Third-party testing gap
  ┌─────────────────────────────────────────────────────┐
  │  Loss Exposure (AUD, 90% CI)                        │
  │  10th pct  $A 380K   Low estimate                   │
  │  50th pct  $A 1.1M   Most likely                    │
  │  90th pct  $A 4.7M   Tail exposure                  │
  │                                                     │
  │  ALEF  0.34/yr     PLM  $A 3.2M                     │
  └─────────────────────────────────────────────────────┘

  CPS234-38 Incident notification gap
  ┌─────────────────────────────────────────────────────┐
  │  Loss Exposure (AUD, 90% CI)                        │
  │  10th pct  $A 200K                                  │
  │  50th pct  $A 780K                                  │
  │  90th pct  $A 2.9M   (regulatory penalty modelled)  │
  └─────────────────────────────────────────────────────┘

  Total annualised exposure:  $A 2.4M
```

## Why I Built It by Building It

I wrote the first command to understand the OSCAL spec, not to ship a tool. By command 30 I had learned more about the relationship between catalogs, profiles, and system security plans than I would have in six months of reading. By command 72 the tool was generating OPA policies I was actually using. By command 111 it covered everything I had needed across real engagements, including an APRA CPS 234 self-assessment and two ISO 27001 gap analyses.

The design principle: commands are composable and produce structured output by default. Every command accepts `--format json` so you can pipe it to the next step. The MCP server wraps all 111 commands, so the same tool that runs in CI is also queryable by an AI assistant reading your SSP in real time.

## Getting Started

```bash
# Install
pip install oscal-gov

# Initialise a workspace with ASD Essential Eight
oscal-gov init --framework asd-e8 --output ./compliance

# Run a gap analysis
oscal-gov gap-analysis run

# Generate OPA policies from current control implementations
oscal-gov opa generate --output ./policies/

# Sync gaps to ServiceNow IRM
oscal-gov servicenow sync --instance prod --table sn_risk_risk

# Start the MCP server for AI assistant integration
oscal-gov mcp serve --port 8090
```

Source on GitHub. Issues and PRs welcome.
