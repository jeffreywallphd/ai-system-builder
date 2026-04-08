# Deployment Profile Policy Persistence and Repositories

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.2: Build Persistent Policy Storage, Evaluation Integration, and Authoritative Administration APIs
- Story 20.2.1: Implement durable storage for deployment profile selection and policy overrides

## Purpose

Provide durable persistence for deployment-policy administration state so active profile selection, override records, effective-policy metadata, and provenance/history are persisted and queryable instead of in-memory only.

## Canonical files

- Application repository port:
  - `src/application/deployment/ports/IDeploymentPolicyPersistenceRepository.ts`
- Persistence DTO contracts:
  - `src/shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos.ts`
- SQLite schema/migrations:
  - `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceMigrations.ts`
- SQLite mapper and repository adapter:
  - `src/infrastructure/persistence/deployment/DeploymentPolicyPersistenceMapper.ts`
  - `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceAdapter.ts`
- Authoritative persistence composition wiring:
  - `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`

## Persisted model

The deployment-policy persistence layer stores:

1. Active profile selection per deployment-policy scope.
2. Current admin override records keyed by scope/profile/family/setting.
3. Override change history (upsert/remove) with operation key, actor, timestamp, reason, ticket reference, and correlation id.
4. Effective policy metadata snapshots (evaluatedAt, layer, contract version, summary counts, validation outcome).
5. Replay-safe mutation records keyed by normalized operation key.

## Typed value and provenance behavior

Override records are persisted with explicit typed value columns:

- `value_type`: `string` | `number` | `boolean`
- `value_string`, `value_number`, `value_boolean`

Schema check constraints enforce that only the matching typed column is populated.

Each override row and override-history record also persists provenance:

- actor user identity id,
- ticket reference,
- reason,
- provenance update timestamp,
- mutation operation key and correlation metadata for auditing/replay.

## Repository boundaries

`IDeploymentPolicyPersistenceRepository` is the authoritative application seam. It exposes:

- active profile read/write,
- current override read/upsert/remove,
- override-history listing,
- effective-policy metadata read/write.

This keeps policy persistence concerns out of UI/transport code and allows future non-SQLite adapters without changing application contract semantics.

## Scope and growth posture

Current scope kind is explicit (`deployment-policy-scope`) and persisted per row. This keeps storage model extension-ready for future governance scopes while preserving current profile-oriented behavior.

The schema supports future policy-family growth by treating `family_id` and `setting_key` as data rather than fixed columns.

## Tests

- `src/shared/dto/deployment/tests/DeploymentPolicyAdministrationPersistenceDtos.test.ts`
- `src/infrastructure/persistence/deployment/tests/SqliteDeploymentPolicyPersistenceAdapter.test.ts`
- `src/infrastructure/persistence/tests/AuthoritativePersistenceComposition.test.ts`

