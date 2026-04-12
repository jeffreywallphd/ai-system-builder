# Deployment Profile Policy Audit and Operational Governance Hooks

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.2: Build Persistent Policy Storage, Evaluation Integration, and Authoritative Administration APIs
- Story 20.2.6: Implement policy change audit and governance event hooks

## Purpose

Record governance-sensitive deployment-policy administration mutations through structured audit and operational governance events emitted from authoritative application use cases.

## Canonical files

- Application governance event contracts and redaction:
  - `src/application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts.ts`
- Policy mutation event emission:
  - `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- Platform audit/operational sink:
  - `src/infrastructure/api/deployment/PlatformDeploymentPolicyGovernanceEventSink.ts`
- Authoritative audit sink:
  - `src/infrastructure/audit/AuthoritativeDeploymentPolicyGovernanceEventSink.ts`
- Fanout composition:
  - `src/infrastructure/audit/AuditFanoutPublishers.ts`
- Host wiring:
  - `src/hosts/server/IdentityServerHost.ts`

## Event coverage in first production scope

- `deployment-policy-active-profile-changed`
  - emitted after successful active profile persistence
- `deployment-policy-overrides-mutated`
  - emitted after successful override mutation persistence

Both event types are emitted on:

- `audit` channel
- `operational` channel

## Recorded payload posture

Recorded governance payloads include:

- actor identity (`actorUserIdentityId` when available),
- scope (`workspace` or `system`),
- scope id,
- profile id,
- policy family ids impacted,
- safe before/after summaries for override mutations:
  - existence state,
  - value type,
  - revision.

First-scope payloads intentionally do **not** record raw override values.

## Redaction and safety

Governance event publication sanitizes:

- sensitive keys (for example `value`, `token`, `secret`, `payload`, `path`, `raw`),
- sensitive string patterns (tokens, rooted local paths, secret-like fragments),
- oversized arrays/objects/strings.

Sensitive fields are replaced with `[REDACTED]`.

## Architecture boundary

- emission occurs in application use-case layer after authoritative persistence success;
- event formatting/redaction occurs in application governance port;
- authoritative and platform mappings occur in infrastructure sinks;
- no policy-governance event logic is placed in UI components or route handlers.

## Tests

- `src/application/policy-administration/tests/DeploymentPolicyGovernanceEventPorts.test.ts`
- `src/application/policy-administration/tests/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.test.ts`
- `src/infrastructure/api/deployment/tests/PlatformDeploymentPolicyGovernanceEventSink.test.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
