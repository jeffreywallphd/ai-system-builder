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

## Active Versus Historical Decision Framework

Use this sequence in order for every migration decision:

1. **Current-action test**: should a contributor or operator execute this guidance for current behavior today?
2. **Temporal-state test**: does the document describe present-state contracts or prior-state chronology?
3. **Authority-source test**: is this the canonical source for the scope, or is canonical authority elsewhere?
4. **Purpose test**: is the primary value operational/implementation direction or historical traceability/evidence?
5. **Replacement test**: if no longer current, is there a defined replacement path (`superseded_by`)?

If tests 1 through 4 indicate present-day authority, classify as `Active Guidance`.  
If tests 2 through 4 indicate retrospective value, classify as `Historical Notes` or `Baselines` based on record depth.  
If the document primarily coordinates movement between states, classify as `Migration Guides and Records` or `Temporary Transition Documents`.

## Segment Selection Signals

Use these signals to reduce ambiguity in borderline cases:

| If the document mainly... | Classify as... | Required handling |
| --- | --- | --- |
| Defines current contracts, guardrails, or operational steps | `Active Guidance` | Keep `status: active`; link to history instead of embedding long chronology. |
| Preserves a point-in-time state snapshot used as evidence | `Baselines` | Keep `authoritativeness: historical`; do not present as current authority. |
| Explains prior decisions/chronology without governing current behavior | `Historical Notes` | Mark non-authoritative and cross-link canonical active docs. |
| Plans or validates movement from old docs to new docs | `Migration Guides and Records` | Keep active only while migration remains in progress. |
| Declares current rollout scope, non-goals, or deferred boundaries | `Rollout-Boundary Notes` | Keep authoritative only for the active rollout phase. |
| Exists only to bridge old paths to current canonical destinations | `Temporary Transition Documents` | Include explicit destination links and retirement trigger. |
| Is replaced and retained for continuity or inbound-link stability | `Superseded or Deprecated Documents` | Set `status: superseded|deprecated`; set `superseded_by` when singular replacement exists. |

## Borderline Case Rules

1. If a document has current instructions plus retrospective rationale, keep only concise rationale in active docs and move chronology to historical/baseline docs.
2. If current instructions depend on old-state steps that should no longer be executed, split immediately and classify old-state material as historical or superseded.
3. If one file would require conflicting authority signals (for example both canonical current guidance and historical retirement state), split into separate files instead of averaging metadata.
4. If historical context is kept in an active doc for comprehension, label it explicitly as non-normative and link to the full historical record.
5. If maintainers disagree between two adjacent segments, default to the safer non-authoritative segment and add explicit links to canonical active guidance.

## Mixed-Content Split and Redirect Procedure

When a document combines active guidance with history, migration notes, or superseded implementation details:

1. Extract current authoritative guidance into the destination active doc.
2. Move chronology, prior behavior, or completion evidence into a historical or baseline doc.
3. Convert the source path into either:
   - an active index doc (if it remains a router), or
   - a transition/superseded stub with clear canonical destination links.
4. Update metadata and inbound links in the same change set so no path is left ambiguous.
5. Add or update guardrail tests that assert presence of required links and classification headings.

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
- Use `docs/context/documentation-supersession-and-redirect-conventions.md` for concrete supersession note, redirect, pointer, and deprecation marker format.
- Where classifications conflict, prioritize current authoritative guidance and move historical detail to baseline or retired paths.

## Validation

- Guardrail test: `dev/tests/DocumentationSegmentationTaxonomyGuardrails.test.ts`
- Placement integration: `docs/contributors/docs-placement-guide.md`

