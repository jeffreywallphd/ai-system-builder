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

This is not a broad prose style manifesto. It is intentionally narrow and enforceable. Required rules are lintable constraints, but not every lintable issue should block merges.

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

## Rule Severity Levels and Failure Policy

Use these severity levels for all required rules so linting and CI can report outcomes consistently without over-policing documentation work.

| Severity level | Priority class | Definition | Default CI behavior | Lint output expectation |
| --- | --- | --- | --- | --- |
| `critical` | Critical structural failures | Contract, routing, or authority failures that can misroute readers, break discovery/indexing, or invalidate canonical references. | Blocking. Non-zero exit when one or more `critical` findings exist. | Emit as errors with stable rule IDs and path context. |
| `important` | Important maintainability problems | High-value quality issues that increase drift risk or maintenance cost but do not immediately break core retrieval contracts. | Warning. Zero exit by default, with optional strict mode escalation in dedicated quality campaigns. | Emit as warnings with stable rule IDs and remediation hints. |
| `advisory` | Lower-severity advisory issues | Readability and consistency guidance that improves contributor experience but is not suitable for deterministic merge blocking. | Non-blocking informational output only. | Emit as advisory/info entries and aggregate in quality summaries. |

Severity assignment contract for future tooling:

- Every enforceable rule must have a stable rule ID and default severity (`critical` or `important`).
- Recommended guidance maps to `advisory` unless explicitly promoted through governance review.
- CI exit behavior is severity-driven: fail on `critical`, warn on `important`, report-only on `advisory`.
- Rule severity can be profile-adjusted for targeted cleanup efforts, but the default repository profile remains pragmatic and warning-first outside structural breakages.

## Documentation Category Rule Scope Matrix

Use this matrix to determine which required rule groups are enforced per documentation category. This scope mapping is normative for linting and validation implementation.

| Documentation category | Rule groups in scope | Default severity profile | Category-specific scope notes |
| --- | --- | --- | --- |
| Architecture docs (`docs/architecture/**/*.md`) | 1, 2, 3, 4, 5 | `critical` for Groups 1-4; `important` for Group 5 | Active architecture authority docs must keep metadata integrity, status clarity, routing/index discoverability, and link hygiene. |
| ADR records (`docs/adr/records/*.md`) | 1, 2, 3, 4 | `critical` for Groups 1-4 | Full metadata and supersession integrity. ADR decision status and replacement/backlink integrity remain blocking. Readability-shape checks are minimal and template-driven. |
| Context packs (`docs/context/packs/*.pack.md`) | 1, 2, 3, 4, 5 | `critical` for Groups 1-5 | Strictest enforcement. Required heading shape, metadata alignment, catalog/contract ID integrity, and authoritative reference resolvability are all blocking. |
| Routing artifacts (`docs/context/routing/*.md`, `docs/context/routing/*.json`, `docs/context/context-map.json`) | 1, 2, 3, 4, 5 | `critical` for Groups 1-5 | Strictest enforcement. Task/category IDs, mapping references, route hints, and canonical path targets are blocking because these files drive retrieval behavior. |
| Contributor docs (`docs/contributors/**/*.md`) | 1, 2, 4, 5 | `critical` for Groups 1-2; `important` for Groups 4-5 | Metadata and status clarity are blocking. Routing/index cross-reference rules apply only when contributor docs are referenced by registry/routing artifacts. |
| Operations docs (`docs/operations/**/*.md`) | 1, 2, 4 | `critical` for Groups 1-2; `important` for Group 4 | Metadata and status clarity are blocking. Routing discipline checks apply only when docs are explicitly indexed/routed. Heading-shape checks are advisory unless contract-critical. |
| Baselines (`docs/baselines/**/*.md`) | 1, 2, 4 | `critical` for Groups 1-2; `important` for Group 4 | Must keep explicit baseline/historical status signaling and resolvable references. Routing/index placement is selective and non-universal by design. |
| Historical or superseded materials (any `status: superseded` or under historical/baseline legacy paths) | 1, 2, 4 | `critical` for metadata and redirect integrity; `important` for non-blocking hygiene checks | Reduced enforcement to avoid false positives. Require valid metadata, explicit supersession/redirect signals, and resolvable replacement pointers; do not require active-router placement or modern readability shape. |

## Category-Specific Enforcement Boundaries

- Keep enforcement profile selection path-first and status-aware: select category by repository path, then apply status (`active`, `superseded`, `archived`) narrowing rules.
- Treat context packs and routing artifacts as high-risk retrieval assets; apply strict metadata, contract, and heading checks by default.
- Treat archival and superseded material as reference history, not active authority: validate identity and redirect integrity without requiring active discoverability placement.
- Default to warning-level enforcement (`important`) for maintainability issues in contributor and operations docs unless the issue breaks a contract.
- Avoid category drift in future linting work by encoding this matrix directly in validator configuration, not ad hoc file-by-file exceptions.

## Recommended Guidance (Non-Blocking)

- Prefer concise sections and decision-oriented phrasing over narrative history in active authority docs.
- Include short rationale notes when introducing non-obvious constraints so future contributors can preserve intent.
- Keep examples minimal and realistic; link to canonical references instead of duplicating long content.
- Favor stable anchor text and predictable heading names when a document is likely to be used for routing or automation.

## Automation Mapping for Lightweight Tooling

Use the following translation model when adding linting and validation:

- Enforce now with `critical` blocking checks:
  - File presence and pairing contracts.
  - Frontmatter shape and taxonomy enums.
  - Required heading anchors for core policy/contract docs.
  - Path/reference resolvability in high-value routing and registry artifacts.
  - Supersession redirect integrity and active-router hygiene.
- Enforce with low-cost incremental `important` warning checks next:
  - Additional heading/anchor checks for newly introduced governance standards.
  - Companion metadata consistency across newly scoped doc families.
  - Focused anti-mixed-authority detection in explicitly scoped active docs.
- Keep manual review only (`advisory`, non-blocking):
  - Writing tone, pedagogy depth, and narrative flow.
  - Domain-specific examples that are useful but not contract-critical.

## Governance and Change Control

- Treat this document as the canonical quality baseline for Story 7.1.1, Story 7.1.2, Story 7.1.3, and downstream enforcement stories.
- Any change to required rules must be accompanied by corresponding validator or guardrail test updates in the same pull request.
- If a proposed requirement cannot be translated into a lightweight deterministic check, place it under recommended guidance instead of required rules.
- Keep `.md` and `.ai.md` versions aligned whenever this standard changes.
