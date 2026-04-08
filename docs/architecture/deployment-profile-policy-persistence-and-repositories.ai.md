# AI Companion: Deployment Profile Policy Persistence and Repositories

## Purpose

Story 20.2.1 adds durable deployment-policy administration persistence so active profile selection and policy override state are stored, replay-safe, and queryable with provenance.

## Human doc

- `docs/architecture/deployment-profile-policy-persistence-and-repositories.md`

## Canonical files

- `src/application/deployment/ports/IDeploymentPolicyPersistenceRepository.ts`
- `src/shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos.ts`
- `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceMigrations.ts`
- `src/infrastructure/persistence/deployment/DeploymentPolicyPersistenceMapper.ts`
- `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceAdapter.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`

## Added persistence coverage

- durable active profile selection per deployment-policy scope,
- durable override current-state records keyed by profile/family/setting,
- append-style override history with actor/timestamp/reason/ticket/correlation provenance,
- persisted effective-policy metadata summaries and validation outcomes,
- replay-safe mutation handling via normalized operation-key records.

## Typed storage and constraints

- override values persist as typed columns (`value_type`, `value_string`, `value_number`, `value_boolean`),
- schema checks enforce type-column consistency,
- history rows preserve upsert/remove operation kind and optional typed value snapshot.

## Repository seam

Application modules consume one repository interface:

- `IDeploymentPolicyPersistenceRepository`

This keeps persistence implementation details in infrastructure adapters and preserves clean separation from UI/transport layers.

## Tests

- `src/shared/dto/deployment/tests/DeploymentPolicyAdministrationPersistenceDtos.test.ts`
- `src/infrastructure/persistence/deployment/tests/SqliteDeploymentPolicyPersistenceAdapter.test.ts`
- `src/infrastructure/persistence/tests/AuthoritativePersistenceComposition.test.ts`

