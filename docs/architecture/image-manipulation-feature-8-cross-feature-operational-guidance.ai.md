# AI Companion: Feature 8.4.3 Cross-Feature Operational Guidance (Image Slice)

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md`

## Why this exists
- Story 8.4.3 requires one cross-feature operations map for the full image manipulation vertical slice.
- Feature 8 is the final hardening layer; this note links Features 1-8 into one production-resilience posture.

## Core posture
- Keep authoritative APIs and application use cases as operational control plane.
- Keep shared taxonomy/resilience/recovery contracts as failure/recovery truth.
- Keep local filesystem paths and backend-native payloads out of canonical user-facing identity and recovery decisions.
- Keep degraded/partial/pending-recovery behavior explicit and actionable.

## Canonical cross-feature references
- Feature 1: `docs/architecture/image-asset-feature-1-final-baseline.md`
- Feature 2: `docs/architecture/image-workflow-system-definition-layer.md`
- Feature 3: `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- Feature 4: `docs/architecture/image-run-feature-4-final-baseline.md`
- Feature 5: `docs/architecture/image-manipulation-node-based-execution-posture.md`
- Feature 6: `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`
- Feature 7: `docs/architecture/image-manipulation-studio-feature-7-ux-composition-posture.md`
- Feature 8: resilience architecture/state/recovery/diagnostics/verification docs

## Operational guidance summary
- Diagnose in order: setup -> readiness -> dispatch/progression -> persistence/retrieval -> presenter mapping.
- Use authoritative ids (correlation/run/system/asset/result) for triage.
- Interpret degraded states through shared resilience contracts.
- Route recovery actions through authoritative seams:
  - retry launch (eligible + safe),
  - wait/refresh,
  - setup correction,
  - history-based continuation,
  - operator/admin escalation.

## Maintenance requirements
- Update this guide whenever resilience-sensitive behavior changes.
- Keep `.md` and `.ai.md` versions aligned.
- Keep resilience verification matrix, final completion note, and contributor guides cross-referenced.
