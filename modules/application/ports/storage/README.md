# Storage Port

Application orchestration depends on `ArtifactStoragePort` for artifact/blob storage behavior.

- store artifacts via `StoreArtifactRequest` / `StoreArtifactResult`
- retrieve artifacts via `RetrieveArtifactRequest` / `RetrieveArtifactResult`
- check existence via `HasArtifactRequest` / `HasArtifactResult`
- delete artifacts via `DeleteArtifactRequest` / `DeleteArtifactResult`

This port is intentionally key-based and artifact-oriented; adapters map keys to physical storage details.
