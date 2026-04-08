# AI Companion: Image Workflow Input/Output Binding Contracts

## What this slice adds

Story 2.1.4 introduces a typed binding-contract layer so image workflows declare authoritative input/output slots and image systems bind those slots using logical asset references.

## Canonical files

- `src/shared/contracts/image-workflows/ImageWorkflowBindingContracts.ts`
- `src/shared/contracts/image-workflows/tests/ImageWorkflowBindingContracts.test.ts`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`

## Contract coverage

- Workflow input slot contracts:
  - required/optional flags
  - slot purpose (`source-image`, `mask-image`, `reference-image`, etc.)
  - cardinality/min-max counts
  - allowed asset/media classes
- Workflow output slot contracts:
  - required/optional flags
  - cardinality/min-max counts
  - emitted asset/media classes
- System binding contracts:
  - input slot -> logical asset references
  - output slot -> logical target references
  - accepted output compatibility constraints

## Validation posture

- Enforces at least one required source-image slot in workflow contracts.
- Rejects filesystem-path-like values in logical references.
- Validates required binding coverage and unknown slot references.
- Validates cardinality limits and asset/media compatibility mismatches.
- Produces structured issue codes for preflight/run-binding consumers.

## Boundary posture

- Contracts are path-free and protected-asset aligned.
- Contracts are reusable across domain, application, and future execution adapters.
- No ComfyUI JSON or UI-only payloads are embedded in the contract layer.

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
