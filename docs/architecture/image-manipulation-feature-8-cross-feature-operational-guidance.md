# Feature 8 / Epic 8.4 Story 8.4.3: Cross-Feature Operational Guidance for the Image Slice

## Story alignment

- Feature 8: Validation, Error Handling, and Operational Resilience
- Epic 8.4: Resilience Verification, Audit Hardening, and Feature Completion
- Story 8.4.3: Review and harden cross-feature documentation and operational guidance for the full slice

## Purpose

Provide one maintenance-focused operations map for the complete image manipulation vertical slice so contributors can diagnose degraded behavior, apply safe recovery paths, and extend the slice without reintroducing architecture shortcuts.

This document does not replace feature-specific architecture docs. It cross-references and normalizes them into one operational posture for Features 1 through 8.

## Slice invariants (non-negotiable)

1. All run execution, readiness, status, retry, and cancellation actions flow through authoritative APIs and application use cases.
2. Local filesystem paths and backend-native payloads are never canonical user-facing identity or operational truth.
3. Validation and resilience semantics come from shared contracts, not from UI heuristics or adapter-local error strings.
4. Degraded operation is explicit and user-visible; degraded does not imply success and does not imply terminal failure.
5. Recovery actions are policy-aware and authoritative (retry, wait/reconcile, user-fix, operator-escalate), with audit trails for recovery-sensitive operations.

## Cross-feature map (Features 1-8)

### Feature 1: image assets and protected retrieval
- Baseline: `docs/architecture/image-asset-feature-1-final-baseline.md`
- Hardening: `docs/architecture/image-asset-validation-retrieval-hardening.md`
- Operational assumption: source/reference/result image identity is canonical asset id, not path.

### Feature 2: workflow and system definition durability/readiness
- Baseline/hardening seam: `docs/architecture/image-workflow-system-definition-layer.md`
- Operational assumption: launchability depends on persisted workflow/system readiness, not transient UI composition state.

### Feature 3: execution adapter boundary
- Baseline: `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- Operational assumption: readiness and execution status are normalized through application ports; no studio/provider direct probes.

### Feature 4: authoritative run orchestration
- Baseline: `docs/architecture/image-run-feature-4-final-baseline.md`
- Operational assumption: run lifecycle legality and mutation authority remain centralized in run domain/application seams.

### Feature 5: node eligibility/readiness and routing
- Node posture: `docs/architecture/image-manipulation-node-based-execution-posture.md`
- Operational assumption: routability is derived from node eligibility/readiness contracts, not implicit local runtime availability.

### Feature 6: result persistence, preview, and lineage
- Baseline: `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`
- Operational assumption: completion and review depend on authoritative result persistence and retrieval contracts, with explicit partial/degraded semantics.

### Feature 7: studio composition and runtime UX
- Baseline: `docs/architecture/image-manipulation-studio-feature-7-ux-composition-posture.md`
- Runtime messaging: `docs/image-manipulation-loading-status-conventions.md`
- Operational assumption: UX is a presenter of authoritative state and guidance, not an independent execution or recovery engine.

### Feature 8: resilience taxonomy, contracts, diagnostics, and verification
- Architecture model: `docs/architecture/image-manipulation-resilience-error-handling-architecture.md`
- State contracts: `docs/architecture/image-manipulation-resilience-state-contracts.md`
- Retry/recovery contracts: `docs/architecture/image-manipulation-retry-recovery-escalation-contracts.md`
- Diagnostics conventions: `docs/architecture/image-manipulation-resilience-diagnostics-correlation-redaction-conventions.md`
- Verification matrix: `docs/architecture/image-manipulation-resilience-verification-matrix.md`
- Operational assumption: resilience classification and recovery guidance are shared contract outputs consumed consistently across APIs and studio UX.

## Operational diagnosis flow

1. Identify scope first: setup/configuration, execution readiness, dispatch/progression, persistence/retrieval, or presentation mapping.
2. Capture authoritative identifiers: correlation id, run id, system id, and relevant asset/result ids.
3. Check readiness contracts before reattempting launch:
   - execution availability state,
   - node eligibility state and reason codes,
   - blocking vs advisory issues.
4. Check run lifecycle and status history:
   - ensure current run state allows requested recovery action,
   - ensure retry/recovery hints align with taxonomy/resilience semantics.
5. Check result/preview availability separately:
   - completed run does not imply preview immediately available,
   - partial availability requires refresh/reconcile paths, not silent success.
6. Use advanced diagnostics for operator triage only after user-safe summaries confirm action posture.

## Degraded-state interpretation guide

- `degraded`: launch or monitoring may continue with advisories; show warnings and action hints.
- `partial`: some surfaces are usable while others are unavailable; continue with explicit refresh/recovery guidance.
- `pending-recovery`: expected delayed convergence; present wait-and-refresh guidance with temporary framing.
- `blocked`: operation cannot proceed without user/operator action.
- `temporarily-unavailable`: retry may be appropriate after bounded wait.
- `unavailable`: no immediate launch/monitor/retrieval path; escalate or wait for platform repair.

Interpret these through shared resilience contracts and mapped presenter states (`loading|empty|error|ready|degraded`), not custom component vocabulary.

## Safe recovery paths

1. Retry launch: only when retry guidance is eligible and safe, and readiness precheck is launchable.
2. Wait and refresh: when state is temporary or pending recovery.
3. Adjust setup: when validation/configuration issues are user-fixable.
4. Reuse prior result or reopen latest setup: only from authoritative persisted history/state.
5. Escalate to operator/admin: when contracts classify operator-action-required or terminal platform issues.

All recovery actions must preserve authoritative IDs and route through canonical API/service seams. Do not add local-only continuation branches.

## Extension seams and anti-patterns

### Extend here
- Shared contracts for new taxonomy, resilience scopes/states, or recovery hints.
- Application normalization/readiness/use cases for new backend failure signals.
- API contracts/schema surfaces for new normalized diagnostics.
- Presenter mapping and UX copy for new already-normalized message/action kinds.
- Verification and audit suites for new failure classes.

### Do not extend here
- UI-local retry logic or local readiness probing.
- Adapter-owned product taxonomy classification.
- Direct backend transport calls from studio components for operational actions.
- Path-based identity or implicit local-file assumptions in run/result flows.

## Documentation maintenance checklist

When adding resilience-sensitive behavior for this slice:

1. Update the relevant feature doc and this cross-feature guide in the same change.
2. Keep `.md` and `.ai.md` versions aligned.
3. Keep `docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md` aligned when scope, limits, or extension posture changes.
4. Add or update verification coverage in the resilience matrix where a new failure class is introduced.
5. Confirm contributor guides still point to the current authoritative seams.
6. Confirm architecture README index entries remain discoverable.

