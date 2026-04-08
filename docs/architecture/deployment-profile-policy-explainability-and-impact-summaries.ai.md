# AI Companion: Deployment Profile Policy Explainability and Impact Summaries

## Purpose

Story 20.3.3 adds authoritative explainability metadata and admin presentation for policy provenance and impact summaries so deployment policy decisions are understandable and auditable.

## Human doc

- `docs/architecture/deployment-profile-policy-explainability-and-impact-summaries.md`

## Canonical files

- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`
- `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`
- `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`
- `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`

## Explainability baseline

- Family metadata now carries:
  - `behaviorSummary`,
  - `governedFeatureAreas` with current behavior descriptions,
  - governance sensitivity (`standard`, `governance-sensitive`, `foundational`),
  - optional governance warnings.
- Admin read models consume this metadata to produce explainability sections and warnings.
- Effective setting source labels continue to show preset/policy default/admin override provenance.
- Fallback explainability text is conservative and avoids implying unsupported future behavior.

## Coverage

- `src/ui/shared/admin/tests/DeploymentPolicyAdministrationReadModel.test.ts`
- `src/shared/contracts/deployment/tests/DeploymentPolicyReadContracts.test.ts`
- `src/application/deployment/tests/DeploymentPolicyExplainabilityDocumentation.test.ts`
