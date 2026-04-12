# AI Companion: Execution Node Capability and Compatibility Contracts for Image Runs

## Story scope

Story 5.1.2 defines capability and compatibility contracts used to evaluate whether a trusted execution node can run supported image workflows through approved backend families.

## Implemented files

- `src/domain/nodes/ExecutionNodeDomain.ts`
- `src/domain/nodes/tests/ExecutionNodeDomain.test.ts`
- Human doc: `docs/architecture/execution-node-capability-compatibility-contracts.md`

## Core delivery

- Extended execution-node backend capability metadata with:
  - supported operation kinds
  - supported operation capabilities
  - supported input/output kinds
  - supported translation contract versions
  - resource-class hints
  - backend readiness profile (`ready|degraded|unavailable|unknown`)
- Added workflow/run requirement contract:
  - `ImageExecutionNodeCompatibilityRequirements`
- Added compatibility finding taxonomy:
  - `hard-incompatibility`
  - `soft-advisory`
  - `transient-availability`
- Added compatibility result contract:
  - `ImageExecutionNodeCompatibilityResult` (`compatible` + `routable`)
- Added compatibility evaluator:
  - `evaluateImageExecutionNodeCompatibility(...)`

## Boundary posture

- Uses AI Loom execution vocabulary and workflow metadata concepts; does not expose backend-native probe models.
- Keeps user identity, run lifecycle, node trust, and adapter implementation concerns separated.
- Provides a stable seam for later scheduler and node-assignment orchestration without embedding policy engines in adapters.

## Validation posture

- Execution-node domain tests verify hard/soft/transient finding distinctions and routability decisions.
