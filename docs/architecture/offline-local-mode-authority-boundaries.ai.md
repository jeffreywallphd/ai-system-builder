# AI Companion: Offline Local-Mode Authority Boundaries

## Purpose

Feature 19 / Epic 19.1 defines limited local autonomy for desktop clients.  
Story 19.1.3 adds explicit resource classification and policy-driven posture evaluation so offline behavior is never accidental.

## Canonical files

- `src/domain/platform/OfflineLocalModeBoundaries.ts`
- `src/application/common/OfflineResourceClassificationPolicy.ts`
- `src/application/common/OfflineLocalModeResynchronization.ts`
- `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- `docs/architecture/offline-local-mode-authority-boundaries.md`

## Story 19.1.3 additions

- Added explicit eligibility metadata per resource class (`OfflineResourceEligibilityMetadata`):
  - behavior class
  - max sensitivity
  - trusted-device requirements
  - visibility/sharing constraints
- Added domain policy evaluator:
  - `evaluateOfflineResourcePolicy(resourceClass, policyInput)`
- Added application classification seam:
  - `classifyOfflineResourceLocalModePolicy(...)`
  - `classifyOfflineResourcePolicyMatrix(...)`
- Added resource-policy matrix projection:
  - `listOfflineResourceEligibilityPolicies()`

## Classification inputs

- workspace visibility
- workspace access role
- workspace sharing posture
- sensitivity marking
- storage rule
- device trust posture

## Classification outputs

- explicit per-operation posture (`cache`, `read`, `edit`, `queueMutation`, `execute`)
- deterministic allow/deny reason for each operation
- `exclusionReasons` summary list
- explicit unsupported-resource handling (`supportedResourceClass = false`)

## Production behavior classes

- `cached-read-only`
- `local-draft`
- `queued-authoritative-intent`
- `local-ephemeral-execution`
- `server-only`

## Prohibited outcomes preserved

- no silent global divergence
- no local cache as authoritative source of truth
- no unsignaled authoritative overwrite

## Test coverage

- `src/domain/platform/tests/OfflineLocalModeBoundaries.test.ts`
  - matrix coverage
  - unsupported resource exclusion
  - policy-input gating (trust/sharing/sensitivity/storage)
- `src/application/common/tests/OfflineResourceClassificationPolicy.test.ts`
  - application seam behavior
  - full matrix evaluation coverage
