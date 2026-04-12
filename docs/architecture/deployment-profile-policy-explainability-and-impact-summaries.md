# Deployment Profile Policy Explainability and Impact Summaries

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.3: Deliver Policy Administration Surfaces, Safe Admin Controls, and Production Hardening
- Story 20.3.3: Implement policy explainability and impact summaries for admin decisions

## Purpose

Provide authoritative explainability metadata for deployment-policy families so administrators can see why effective values are set, what currently-implemented behavior those families influence, and when a policy family is governance-sensitive or foundational.

## Canonical files

- Canonical explainability metadata source:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Shared authoritative read contract projection:
  - `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`
  - `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`
- Admin explainability projection/presenter:
  - `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`
- Admin explainability surface:
  - `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`

## Explainability behavior

1. Effective-value provenance stays explicit per setting:
   - `Admin override`
   - `Preset default`
   - `Policy default`
2. Family-level explainability is sourced from canonical metadata, not UI-only hard-coded text:
   - behavior summary,
   - governed feature areas with current supported behavior descriptions,
   - governance sensitivity classification (`standard`, `governance-sensitive`, `foundational`),
   - optional governance warning text.
3. Admin UI presents warnings when families are `governance-sensitive` or `foundational`.
4. Fallback explainability text remains conservative when metadata is unavailable and does not imply unsupported future effects.

## Guardrails

- Explainability descriptions must describe currently implemented behavior only.
- Do not claim runtime enforcement or integrations that are not currently wired.
- Keep explanations aligned with deployment policy evaluation seams and active admin read/write behavior.
- Keep metadata centralized in domain taxonomy/catalog definitions so downstream projections remain consistent and auditable.

## Tests

- Explainability projection coverage:
  - `src/ui/shared/admin/tests/DeploymentPolicyAdministrationReadModel.test.ts`
- Shared read contract metadata mapping coverage:
  - `src/shared/contracts/deployment/tests/DeploymentPolicyReadContracts.test.ts`
- Documentation alignment coverage:
  - `src/application/deployment/tests/DeploymentPolicyExplainabilityDocumentation.test.ts`
