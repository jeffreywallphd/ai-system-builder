# ADR Index

This directory stores Architecture Decision Records (ADRs) for `ai-system-builder`.

## Purpose

ADRs capture architectural intentions and decisions so humans and AI agents can implement consistently.

## Rules

- Keep ADRs short and specific.
- Record decisions before implementation when practical.
- Update ADRs as implementation choices become final.
- Keep superseded ADRs; mark them and reference replacements.

## File Naming

Use `ADR-XXXX-short-title.md` with zero-padded numbers.

## Status Values

Use one of: `proposed`, `accepted`, `superseded`, `deprecated`.

## Workflow

1. Create a new ADR from `template.md`.
2. Link related ADRs and docs/context packs when relevant.
3. Keep decision and rationale aligned with current code.


## Current ADRs

- ADR-0003: Host Model and Transport Separation
- ADR-0012: Image Generation Runtime
- ADR-0013: Host-Owned Runtime Execution and Feature Placement (important source for cross-host runtime ownership and feature execution-placement decisions)
- ADR-0014: Runtime Installer Architecture
- ADR-0015: Security Architecture and Policy Boundaries (canonical security architecture boundaries across host, transport, storage, runtime, and policy layering)
- ADR-0016: Asset Kernel Terminology and Architecture Baseline (refines ADR-0005 into implementation-ready Asset Kernel vocabulary and Phase 2A sequence)
