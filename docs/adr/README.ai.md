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

### ADR-Specific Metadata Fields
Each ADR must include these lightweight metadata fields in frontmatter:

- `adr_number`: 3-digit ADR identifier matching filename/title.
- `decision_status`: one of `proposed`, `accepted`, `superseded`, `deprecated`.
- `decision_date`: `YYYY-MM-DD` date when decision status became `accepted` (or date accepted before later lifecycle changes).

## Standard ADR Sections
- Required: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional: `Supersession` (required whenever the ADR supersedes another ADR or is superseded) and `Follow-Up Actions`.
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

## Start Here
- [ADR Records Home](./records/README.ai.md)
- [ADR Authoring Guide](./records/authoring-guide.ai.md)
- [ADR Template](../context/templates/adr.template.ai.md)
- [Architecture Router](../architecture/README.ai.md)
- [Docs Top-Level Contract](../README.ai.md)
- [Baselines Router](../baselines/README.ai.md)
