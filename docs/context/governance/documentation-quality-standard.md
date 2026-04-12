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
  - docs/contributors/documentation-quality-rule-evolution-guide.md
  - docs/contributors/documentation-quality-tooling-maintenance-guide.md
  - docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.md
  - docs/contributors/documentation-quality-monitoring-and-feedback-guide.md
  - docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md
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
  - dev/tests/DocumentationQualityExceptionsStory742Guardrails.test.ts
  - dev/tests/DocumentationQualityMonitoringStory743Guardrails.test.ts
  - dev/tests/DocumentationQualityRolloutBoundariesStory744Guardrails.test.ts
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

Shared automation enforcement profile (Story 7.3.2):

- Required CI/shared automation gate command is `npm run docs:lint` (also transitively used by `npm test`, `npm run validate`, and `npm run validate:ci`).
- Default gate policy is severity-aware:
  - Block changes when one or more `critical` findings are present.
  - Do not block on `important` or `advisory` findings; surface them as non-blocking warnings/info for triage.
- If a validator fails without parseable issue codes, treat it as blocking until triaged because severity cannot be trusted.
- For time-boxed cleanup campaigns, strict escalation is allowed with `npm run docs:lint -- --strict-important`, which temporarily treats `important` as blocking in shared automation.
- Historical and transitional docs should keep metadata/status/supersession integrity blocking, while lower-value readability and hygiene findings remain non-blocking by default.

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

## Readability and Signal-to-Noise Enforcement Boundaries

Story 7.1.4 boundary: enforce readability through structural and measurable signals only. Do not gate merges on subjective prose quality judgments.

| Boundary ID | Applies to | Enforcement mode | Measurable or reviewable boundary | Default severity |
| --- | --- | --- | --- | --- |
| `READ-001` | Contract-critical governance and context docs (including this standard) | Automated | Required heading anchors must exist exactly as defined by validator/test contracts. | `critical` |
| `READ-002` | Router docs (`docs/README*` and top-level area `README*`) | Automated | Router word count must stay at or below 500, include at least 3 markdown links, and keep words-per-link ratio at or below 35. | `important` |
| `READ-003` | Architecture overview docs (`doc_type: architecture-overview`) | Automated | Body word count should stay at or below 900 and include at least 3 H2 sections. | `important` |
| `READ-004` | Baseline, transitional, and superseded status anchor docs | Automated | Required status labeling markers from segmentation validation must remain present to preserve clear state signaling. | `critical` |
| `READ-005` | Active canonical docs (`status: active`, `authoritativeness: canonical`) | Reviewable now, lintable later | Mixed authority/history anti-pattern is prohibited: active canonical docs must not be used as supersession notices or historical redirect stubs. | `important` |
| `READ-006` | Router and overview docs | Reviewable now, lintable later | Catch-all structure anti-pattern is prohibited: avoid generic "miscellaneous"/"other notes" sink sections that dilute routing signal. | `important` |

Readability checks that remain out of scope for automated enforcement:

- Writing voice, tone, and pedagogy style.
- Grammar polish when meaning is already unambiguous.
- Subjective "good prose" assessments without deterministic structural indicators.

## Ownership and Review Responsibilities (Story 7.1.5)

This section defines who is responsible for documentation quality outcomes when linting and validators are necessary but not sufficient.

### Ownership Model by Documentation Category

| Documentation category | Primary owner role | Review responsibility | Escalation path when unresolved |
| --- | --- | --- | --- |
| Architecture docs (`docs/architecture/**`) | Architecture maintainers and feature owners for touched domains | Validate authority boundaries, ADR alignment, and domain placement before merge. | Escalate to architecture and developer-experience maintainers in the same pull request. |
| ADR records (`docs/adr/records/**`) | ADR maintainers and decision owners | Validate decision status, replacement chain integrity, and related-record links before merge. | Escalate to ADR maintainers; do not defer unresolved decision-state inconsistencies. |
| Context packs and routing artifacts (`docs/context/packs/**`, `docs/context/routing/**`, `docs/context/context-map.json`) | Developer-experience maintainers and context-system contributors | Validate pack IDs, routing mappings, and retrieval-critical references before merge. | Escalate to developer-experience maintainers; require same-PR remediation for broken retrieval contracts. |
| Contributor and operations docs (`docs/contributors/**`, `docs/operations/**`) | Domain maintainers for affected feature area | Validate actionable guidance, canonical links, and status signaling before merge. | Escalate to owning feature maintainers; involve developer-experience maintainers when placement or authority is unclear. |
| Baseline and historical materials (`docs/baselines/**` and superseded materials) | Documentation maintainers and feature owners performing transition | Validate supersession pointers, retention rationale, and non-authoritative labeling before merge. | Escalate to documentation maintainers when archival boundary decisions are ambiguous. |

### Manual Review Triggers (Automation Complements, Not Replacements)

Require targeted manual review when any of the following apply, even if linting passes:

- Canonical authority changes that alter decision meaning, contractual boundaries, or operational obligations.
- Supersession and redirect updates that change reader destination paths, replacement chains, or retention rationale.
- Cross-domain moves where document placement, ownership, or authoritativeness may become ambiguous.
- High-risk context assets involving security, identity, trust boundaries, runtime host startup, or policy enforcement guidance.
- Material updates to router, context-map, registry, or context-pack references that influence retrieval behavior.

### Interpreting Lint and Validation Failures

- `critical` failures are merge-blocking contract breaks; maintainers should treat them as correctness defects and resolve before approval.
- `important` failures are warning-level maintenance risks; maintainers should either resolve in the same pull request or explicitly track follow-up work in review notes.
- `advisory` findings inform readability and consistency; maintainers may merge when correctness is intact and no high-risk trigger is active.
- Repeated warning-only findings in the same doc family should trigger a scoped cleanup task rather than indefinite waiver.
- Do not silence a rule by policy text alone. If suppression is needed, update rule scope and guardrails in the same pull request.

### High-Risk Areas Requiring Additional Scrutiny

Apply at least one additional qualified reviewer for documentation changes in:

- Identity, authorization, secret-management, trust, and policy enforcement documentation.
- Runtime host composition, startup authority boundaries, and execution-control routing guidance.
- Context routing contracts, context-map entries, and context-pack catalog relationships used by automation.
- ADR supersession chains and architecture invariants that govern multiple domains.

### How This Fits Normal Repository Maintenance

- Contributors run lightweight validators locally (`npm run docs:validate:foundation`, `npm run docs:validate:registry`, `npm run docs:validate:adr`, `npm run docs:validate:architecture-domains`, `npm run docs:validate:segmentation`, `npm run docs:validate:cross-references`, `npm run docs:validate:category-compliance`) before requesting review.
- Contributors use `docs/contributors/documentation-quality-enforced-standards-guide.md` for preflight checks, templates/examples, and failure-category triage before running validators.
- Maintainers use severity and trigger guidance in this standard to decide whether a change is block-now, warn-and-fix-soon, or advisory-only.
- Manual review focuses on semantic correctness, authority boundaries, and high-risk change impact that automation cannot fully judge.
- Guardrail tests and validator contracts enforce stable structure, while reviewer judgment enforces correctness and trustworthiness.

## Rule Evolution and Contributor Stability (Story 7.3.5)

Use this rollout policy whenever adding or promoting documentation quality rules so enforcement improves without destabilizing contributor workflows.

### Rule Introduction Stages

1. Define rule contract and scope.
   - Include stable rule ID, explicit in-scope paths, and default severity.
   - Ensure checks are deterministic and lightweight for routine `npm run docs:lint` usage.
2. Run warning-first trial phase.
   - Introduce the rule as warning-level first unless it protects trust-critical contracts.
   - Measure false positives and tune scope before promotion.
3. Complete targeted cleanup.
   - Prioritize active canonical docs and high-frequency findings.
   - Use `npm run docs:lint -- --strict-important` only in scoped cleanup windows.
4. Promote only when ready.
   - Move to blocking only after trial signal quality is acceptable and cleanup readiness is documented.

### Warning-First Defaults

- Default new maintainability/readability checks to non-blocking warning behavior.
- Reserve immediate blocking rollout for contract-integrity failures that can misroute users, break indexing/discovery, or invalidate canonical authority semantics.
- Keep warning-first if unresolved false-positive classes remain.

### Legacy Documentation Policy

- Do not block unrelated work on untouched legacy docs.
- Apply touch policy: changed legacy docs should improve in touched scope; untouched legacy docs are addressed through tracked cleanup backlog.
- Maintain reduced enforcement for historical/superseded/baseline materials except for metadata, status, and redirect integrity.

### Communication Requirements for Enforcement Changes

Every rule/severity change must explicitly communicate:

- what changed (rule ID, scope, severity),
- why it changed (risk and expected contributor impact),
- when escalation occurs (warning start and blocking date/condition),
- how to fix findings (commands and canonical guide links),
- how legacy docs are handled during transition.

Record this in canonical governance/contributor docs in the same PR so enforcement changes remain predictable and trustable.

### Ongoing Tooling Maintenance Expectations (Story 7.4.1)

- Treat docs-quality tooling as maintained infrastructure, not one-time rollout work.
- Keep rule-policy docs, validators, and tests updated together in the same pull request when rule scope or severity changes.
- Assign explicit owners for warning backlogs and recurring validator drift; avoid indefinite warning accumulation.
- When checks become obsolete because documentation architecture evolves, deprecate or replace them with documented rationale and updated guardrails.
- Keep shared enforcement references aligned (`package.json` docs scripts, contributor run/fix guidance, rule evolution guidance, and registry routing metadata).

## Exceptions and Escape Hatch Policy (Story 7.4.2)

Exception handling is intentionally narrow. Use an exception only when a required rule cannot be followed without creating correctness, compliance, or safe-operation risk.

Allowed exception cases:

- external contract mismatch (vendor/regulatory format constraints),
- security or legal constraints (required redaction/disclosure boundaries),
- transitional migration constraints with explicit cleanup path.

Disallowed exception cases:

- convenience or deadline pressure,
- broad legacy waivers,
- bypassing fixable `critical` contract findings.

Every exception request must include:

- exact `rule_ids`,
- exact `paths` in scope (no wildcard directory bypass),
- reason mapped to an allowed case,
- owner, mitigation, and explicit expiry/review date.

Escalation and anti-abuse boundaries:

- high-risk domains require additional qualified review,
- repeated renewals for the same rule/path pair should trigger rule-tuning or migration work,
- exceptions never waive unrelated findings outside declared scope.

Use `docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.md` as the contributor workflow and record format.

## Monitoring and Continuous Improvement Signals (Story 7.4.3)

Use lightweight recurring monitoring to evaluate enforcement quality over time without introducing a heavy metrics program.

- Monitor false positives by rule and path family; repeated classes should trigger scope tuning before severity escalation.
- Monitor noisy rules that generate low-action warnings; keep warning-level, refine scope, or deprecate/replace when signal quality stays poor.
- Monitor rule drift and stale standards: governance docs, validators, and guardrail tests should remain aligned in the same pull request.
- Monitor contributor friction using PR remediation churn, repeated confusion on the same checks, and recurring exception requests.
- Monitor exception churn (`rule_ids` + `paths` renewals) as a rule-design debt signal requiring tuning or migration planning.

Operational expectations:

- Run a practical cadence review (for example every two to four weeks or release-boundary review) using existing PR and lint evidence.
- Prefer small corrective actions first: guidance clarification, scope narrowing, and warning-level policy tuning.
- Document decisions and owners in PRs or linked issues so continuous improvement work remains explicit and finite.
- Keep monitoring qualitative and actionable; do not require custom telemetry or mandatory KPI dashboards for this slice.

Use `docs/contributors/documentation-quality-monitoring-and-feedback-guide.md` for the contributor-facing monitoring loop and triage workflow.

## Rollout Boundaries and Follow-On Opportunities (Story 7.4.4)

The initial enforcement rollout is materially complete when these boundaries are explicit and stable:

- current blocking/non-blocking behavior stays clear and predictable,
- contributors can separate enforced contracts from guidance-only expectations,
- known limits and intentional out-of-scope areas are documented, not implicit.

Future improvements such as broader automation, richer linting, and deeper docs-system integration should ship as separate scoped stories, following warning-first rollout and monitoring evidence.

Use `docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md` for contributor-facing coverage boundaries and future-enhancement framing.

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

- Treat this document as the canonical quality baseline for Story 7.1.1, Story 7.1.2, Story 7.1.3, Story 7.1.4, Story 7.1.5, and downstream enforcement stories.
- Any change to required rules must be accompanied by corresponding validator or guardrail test updates in the same pull request.
- If a proposed requirement cannot be translated into a lightweight deterministic check, place it under recommended guidance instead of required rules.
- Keep `.md` and `.ai.md` versions aligned whenever this standard changes.
