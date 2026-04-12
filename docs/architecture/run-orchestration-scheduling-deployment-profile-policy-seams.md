# Scheduling Deployment-Profile Policy Seams

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.3: Deliver Scheduling Visibility, Admin Controls, and Production Hardening
- Story 17.3.6: Validate deployment-profile seams for future classroom and organization policy variants

## Purpose

Validate that scheduler architecture is not hard-wired to a home-only profile and keep explicit seams for future deployment-profile policy growth (for example classroom oversight, stricter organization policy overlays, quota layering, and time-window restrictions) without implementing those policies prematurely.

## Canonical seam files

- Deployment-profile policy seam contracts:
  - `src/application/scheduling/ports/SchedulingPolicyProfilePorts.ts`
- Scheduling input assembly with deployment-profile context resolution:
  - `src/application/scheduling/use-cases/AssembleAuthoritativeSchedulingInputUseCase.ts`
- Scheduling policy evaluator with profile-aware rule-set seam:
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- Ordered rule pipeline contracts/implementation:
  - `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts`
  - `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`

## Validated seams

### 1. Deployment-profile policy context seam

- `ISchedulingDeploymentProfilePolicyContextPort` provides an application-layer hook for resolving authoritative deployment-profile context during snapshot assembly.
- `AssembleAuthoritativeSchedulingInputUseCase` calls this port (when provided) and writes `deploymentProfileId` onto `SchedulingEvaluationSnapshot`.
- This keeps deployment-profile lookup out of transport handlers, UI stores, and dispatch adapters.

### 2. Profile-aware rule-set seam

- `ISchedulingPolicyRuleSetProvider` allows policy-evaluator wiring to vary score policy, ordered rules, and policy source tags per evaluation snapshot.
- `EvaluateAuthoritativeSchedulingPolicyUseCase` resolves rule sets per snapshot and preserves default production behavior when no provider is configured.
- This keeps future classroom/organization policy variants behind one explicit policy-construction seam rather than branching scheduler logic across adapters.

### 3. Policy-source seam for future layering

- Rule-set providers can append policy-source entries through `SchedulingPolicyRuleSetDefinition.policySources`.
- This enables future quota/time-window/affinity overlays to be source-traceable in decision artifacts without modifying dispatch infrastructure.

## Current production behavior (unchanged)

- Default production rules remain role-priority + capability/schedulability + hybrid-local-use + reservation ownership checks.
- Basic placement affinity and deterministic arbitration remain unchanged.
- No new profile-specific allow/deny behavior is enabled by default in this story.

## No mock deployment-profile toggles

- This story adds seams only.
- No fake classroom/org/quota/time-window toggles are shipped.
- No placeholder "enabled-but-nonfunctional" profile flags are added.
- Future profile policies must be implemented as real rules/providers behind the new seams.

## Extension guidance for next stories

1. Implement a concrete `ISchedulingDeploymentProfilePolicyContextPort` adapter backed by authoritative policy data.
2. Implement one or more `ISchedulingPolicyRuleSetProvider` variants that map deployment profile (`home`, `classroom`, `organization`) to concrete rule sets.
3. Keep hard eligibility denials in rule modules; keep preference-only behavior in affinity modules.
4. Add/extend shared policy source reporting only when real policy rules are added.

## Verification baseline

- `src/application/scheduling/tests/AssembleAuthoritativeSchedulingInputUseCase.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/application/runs/tests/SchedulingDeploymentProfilePolicySeamsDocumentation.test.ts`
