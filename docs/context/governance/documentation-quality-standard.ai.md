---
title: "AI Companion: Documentation Quality Standard"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-metadata-header.ai.md
  - docs/context/documentation-status-signals.ai.md
  - docs/context/documentation-index.ai.md
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/documentation-registry.seed.json
  - docs/context/governance/context-governance-policy.ai.md
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/validate-docs-segmentation.cjs
---

# AI Companion: Documentation Quality Standard

## Scope and Enforcement Boundary

Use this standard as the enforceable baseline for documentation quality. It is intentionally narrow so tooling can validate it with low complexity.

Required rules are blocking and automation-oriented. Recommended guidance is advisory and non-blocking.

## Required Rules (Normative, Enforceable)

### Rule Group 1: Structure and Metadata Integrity

- Keep valid frontmatter in authoritative docs per `docs/context/documentation-metadata-header.ai.md`.
- Keep taxonomy enums (`doc_type`, `status`, `authoritativeness`) aligned with `docs/context/documentation-taxonomy.ai.md`.
- Keep required `.md` and `.ai.md` companion files present and metadata-aligned where pairing is part of contract.

### Rule Group 2: Status and Authority Clarity

- Keep explicit status markers for non-active docs per `docs/context/documentation-status-signals.ai.md`.
- For superseded docs, keep `superseded_by` and redirect targets valid per supersession conventions.
- Keep active routers free of links to superseded authority paths.

### Rule Group 3: Authoritativeness and Routing Discipline

- Keep canonical sources discoverable from active routers and context index surfaces.
- Keep routing/registry/context-map references synchronized to contract IDs and paths.
- Keep placement aligned to `docs/contributors/docs-placement-guide.ai.md`; authority follows primary role.

### Rule Group 4: Cross-Link and Reference Hygiene

- Keep local references in enforced sections resolvable to repository paths.
- Keep cross-reference integrity for registry/catalog links (`relatedDocs`, `relatedRecordIds`, pack IDs, task mappings, ADR links).
- Keep docs-system JSON contracts/seeds parseable and schema-marker compatible.

### Rule Group 5: Readability Boundaries for Enforced Artifacts

- Keep required heading anchors in contract-critical docs used by validation scripts/tests.
- Keep required-vs-guidance boundaries explicit in governance language.
- Keep active canonical docs single-purpose; split mixed authority/history content instead of blending.

## Documentation Category Rule Scope Matrix

Use this matrix when implementing linting/validation. It defines which required rule groups are blocking for each documentation category.

| Category | Blocking rule groups | Scope notes |
| --- | --- | --- |
| Architecture docs (`docs/architecture/**/*.md`) | 1, 2, 3, 4, 5 | Apply full enforcement for active authority docs. |
| ADR records (`docs/adr/records/*.md`) | 1, 2, 3, 4 | Enforce metadata, decision/supersession integrity, and references; keep readability-shape checks minimal/template-based. |
| Context packs (`docs/context/packs/*.pack.md`) | 1, 2, 3, 4, 5 | Apply strictest enforcement: metadata, required headings, catalog/contract IDs, authoritative references. |
| Routing artifacts (`docs/context/routing/*.md`, `docs/context/routing/*.json`, `docs/context/context-map.json`) | 1, 2, 3, 4, 5 | Apply strictest enforcement because routing drives retrieval behavior. |
| Contributor docs (`docs/contributors/**/*.md`) | 1, 2, 4, 5 | Enforce metadata/status/reference hygiene; apply routing/index rules only when explicitly referenced. |
| Operations docs (`docs/operations/**/*.md`) | 1, 2, 4 | Enforce metadata/status/reference hygiene; keep routing/readability shape checks selective. |
| Baselines (`docs/baselines/**/*.md`) | 1, 2, 4 | Enforce explicit baseline/historical status and resolvable references; keep routing/index requirements selective. |
| Historical or superseded materials (status-marked superseded/archival docs) | 1, 2, 4 | Reduce enforcement to identity + supersession/redirect integrity to prevent false positives from active-doc-only rules. |

## Category-Specific Enforcement Boundaries

- Select enforcement profile by path first, then narrow by status (`active`, `superseded`, `archived`).
- Treat context packs and routing artifacts as high-risk assets; keep strict checks enabled.
- Treat archival/superseded docs as historical references: enforce metadata and redirects, not active discoverability placement.
- Encode this matrix in validator configuration so linting scope stays deterministic and avoids ad hoc exceptions.

## Recommended Guidance (Non-Blocking)

- Prefer concise, decision-oriented sections in active authority docs.
- Add compact rationale when constraints are non-obvious.
- Reuse links to canonical docs instead of duplicating long prose.
- Prefer stable headings and anchor names for docs used in routing/automation.

## Automation Mapping for Lightweight Tooling

- Blocking checks now:
  - Presence/pairing contracts.
  - Frontmatter and taxonomy enums.
  - Required heading anchors.
  - High-value path/reference resolvability.
  - Supersession redirect integrity and active-router hygiene.
- Incremental low-cost checks next:
  - Additional heading checks for new governance standards.
  - Companion metadata consistency for newly scoped doc families.
  - Focused anti-mixed-authority checks in selected active docs.
- Manual review only:
  - Tone, teaching depth, and prose quality.
  - Optional examples that are not contract-critical.

## Governance and Change Control

- Treat this doc as canonical quality baseline for Story 7.1.1 and Story 7.1.2.
- When required rules change, update validator/tests in same pull request.
- If a proposed rule cannot be checked deterministically with lightweight tooling, keep it non-blocking guidance.
- Keep `.md` and `.ai.md` versions aligned.
