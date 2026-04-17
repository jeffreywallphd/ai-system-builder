# Hugging Face artifact-repo storage adapter

This module contains the first concrete artifact-repo storage provider adapter.

## Scope in this slice

- Implements `ArtifactRepoStoragePort` for `provider = "huggingface"`.
- Supports a practical first path for:
  - `hasArtifactInRepo` (HEAD on resolve URL),
  - `storeArtifactInRepo` (PUT to upload endpoint),
  - `retrieveArtifactFromRepo` (GET resolve URL).
- Keeps provider-specific auth and HTTP mapping isolated to this adapter.

## Configuration

- Token resolution order:
  1. `accessToken` option passed at composition boundary,
  2. `HF_TOKEN` environment variable,
  3. `HUGGING_FACE_TOKEN` environment variable.

## Notes

- This is a minimal first provider slice, intentionally small.
- Upload endpoint support can vary by Hugging Face repo type/configuration; tests use mocked HTTP behavior to avoid flaky external dependency.
