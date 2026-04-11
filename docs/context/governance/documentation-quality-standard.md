---
title: Documentation Quality Standard
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-metadata-header.md
  - docs/context/documentation-status-signals.md
  - docs/context/documentation-index.md
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/documentation-registry.seed.json
  - docs/context/governance/context-governance-policy.md
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/validate-docs-segmentation.cjs
---

# Documentation Quality Standard

## Scope and Enforcement Boundary

This standard defines the minimum documentation quality rules AI Loom Studio enforces to keep architecture, context-engineering, ADR, indexing, and segmented guidance trustworthy over time.

This is not a broad prose style manifesto. It is intentionally narrow and enforceable. Required rules are blocking guardrails. Recommended guidance is non-blocking.

## Required Rules (Normative, Enforceable)

### Rule Group 1: Structure and Metadata Integrity

- Every authoritative markdown document must include valid frontmatter following `docs/context/documentation-metadata-header.md`.
- Metadata enums (`doc_type`, `status`, `authoritativeness`) must match taxonomy values from `docs/context/documentation-taxonomy.md`.
- Required `.md` and `.ai.md` companion files must remain present and metadata-aligned where companion pairing is part of the contract.

### Rule Group 2: Status and Authority Clarity

- Non-active documentation that serves baseline, transitional, or superseded roles must include explicit status signaling as defined in `docs/context/documentation-status-signals.md`.
- Superseded docs must declare and validate replacement targets using supersession conventions in `docs/context/documentation-supersession-and-redirect-conventions.md`.
- Active routers must not route readers to superseded authority paths.

### Rule Group 3: Authoritativeness and Routing Discipline

- Canonical sources must be discoverable from active routers and context indexes.
- Routing, registry, and context-map references must resolve and remain synchronized with contract-defined IDs and paths.
- Cross-domain placement must follow `docs/contributors/docs-placement-guide.md`; authority is defined by primary role, not convenience.

### Rule Group 4: Cross-Link and Reference Hygiene

- Local documentation references in enforced sections (routers, registry links, context packs, ADR relationship sections, supersession redirects) must resolve to existing repository paths.
- Registry and catalog cross-references (`relatedDocs`, `relatedRecordIds`, pack IDs, task mappings, ADR references) must remain internally consistent.
- JSON contract/seed artifacts used by the docs system must remain valid and schema-marker compatible.

### Rule Group 5: Readability Boundaries for Enforced Artifacts

- Contract-critical docs (routers, indexing model, quality standard, pack contracts, rollout boundaries, validation guides) must keep required section headings expected by guardrail tests.
- Governance and contributor docs must keep "required versus non-required" distinctions explicit where policy language is used.
- Documents should remain single-purpose by authority role; mixed-purpose authority/history content is not allowed in active canonical guidance.

## Recommended Guidance (Non-Blocking)

- Prefer concise sections and decision-oriented phrasing over narrative history in active authority docs.
- Include short rationale notes when introducing non-obvious constraints so future contributors can preserve intent.
- Keep examples minimal and realistic; link to canonical references instead of duplicating long content.
- Favor stable anchor text and predictable heading names when a document is likely to be used for routing or automation.

## Automation Mapping for Lightweight Tooling

Use the following translation model when adding linting and validation:

- Enforce now with blocking checks:
  - File presence and pairing contracts.
  - Frontmatter shape and taxonomy enums.
  - Required heading anchors for core policy/contract docs.
  - Path/reference resolvability in high-value routing and registry artifacts.
  - Supersession redirect integrity and active-router hygiene.
- Enforce with low-cost incremental checks next:
  - Additional heading/anchor checks for newly introduced governance standards.
  - Companion metadata consistency across newly scoped doc families.
  - Focused anti-mixed-authority detection in explicitly scoped active docs.
- Keep manual review only (non-blocking):
  - Writing tone, pedagogy depth, and narrative flow.
  - Domain-specific examples that are useful but not contract-critical.

## Governance and Change Control

- Treat this document as the canonical quality baseline for Story 7.1.1 and downstream enforcement stories.
- Any change to required rules must be accompanied by corresponding validator or guardrail test updates in the same pull request.
- If a proposed requirement cannot be translated into a lightweight deterministic check, place it under recommended guidance instead of required rules.
- Keep `.md` and `.ai.md` versions aligned whenever this standard changes.
