# Hugging Face artifact-repo storage adapter

This module contains the first concrete artifact-repo storage provider adapter.

## Scope in this slice

- Implements `ArtifactRepoStoragePort` for `provider = "huggingface"`.
- Keeps provider-specific auth, path/repository validation, and provider status mapping inside the adapter boundary.
- Supports:
  - `hasArtifactInRepo` via `HEAD .../resolve/<revision>/<path>`,
  - `storeArtifactInRepo` via provider commit API (`POST /api/{datasets|models}/.../commit/<revision>` with explicit add/update operation payload),
  - `retrieveArtifactFromRepo` via `GET .../resolve/<revision>/<path>`.

## Configuration

- Token resolution order:
  1. `accessToken` option passed at composition boundary,
  2. `HF_TOKEN` environment variable,
  3. `HUGGING_FACE_TOKEN` environment variable.
- `storeArtifactInRepo` requires a token and fails with deterministic validation error when missing.
- Repository prefix handling:
  - `datasets/<namespace>/<repo>` => dataset repo type,
  - `models/<namespace>/<repo>` => model repo type,
  - no prefix => adapter default repo type (`dataset`).

## Notes

- This is intentionally a small provider slice, not full provider lifecycle management.
- Tests are mock-driven and deterministic (no live network dependency).

