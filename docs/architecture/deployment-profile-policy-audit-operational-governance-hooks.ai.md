# AI Companion: Deployment Profile Policy Audit and Operational Governance Hooks

## Purpose

Story 20.2.6 adds production-ready policy governance hook integration so deployment-profile administration mutations emit structured audit and operational events with safe provenance and scope context.

## Human doc

- `docs/architecture/deployment-profile-policy-audit-operational-governance-hooks.md`

## Canonical files

- `src/application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts.ts`
- `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- `src/infrastructure/api/deployment/PlatformDeploymentPolicyGovernanceEventSink.ts`
- `src/infrastructure/audit/AuthoritativeDeploymentPolicyGovernanceEventSink.ts`
- `src/infrastructure/audit/AuditFanoutPublishers.ts`
- `src/hosts/server/IdentityServerHost.ts`

## First-scope events

- `deployment-policy-active-profile-changed`
- `deployment-policy-overrides-mutated`

Each mutation event is emitted on both channels:

- `audit`
- `operational`

## Safety/redaction posture

- event payloads include actor, scope, profile, and policy-family provenance;
- override payloads include only safe before/after summaries (existence/valueType/revision);
- raw override values are intentionally omitted;
- sensitive keys/strings are redacted before sink publication.

## Layering posture

- use-case layer emits governance events after persistence success;
- infra layer maps events to platform audit and authoritative audit systems;
- no UI-layer event emission logic is added.
