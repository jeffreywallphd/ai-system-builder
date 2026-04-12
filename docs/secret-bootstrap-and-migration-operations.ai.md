# AI Companion: System Secret Bootstrap and Migration Operations

Primary reference: `docs/secret-bootstrap-and-migration-operations.md`

## Purpose

Keep operator/admin bootstrap guidance aligned to hardened startup behavior for required system secrets.

## Hardened Behavior Summary

- Startup composes secret service, then enforces `assertSystemSecretBootstrapSafe(...)`.
- Required secret IDs are declared via `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`.
- For each required id: metadata existence -> migration/bootstrap creation when allowed -> runtime retrieval validation.
- Any required-secret `error` diagnostic yields invalid bootstrap state and fails startup.

## Key Configuration Inputs

- `AI_LOOM_SECRET_MASTER_KEY_ID`
- `AI_LOOM_SECRET_MASTER_KEY`
- `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`
- `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV`
- legacy migration inputs (temporary): `OPENAI_API_KEY`, `HUGGINGFACE_API_TOKEN`, `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY`

## Development Profile Notes

- policy can allow optional/development handling for selected signing material
- bootstrap generation is policy-governed and persisted durably
- provider credentials remain fail-fast required by default policy

## Extension Expectations

- add new required system secret definitions with classification + hierarchy + creation policy
- add migration/generation behavior only when explicitly justified
- update bootstrap tests and diagnostics docs with new material IDs/codes
