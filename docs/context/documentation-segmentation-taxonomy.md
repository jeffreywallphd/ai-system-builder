---
title: Documentation Segmentation Taxonomy
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - docs/architecture
  - docs/baselines
  - docs/contributors/docs-placement-guide.md
  - dev/tests/DocumentationSegmentationTaxonomyGuardrails.test.ts
---

# Documentation Segmentation Taxonomy (Story 5.1.1)

## Purpose

Define a small, practical segmentation model so contributors can classify documentation by current authority versus historical and transition intent without mixing concerns.

## Scope

This taxonomy classifies documentation by **segment role** in addition to `doc_type` and lifecycle metadata.

- `doc_type` answers: what kind of document is this?
- Segmentation answers: what state of authority/history does this document represent?

## Segment Categories

### 1) Active Guidance

- Role: current, day-to-day guidance used for implementation, architecture reasoning, and operations.
- Typical locations: `docs/architecture/`, `docs/contributors/`, `docs/operations/`, `docs/ui/`, and active top-level docs.
- Expected metadata: commonly `status: active` with `authoritativeness: canonical` or `reference`.
- Rule: active guidance must not depend on historical or transition-only docs as its authority source.

### 2) Baselines

- Role: point-in-time snapshots of delivery state, migration posture, or completion handoff.
- Typical locations: `docs/baselines/` and baseline artifacts explicitly referenced from active docs.
- Expected metadata: often `doc_type: baseline`, `authoritativeness: historical`.
- Rule: baselines preserve evidence and context; they do not define current behavior.

### 3) Historical Notes

- Role: preserved historical context that remains useful for auditability and traceability.
- Typical locations: superseded ADR records, historical sections in governed docs, or baseline-linked history.
- Expected metadata: commonly `authoritativeness: historical` with `status: superseded`, `deprecated`, or `archived`.
- Rule: historical notes must be clearly marked non-authoritative for current implementation decisions.

### 4) Migration Guides and Records

- Role: documents that plan, sequence, or validate controlled movement between documentation states.
- Typical locations: migration inventories, migration sequence notes, migration safety guidance.
- Expected metadata: usually `status: active`; authoritativeness depends on whether the guide is normative or advisory.
- Rule: migration docs can direct work, but they must point to active canonical destinations for end-state authority.

### 5) Rollout-Boundary Notes

- Role: explicit statements of scope boundaries, non-goals, and deferred work for bounded rollout phases.
- Typical locations: architecture/context rollout-boundary governance documents and ADR rollout boundary records.
- Expected metadata: commonly `status: active` and `authoritativeness: canonical` when they define current rollout boundaries.
- Rule: rollout-boundary notes define what is in or out for a phase; they do not replace subsystem architecture or runbook authority.

### 6) Temporary Transition Documents

- Role: short-lived bridge artifacts used while active docs are being split, moved, or reclassified.
- Typical locations: old-path pointer notes, migration-in-progress stubs, temporary coexistence notes.
- Expected metadata: often `status: superseded` or `deprecated` plus explicit replacement links.
- Rule: every temporary transition document must include a clear canonical destination and be removed when safe.

### 7) Superseded or Deprecated Documents

- Role: retired authority paths kept only for continuity, traceability, and inbound-link stability.
- Typical locations: legacy stubs and retired references that now redirect to canonical docs.
- Expected metadata: `status: superseded` or `status: deprecated`; use `superseded_by` when replacement is singular.
- Rule: superseded/deprecated docs must never be treated as canonical in new contributor workflows.

## Classification Rules

1. Assign exactly one primary segment category to each document.
2. Determine segment category from document intent and authority state, not from keyword matches.
3. If a document mixes active and historical content, split it or add explicit section boundaries before adding new guidance.
4. Keep active guidance and historical/transition material in separate files whenever practical.
5. When a document changes segment, update metadata (`status`, `authoritativeness`, `superseded_by`) and links in the same change.

## Practical Placement Heuristics

1. If contributors should follow it today, classify as `Active Guidance`.
2. If it captures a point-in-time record for traceability, classify as `Baselines` or `Historical Notes`.
3. If it coordinates change movement, classify as `Migration Guides and Records`.
4. If it states rollout phase boundaries/non-goals, classify as `Rollout-Boundary Notes`.
5. If it only bridges old and new locations, classify as `Temporary Transition Documents`.
6. If replaced or retired, classify as `Superseded or Deprecated Documents`.

## Relationship to Existing Taxonomy

- Keep using `doc_type`, `status`, and `authoritativeness` from `docs/context/documentation-taxonomy.md`.
- Use this segmentation taxonomy to decide placement and cleanup behavior during migration and retirement work.
- Where classifications conflict, prioritize current authoritative guidance and move historical detail to baseline or retired paths.

## Validation

- Guardrail test: `dev/tests/DocumentationSegmentationTaxonomyGuardrails.test.ts`
- Placement integration: `docs/contributors/docs-placement-guide.md`

