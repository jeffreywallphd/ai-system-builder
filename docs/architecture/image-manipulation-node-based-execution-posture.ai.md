# AI Companion: Image Slice Node-Based Execution Posture

## Story scope

Story 5.1.5 documents how image execution is now formally node-based and authoritative, so backend execution is routed through trusted execution-node services instead of implicit local sidecar assumptions.

## Implemented docs and seams

- Human doc: `docs/architecture/image-manipulation-node-based-execution-posture.md`
- Prior Feature 5 baselines:
  - `docs/architecture/execution-node-domain-model-image-backend-hosting.md`
  - `docs/architecture/execution-node-capability-compatibility-contracts.md`
  - `docs/architecture/execution-node-repository-and-management-application-ports.md`
  - `docs/architecture/execution-node-management-readiness-api-contracts.md`

Canonical code seams referenced by this posture:

- `src/domain/nodes/ExecutionNodeDomain.ts`
- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`
- `src/application/image-workflows/ImageRunSubmissionReadinessValidationService.ts`
- `src/shared/contracts/nodes/ExecutionNodeManagementApiContracts.ts`
- `src/shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts.ts`
- `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Core posture

- Execution environments are first-class execution-node resources.
- Run eligibility and routing are determined through canonical compatibility/readiness services.
- ComfyUI remains an adapter/backend family implementation, not a lifecycle or policy authority.
- Public readiness and management surfaces expose normalized authoritative summaries, not raw backend probe payloads.

## Ownership boundary summary

- Domain and application layers own trust-linked node state, capability/eligibility evaluation, and run-readiness gating.
- Adapter/probe/host layers own backend transport/probe mechanics and projection into canonical contracts.
- Direct studio-to-backend execution paths for authoritative runs remain prohibited.

## Future extension alignment

This posture is the baseline for later multi-node scheduling, trust-policy hardening, and hybrid-node expansion without reworking transport contracts or backend adapters.
