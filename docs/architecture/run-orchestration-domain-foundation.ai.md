# AI Companion: Run Orchestration Domain Foundation

## Story scope
Story 16.1.1 defines the generic canonical run domain and lifecycle baseline for authoritative orchestration.
Story 4.1.1 adds image-manipulation-specific authoritative run domain entities, lifecycle transition rules, and invariants.

## Implemented files
- Generic run lifecycle: `src/domain/runs/RunDomain.ts`
- Image run lifecycle and invariants: `src/domain/runs/ImageRunDomain.ts`
- Generic run tests: `src/domain/runs/tests/RunDomain.test.ts`
- Image run tests: `src/domain/runs/tests/ImageRunDomain.test.ts`
- Human doc: `docs/architecture/run-orchestration-domain-foundation.md`

## Image run canonical model
`ImageRunRecord` includes:
- identity and authority: `runId`, `workspaceId`, `ownerUserId`, `createdBy`, `lastModifiedBy`
- typed composition references: `systemId`, `workflowId`, `workflowTemplateId?`
- logical asset bindings: input bindings with canonical `asset:*` IDs
- immutable parameter snapshot
- lifecycle: status, status timestamps, and status history
- execution linkage metadata for queue/dispatch/adapter/node correlation
- failure summary and optional result lineage metadata

## Image lifecycle vocabulary
- `draft`
- `requested`
- `validating`
- `queued`
- `dispatching`
- `running`
- `degraded`
- `partially-completed`
- `completed`
- `failed`
- `cancelled`

Transition authority is explicit in `ImageRunLifecycleTransitions` and enforced by:
- `isImageRunLifecycleTransitionAllowed(...)`
- `transitionImageRunRecord(...)`

## Key invariants
- Ownership/scope is mandatory (`workspaceId`, `ownerUserId`).
- Composition references must stay system/workflow anchored.
- Input bindings must use canonical logical asset references (`asset:*`).
- Status-specific timestamp requirements are enforced.
- Status history must be chronological and terminate at current status.
- Dispatch/adapter linkage is only valid where lifecycle position allows it.
- Failed/degraded/partial states require failure summaries and coherent failure timing.

## Boundary rules
- Domain owns lifecycle truth and invariants.
- Application orchestrates transitions and policy workflow.
- Infrastructure handles persistence/transport/adapter mechanics.
- UI renders read models and emits intents only.

Rule: do not move lifecycle legality, ownership invariants, or reference normalization into transport/UI/persistence code.
