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

Required rules are automation-oriented and lintable. Severity decides whether a finding blocks or warns.

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

## Rule Severity Levels and Failure Policy

Use this severity model so validators and future docs lint tooling produce consistent, low-noise outputs.

| Severity level | Priority class | Definition | Default CI behavior | Lint output expectation |
| --- | --- | --- | --- | --- |
| `critical` | Critical structural failures | Contract/routing/authority failures that can break discovery or point users to incorrect canonical guidance. | Blocking failure (non-zero exit) when one or more `critical` findings exist. | Report as error entries with stable rule IDs and file/path context. |
| `important` | Important maintainability problems | Maintainability and drift risks that should be fixed promptly but usually do not break retrieval contracts immediately. | Warning by default (zero exit), with optional strict-mode promotion during focused cleanup efforts. | Report as warning entries with remediation hints. |
| `advisory` | Lower-severity advisory issues | Guidance-level quality improvements that help consistency and contributor experience. | Non-blocking informational output only. | Report as advisory/info entries and include in summary counts. |

Severity assignment contract:

- Every enforceable rule keeps a stable rule ID and default severity (`critical` or `important`).
- Recommended guidance maps to `advisory` unless explicitly promoted through governance review.
- CI behavior is severity-driven: fail on `critical`, warn on `important`, report-only on `advisory`.
- Profile overrides are allowed for targeted quality campaigns, but default repo behavior stays pragmatic and warning-first for non-structural issues.

## Documentation Category Rule Scope Matrix

Use this matrix when implementing linting/validation. It defines rule groups in scope and default severity by documentation category.

| Category | Rule groups in scope | Default severity profile | Scope notes |
| --- | --- | --- | --- |
| Architecture docs (`docs/architecture/**/*.md`) | 1, 2, 3, 4, 5 | `critical` for Groups 1-4; `important` for Group 5 | Apply full enforcement for active authority docs. |
| ADR records (`docs/adr/records/*.md`) | 1, 2, 3, 4 | `critical` for Groups 1-4 | Enforce metadata, decision/supersession integrity, and references; keep readability-shape checks minimal/template-based. |
| Context packs (`docs/context/packs/*.pack.md`) | 1, 2, 3, 4, 5 | `critical` for Groups 1-5 | Apply strictest enforcement: metadata, required headings, catalog/contract IDs, authoritative references. |
| Routing artifacts (`docs/context/routing/*.md`, `docs/context/routing/*.json`, `docs/context/context-map.json`) | 1, 2, 3, 4, 5 | `critical` for Groups 1-5 | Apply strictest enforcement because routing drives retrieval behavior. |
| Contributor docs (`docs/contributors/**/*.md`) | 1, 2, 4, 5 | `critical` for Groups 1-2; `important` for Groups 4-5 | Enforce metadata/status/reference hygiene; apply routing/index rules only when explicitly referenced. |
| Operations docs (`docs/operations/**/*.md`) | 1, 2, 4 | `critical` for Groups 1-2; `important` for Group 4 | Enforce metadata/status/reference hygiene; keep routing/readability shape checks selective. |
| Baselines (`docs/baselines/**/*.md`) | 1, 2, 4 | `critical` for Groups 1-2; `important` for Group 4 | Enforce explicit baseline/historical status and resolvable references; keep routing/index requirements selective. |
| Historical or superseded materials (status-marked superseded/archival docs) | 1, 2, 4 | `critical` for metadata/redirect integrity; `important` for hygiene checks | Reduce enforcement to identity + supersession/redirect integrity to prevent false positives from active-doc-only rules. |

## Category-Specific Enforcement Boundaries

- Select enforcement profile by path first, then narrow by status (`active`, `superseded`, `archived`).
- Treat context packs and routing artifacts as high-risk assets; keep strict checks enabled.
- Treat archival/superseded docs as historical references: enforce metadata and redirects, not active discoverability placement.
- Default maintainability checks in contributor and operations docs to `important` warnings unless contract integrity is affected.
- Encode this matrix in validator configuration so linting scope stays deterministic and avoids ad hoc exceptions.

## Readability and Signal-to-Noise Enforcement Boundaries

Story 7.1.4 scope: enforce readability with measurable structure/signal checks, not subjective prose scoring.

| Boundary ID | Applies to | Enforcement mode | Measurable/reviewable boundary | Default severity |
| --- | --- | --- | --- | --- |
| `READ-001` | Contract-critical governance/context docs (including this standard) | Automated | Required heading anchors must exist exactly per validator/test contracts. | `critical` |
| `READ-002` | Router docs (`docs/README*` plus top-level area `README*`) | Automated | Router docs stay at or below 500 words, include at least 3 markdown links, and keep words-per-link ratio at or below 35. | `important` |
| `READ-003` | Architecture overview docs (`doc_type: architecture-overview`) | Automated | Overview body stays at or below 900 words and includes at least 3 H2 sections. | `important` |
| `READ-004` | Baseline/transitional/superseded status anchor docs | Automated | Required status labeling markers from segmentation validation remain present. | `critical` |
| `READ-005` | Active canonical docs (`status: active`, `authoritativeness: canonical`) | Reviewable now, lintable later | Disallow mixed authority/history: active canonical docs cannot be supersession notices or redirect stubs. | `important` |
| `READ-006` | Router and overview docs | Reviewable now, lintable later | Disallow catch-all sink sections such as generic miscellaneous/other-notes buckets that reduce routing clarity. | `important` |

Readability checks intentionally out of automated scope:

- Tone and pedagogy style preferences.
- Grammar-polish-only issues when semantics are still clear.
- Subjective prose-quality judgments that lack deterministic signals.

## Recommended Guidance (Non-Blocking)

- Prefer concise, decision-oriented sections in active authority docs.
- Add compact rationale when constraints are non-obvious.
- Reuse links to canonical docs instead of duplicating long prose.
- Prefer stable headings and anchor names for docs used in routing/automation.

## Automation Mapping for Lightweight Tooling

- `critical` blocking checks now:
  - Presence/pairing contracts.
  - Frontmatter and taxonomy enums.
  - Required heading anchors.
  - High-value path/reference resolvability.
  - Supersession redirect integrity and active-router hygiene.
- Incremental low-cost `important` warning checks next:
  - Additional heading checks for new governance standards.
  - Companion metadata consistency for newly scoped doc families.
  - Focused anti-mixed-authority checks in selected active docs.
- Manual review only (`advisory`):
  - Tone, teaching depth, and prose quality.
  - Optional examples that are not contract-critical.

## Governance and Change Control

- Treat this doc as canonical quality baseline for Story 7.1.1, Story 7.1.2, Story 7.1.3, and Story 7.1.4.
- When required rules change, update validator/tests in same pull request.
- If a proposed rule cannot be checked deterministically with lightweight tooling, keep it non-blocking guidance.
- Keep `.md` and `.ai.md` versions aligned.
