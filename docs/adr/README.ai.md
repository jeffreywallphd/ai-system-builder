# AI Companion: ADR Documentation Router

## Audience
- AI assistants routing decision-history questions.
- Engineers checking where architectural decisions are recorded.

## Purpose
- Entry point for ADRs and decision supersession history.

## Belongs Here
- ADR records with context, alternatives, status, and consequences.
- Supersession trails between old and replacement decisions.
- Durable decision history for long-term architecture governance.

## Does Not Belong Here
- General architecture references without a formal decision.
- Operational procedures.
- Contributor implementation workflows.

## ADR File Home
- Store ADR files in `docs/adr/records/`.
- Use filename format `adr-<NNN>-<kebab-case-title>.md` and keep AI companions as `adr-<NNN>-<kebab-case-title>.ai.md`.
- Keep broad design contracts in `docs/architecture/`; use ADRs for explicit architecture decisions and rationale.

## ADR Discovery Registry
- Use `docs/adr/records/adr-registry.json` as the canonical fast-discovery artifact for ADR lookup by identifier, status, summary, and domain.
- Keep registry entries sorted by `adrNumber` ascending and synchronized with ADR frontmatter (`adr_number`, `decision_status`, `decision_date`, and title).
- Keep `discoveryIndex.byDecisionStatus` and `discoveryIndex.byDomain` aligned with `records` so assistants and maintainers can route quickly without scanning every ADR file.

## ADR Decision Thresholds

### ADR Required
- The change introduces or revises a durable architectural invariant that future implementation must respect.
- The change alters control-plane shape, authority boundaries, or host/runtime composition contracts.
- The change modifies workspace model guarantees (scope, tenancy, lifecycle, or cross-workspace behavior).
- The change redefines security trust boundaries, identity/authorization enforcement model, or transport/data trust assumptions.
- The change sets or reverses storage policy direction (durability model, persistence strategy, replication/sync authority, retention posture).
- The change locks in studio/system modeling semantics reused across multiple domains or subsystems.

### ADR Recommended
- The change creates a high-impact cross-domain tradeoff likely to be reopened without explicit rationale.
- The change introduces a new extension seam, platform-wide abstraction, or default pattern that other teams may copy.
- The change has long-lived consequences, but remains reversible with bounded migration effort.

### ADR Unnecessary
- The change clarifies or extends an accepted ADR without modifying the decision itself.
- The change is implementation-local to one component and preserves existing architecture contracts.
- The change is operational procedure, diagnostics, rollout sequencing, or incident-response guidance.
- The change is a historical completion snapshot, migration inventory, or baseline handoff artifact.

### Where To Document When ADR Is Unnecessary
- Architecture contracts: `docs/architecture/`.
- Contributor implementation guardrails: `docs/contributors/`.
- Runtime/admin operations: `docs/operations/`.
- Historical baselines and migration snapshots: `docs/baselines/`.
- Shared taxonomy/context semantics: `docs/context/`.

## ADR Metadata and Lifecycle Rules

### Numbering and Filename Rules
- ADR numbers are 3-digit, zero-padded identifiers (`001`, `002`, ...).
- Allocate numbers by taking the highest existing ADR number in `docs/adr/records/` and adding one.
- Numbers are unique and immutable; never renumber or reuse an old number.
- Every ADR pair must use the same number and slug in both files:
  - Human doc: `adr-<NNN>-<kebab-case-title>.md`
  - AI companion: `adr-<NNN>-<kebab-case-title>.ai.md`

### Title Rules
- Frontmatter `title` must use: `ADR-<NNN> <Decision Title>`.
- H1 must use: `# ADR-<NNN>: <Decision Title>`.
- `<Decision Title>` should be concise, stable, and aligned with the filename slug.

### Decision Status Rules
Use ADR lifecycle status values in `decision_status` frontmatter and mirror the same value in the `Status` section:

- `proposed`: decision under review; not yet adopted.
- `accepted`: approved direction and current decision of record.
- `superseded`: replaced by a newer accepted ADR; `superseded_by` must point to the replacement path.
- `deprecated`: still valid for legacy contexts but should not guide new architecture work.

### Amendment vs New ADR Rules
- Amend an existing ADR in place only for non-decisional edits: clarification, wording quality, typo fixes, broken links, or metadata cleanup.
- Create a new ADR whenever architectural intent changes in a durable way: authority boundaries, invariants, trust model, storage direction, tenancy guarantees, or extension constraints.
- For partial revisions, create a new ADR for the changed slice and keep the older ADR `accepted` or mark it `deprecated` depending on how much of its guidance remains valid.
- Never overwrite decision history by editing an old `Decision Statement` to represent a newly chosen direction.

### Supersession Representation Rules
- Use frontmatter `superseded_by` only on ADRs that are no longer current authority.
- Use frontmatter `supersedes` on the newer ADR that becomes decision authority for replaced scope.
- Keep links bi-directional:
  - Older ADR: `superseded_by: docs/adr/records/adr-<new>.ai.md`
  - Newer ADR: `supersedes: docs/adr/records/adr-<old>.ai.md`
- For full replacement, mark older ADR `decision_status: superseded`.
- For partial replacement, keep older ADR `accepted` or `deprecated` and explain narrowed scope in `## Supersession`.

### ADR-Specific Metadata Fields
Each ADR must include these lightweight metadata fields in frontmatter:

- `adr_number`: 3-digit ADR identifier matching filename/title.
- `decision_status`: one of `proposed`, `accepted`, `superseded`, `deprecated`.
- `decision_date`: `YYYY-MM-DD` date when decision status became `accepted` (or date accepted before later lifecycle changes).
- `review_tier`: one of `routine` or `heightened` to classify review depth expectations.

## High-Risk ADR Review Expectations

Use `review_tier` to distinguish routine ADR governance from ADRs requiring heightened care:

- `routine`: normal architecture review path for ADRs that do not change sensitive boundaries.
- `heightened`: stronger review path for ADRs that change high-risk architecture boundaries.

### High-Risk ADR Classes
- Security and trust boundaries: authentication, authorization, trusted-device/node trust, transport trust, secret handling, or audit redaction boundaries.
- Runtime control authority: control-plane ownership, orchestration mutation authority, or host-role inversion that can bypass centralized governance.
- Tenancy and isolation semantics: workspace ownership boundaries, cross-workspace access/data-flow rules, and isolation guarantees.
- Supersession of high-risk authority: replacing or narrowing an accepted high-risk ADR where downstream teams depend on existing guarantees.

### Heightened Review Minimums
- Keep review practical: require explicit evidence only for decisions crossing high-risk classes, not for routine implementation-local ADRs.
- Require at least two reviewers before moving `decision_status` to `accepted` or `superseded`:
  - one platform architecture owner, and
  - one domain owner from the highest-impact area (security, runtime, or tenancy depending on scope).
- Include a concise `## Review Expectations` section in the ADR capturing:
  - `Risk Class`
  - `Required Reviewers`
  - `Broader Architecture Review Trigger`
  - `Recertification Cadence`
- Keep cadence lightweight but explicit: high-risk accepted ADRs should define recertification timing in terms of architecture risk (for example every 6-12 months or on trigger events).

### Broader Architecture Review Triggers
Run broader architecture review before accepting or superseding an ADR when any of these are true:

- The ADR changes trust boundaries or privileged-operation pathways across multiple runtime surfaces.
- The ADR changes control-plane authority ownership or introduces alternate mutation channels.
- The ADR changes tenancy/isolation rules, especially cross-workspace visibility or ownership behavior.
- The ADR supersedes (full or partial) an accepted high-risk ADR and can change existing safety guarantees.

Broader review can remain lightweight (async design review thread or one focused review meeting) as long as decisions and dissent are captured in the ADR PR trail.

## Standard ADR Sections
- Required: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional: `Review Expectations` (required for `review_tier: heightened`), `Supersession` (required whenever the ADR supersedes another ADR or is superseded), and `Follow-Up Actions`.
- Author from `docs/context/templates/adr.template.ai.md` to keep ADR memory durable and consistent.
- Apply ADR quality guidance to avoid low-signal content: `docs/adr/records/authoring-guide.ai.md`.

## ADR Cross-Linking Conventions

Treat ADRs as integrated system docs, not an isolated decision folder. Keep cross-links explicit:

- In `## Related Documentation`, include repo-relative links for:
  - Architecture context docs (`docs/architecture/<...>.ai.md`) that define boundaries touched by the decision.
  - Related decision records (`docs/adr/records/adr-<NNN>-<...>.ai.md`) when supersession or dependency context exists.
  - High-value context assets (`docs/context/packs/<...>.pack.ai.md`, `docs/context/routing/<...>.ai.md`, or `docs/context/context-map.ai.md`) when routing should carry decision context.
- Prefer path-first references over narrative-only mentions so links stay maintainable.
- Keep links bi-directional:
  - ADRs link out to architecture/context docs in `Related Documentation`.
  - Architecture overviews/references include `## Related ADRs` with direct record links.
  - Context packs can cite ADRs in `## Authoritative Docs` when decision history is needed for safe implementation context.

## Initial ADR Rollout Boundaries
- The initial ADR rollout is intentionally bounded and not exhaustive.
- Use [ADR System Rollout Boundaries and Future Expansion Areas](./records/rollout-boundaries.ai.md) for explicit included scope, known gaps, and responsible expansion paths.

## Start Here
- [ADR Records Home](./records/README.ai.md)
- [ADR Discovery Registry](./records/adr-registry.json)
- [ADR System Rollout Boundaries and Future Expansion Areas](./records/rollout-boundaries.ai.md)
- [ADR Authoring Guide](./records/authoring-guide.ai.md)
- [ADR-Informed Implementation and Review Examples](../contributors/adr-informed-implementation-and-review-examples.ai.md)
- [ADR Template](../context/templates/adr.template.ai.md)
- [Architecture Router](../architecture/README.ai.md)
- [Docs Top-Level Contract](../README.ai.md)
- [Baselines Router](../baselines/README.ai.md)
