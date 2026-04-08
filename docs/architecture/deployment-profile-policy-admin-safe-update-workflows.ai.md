# AI Companion: Deployment Profile Policy Admin Safe Update Workflows

## Purpose

Story 20.3.2 adds production-safe admin mutation workflows for deployment profile and policy overrides, with explicit confirmation/validation flows and no raw-config editing.

## Human doc

- `docs/architecture/deployment-profile-policy-admin-safe-update-workflows.md`

## Canonical files

- `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`
- `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`
- `src/ui/services/DeploymentPolicyAdministrationWriteService.ts`
- `src/shared/contracts/deployment/DeploymentPolicyWriteContracts.ts`
- `src/shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts.ts`

## Summary

- Active profile updates use explicit confirmation, dry-run/apply mode, and governance metadata.
- Override updates are limited to controls classified as editable by canonical read model data.
- UI separates editable/inspect-only/unsupported controls and does not render placeholder write controls for unsupported policy scope.
- Write outcomes and failures surface clear permission/validation messages with path-aware details.
