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
  - docs/contributors/documentation-quality-rule-evolution-guide.ai.md
  - docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/validate-docs-segmentation.cjs
  - dev/scripts/validate-docs-cross-references.cjs
  - dev/scripts/validate-docs-category-compliance.cjs
  - dev/scripts/lint-docs.cjs
  - dev/tests/DocumentationQualityOwnershipReviewStory715Guardrails.test.ts
  - dev/tests/DocsCategoryComplianceValidationScript.test.ts
  - dev/tests/DocumentationCiFailurePolicyStory732Guardrails.test.ts
  - dev/tests/DocumentationRuleEvolutionStory735Guardrails.test.ts
  - dev/tests/DocumentationQualityToolingMaintenanceStory741Guardrails.test.ts
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

Shared automation enforcement profile (Story 7.3.2):

- Required CI/shared automation gate command is `npm run docs:lint` (also used transitively by `npm test`, `npm run validate`, and `npm run validate:ci`).
- Default severity-driven gate behavior:
  - Block on one or more `critical` findings.
  - Keep `important` and `advisory` findings non-blocking; emit warnings/info for triage and planning.
- If a validator exits non-zero without parseable issue codes, treat it as blocking until triage restores severity clarity.
- For scoped cleanup campaigns, strict escalation is available with `npm run docs:lint -- --strict-important`, which promotes `important` findings to blocking in shared automation.
- For transitional and historical docs, keep identity/status/redirect integrity blocking while readability/hygiene drift remains warning-first by default.

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

## Ownership and Review Responsibilities (Story 7.1.5)

This section defines quality ownership and review responsibility where linting is necessary but not sufficient.

### Ownership Model by Documentation Category

| Category | Primary owner role | Review responsibility | Escalation path |
| --- | --- | --- | --- |
| Architecture docs (`docs/architecture/**`) | Architecture maintainers plus touched-domain feature owners | Confirm authority boundaries, ADR alignment, and domain placement before merge. | Escalate to architecture and developer-experience maintainers in the same pull request. |
| ADR records (`docs/adr/records/**`) | ADR maintainers plus decision owners | Confirm decision status, replacement-chain integrity, and related-record links before merge. | Escalate to ADR maintainers; do not defer unresolved decision-state drift. |
| Context packs and routing artifacts (`docs/context/packs/**`, `docs/context/routing/**`, `docs/context/context-map.json`) | Developer-experience maintainers plus context-system contributors | Confirm pack IDs, routing mappings, and retrieval-critical references before merge. | Escalate to developer-experience maintainers; repair retrieval-contract breaks in the same pull request. |
| Contributor and operations docs (`docs/contributors/**`, `docs/operations/**`) | Feature-area maintainers | Confirm actionability, canonical links, and status signaling before merge. | Escalate to feature-area maintainers and involve developer-experience maintainers for placement/authority ambiguity. |
| Baseline and historical materials (`docs/baselines/**` plus superseded docs) | Documentation maintainers plus transition owners | Confirm supersession pointers, retention rationale, and non-authoritative labeling before merge. | Escalate to documentation maintainers for archival-boundary ambiguities. |

### Manual Review Triggers (Automation Complements, Not Replacements)

Require manual review even when linting passes if changes affect:

- Canonical authority meaning, contractual boundaries, or operational obligations.
- Supersession/redirect destinations, replacement chains, or retention rationale.
- Cross-domain placement where ownership or authoritativeness may become ambiguous.
- High-risk context assets covering security, identity, trust boundaries, runtime host startup, or policy enforcement.
- Router/context-map/registry/context-pack references that influence retrieval behavior.

### Interpreting Lint and Validation Failures

- `critical` means merge-blocking contract failure; treat as correctness defect and resolve before approval.
- `important` means warning-level drift risk; fix in the same pull request or log explicit follow-up work in review notes.
- `advisory` is non-blocking guidance; merge is acceptable when correctness is intact and no high-risk trigger is active.
- Repeated warning-only findings in one doc family should create a scoped cleanup task instead of indefinite waivers.
- Do not silence rules by prose alone; update rule scope and guardrails in the same pull request when suppression is required.

### High-Risk Areas Requiring Additional Scrutiny

Require at least one additional qualified reviewer for:

- Identity, authorization, secret-management, trust, and policy enforcement docs.
- Runtime host composition, startup authority boundaries, and execution-control routing docs.
- Context routing contracts, context-map entries, and context-pack catalog relationships consumed by automation.
- ADR supersession chains and architecture invariants that affect multiple domains.

### How This Fits Normal Repository Maintenance

- Run lightweight validators locally before review (`npm run docs:validate:foundation`, `npm run docs:validate:registry`, `npm run docs:validate:adr`, `npm run docs:validate:architecture-domains`, `npm run docs:validate:segmentation`, `npm run docs:validate:cross-references`, `npm run docs:validate:category-compliance`).
- Use `docs/contributors/documentation-quality-enforced-standards-guide.ai.md` for pre-validation workflow, templates/examples, and common failure-category triage before running validators.
- Use severity plus trigger guidance to classify outcomes as block-now, warn-and-fix-soon, or advisory-only.
- Keep manual review focused on semantic correctness, authority boundaries, and high-risk impact that automation cannot fully judge.
- Keep validator contracts and reviewer judgment complementary: automation enforces structure, reviewers enforce trustworthiness.

## Rule Evolution and Contributor Stability (Story 7.3.5)

Use this staged rollout policy for new or promoted docs-quality rules so enforcement improves while contributor workflows stay stable.

### Rule Introduction Stages

1. Define contract and scope.
   - Provide stable rule ID, path scope, and default severity.
   - Keep checks deterministic and lightweight for normal `npm run docs:lint` runs.
2. Start with warning-first trial.
   - Default to non-blocking warning-level rollout except trust-critical contract checks.
   - Use trial findings to tune scope and reduce false positives.
3. Run scoped cleanup.
   - Prioritize active canonical docs and high-frequency findings.
   - Use strict escalation (`npm run docs:lint -- --strict-important`) only in scheduled cleanup windows.
4. Promote when ready.
   - Promote to blocking only after signal quality and cleanup readiness are documented.

### Warning-First Defaults

- New maintainability/readability checks should begin as warning-level.
- Immediate blocking is reserved for routing/indexing/authority contract integrity failures.
- Keep warning-first mode while unresolved false-positive classes remain.

### Legacy Documentation Policy

- Do not block unrelated contributor work on untouched legacy docs.
- Apply touch policy:
  - changed legacy docs improve in touched scope,
  - untouched legacy docs are handled through tracked cleanup backlog.
- Keep reduced enforcement for historical/superseded/baseline docs except identity/status/redirect integrity checks.

### Communication Requirements for Enforcement Changes

For each rule/severity change, communicate:

- what changed (rule ID, scope, severity),
- why changed (risk and contributor impact),
- when escalation occurs (warning start and blocking date/condition),
- how to remediate (commands plus canonical guides),
- how legacy handling works during transition.

Publish this in canonical governance and contributor docs within the same PR so contributors can predict enforcement behavior.

### Ongoing Tooling Maintenance Expectations (Story 7.4.1)

- Treat docs-quality tooling as maintained infrastructure, not one-time rollout work.
- Keep rule-policy docs, validators, and tests updated together in the same pull request when rule scope or severity changes.
- Assign explicit owners for warning backlogs and recurring validator drift; avoid indefinite warning accumulation.
- When checks become obsolete because documentation architecture evolves, deprecate or replace them with documented rationale and updated guardrails.
- Keep shared enforcement references aligned (`package.json` docs scripts, contributor run/fix guidance, rule evolution guidance, and registry routing metadata).

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

- Treat this doc as canonical quality baseline for Story 7.1.1, Story 7.1.2, Story 7.1.3, Story 7.1.4, and Story 7.1.5.
- When required rules change, update validator/tests in same pull request.
- If a proposed rule cannot be checked deterministically with lightweight tooling, keep it non-blocking guidance.
- Keep `.md` and `.ai.md` versions aligned.
