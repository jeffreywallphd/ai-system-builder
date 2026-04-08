# Deployment Profile Policy Admin Safe Update Workflows

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.3: Deliver Policy Administration Surfaces, Safe Admin Controls, and Production Hardening
- Story 20.3.2: Build safe admin forms and workflows for supported profile and policy changes

## Purpose

Provide production administration workflows that let authorized admins safely mutate supported deployment-profile state without raw-config editing. Workflows must clearly distinguish editable, inspect-only, and unsupported controls while routing all writes through authoritative APIs with contract validation.

## Canonical files

- Admin page workflow surface:
  - `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`
- Admin read model used for control classification:
  - `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`
- UI authoritative write service:
  - `src/ui/services/DeploymentPolicyAdministrationWriteService.ts`
- Shared write contracts and schema parsing:
  - `src/shared/contracts/deployment/DeploymentPolicyWriteContracts.ts`
  - `src/shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts.ts`

## Workflow behavior

### 1. Active-profile change flow

- Uses explicit target profile selection (`home`, `classroom`, `organization`).
- Requires explicit admin confirmation before submit.
- Supports dry-run and apply modes.
- Carries governance metadata (`reason`, `ticketReference`) through authoritative write contracts.
- Surfaces permission and validation failures with path-aware issue details.

### 2. Policy-override flow

- Allows only controls classified as `Editable` by canonical read-model data.
- Rejects write attempts for inspect-only/unsupported controls by keeping them non-interactive in the form.
- Supports typed upsert/remove operations with value handling based on canonical value type.
- Requires explicit confirmation and enforces ticket-reference posture where effective policy requires it.
- Uses `expectedRevision` when override records are present to align with conflict-safe writes.

### 3. Result and failure surfaces

- Mutation success surfaces indicate dry-run vs applied outcomes.
- Validation and permission errors are shown as clear human-readable messages plus structured issue lines.
- Control-support matrix explicitly reports:
  - editable controls,
  - inspect-only controls,
  - unsupported controls.

## Guardrails

- No direct persistence/repository mutation from UI.
- No mock-only toggle controls for unsupported policy families/settings.
- No profile-specific policy branching in UI beyond canonical read-model status classification.
- All write requests must use typed shared contracts and schema parsing.

## Tests

- `src/ui/services/tests/DeploymentPolicyAdministrationWriteService.test.ts`
- `src/ui/pages/tests/DeploymentPolicyAdministrationPage.test.tsx`
- `src/ui/shared/admin/tests/DeploymentPolicyAdministrationReadModel.test.ts`
