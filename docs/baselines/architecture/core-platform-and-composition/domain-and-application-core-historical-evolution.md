---
title: Domain and Application Core Historical Evolution
doc_type: baseline
status: active
authoritativeness: historical-reference
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/domain-and-application-core.md
  - src/domain
  - src/application
---

# Domain and Application Core Historical Evolution

## Purpose

Preserve high-value implementation chronology that was removed from active architecture guidance to keep `docs/architecture/domain-and-application-core.md` focused on current authority.

## Superseded Chronology Scope

This baseline preserves historical change-stream context that previously appeared as many `Direction ... update` sections in the active document.

The active authoritative document is:
- `docs/architecture/domain-and-application-core.md`

## Chronology Summary

### Direction 3 period: MCP registry and trust hardening
- Added MCP capability contracts, lifecycle update semantics, and safer install/update/remove policies.
- Added trust foundations for credential/configuration resolution and policy-gated execution.
- Added richer compatibility/change summary surfaces for safer upgrades.

### Direction 5 period: Studio Shell and Workflow Studio expansion
- Added canonical studio-shell metadata, lifecycle, versioning, and dependency controls.
- Added workflow studio validation, lifecycle, persistence, and taxonomy alignment seams.
- Added dataset/data-studio and runtime-window contract extensions over the same inner-layer boundary model.

### Direction 6 period: Identity foundation buildout
- Added identity domain contracts for providers, credential policy/state, and session lifecycle.
- Added application ports and deterministic orchestration seams.
- Added SQLite persistence/migration adapters and structured error/result taxonomies.

### Direction 8 and 19 period: Security and offline authority extensions
- Added secret domain/application contracts and access-decision boundaries.
- Added offline authority/reconnect policy seams with explicit no-silent-divergence posture.

## Historical-Only Usage Guidance

Use this baseline for:
- migration traceability and delivery chronology;
- auditing sequence of architectural changes.

Do not use this baseline as current normative guidance for implementation.

## Canonical Current Guidance

- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/domains/core-platform-and-composition/overview.md`
- `docs/architecture/domains/core-platform-and-composition/references/layer-direction-and-dependency-rules.md`
