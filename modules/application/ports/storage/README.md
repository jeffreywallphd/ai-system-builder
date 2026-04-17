# Storage Port

Application orchestration depends on `ArtifactStoragePort` for artifact/object storage behavior.

- store artifacts via `StoreArtifactRequest` / `StoreArtifactResult`
- retrieve artifacts via `RetrieveArtifactRequest` / `RetrieveArtifactResult`
- check existence via `HasArtifactRequest` / `HasArtifactResult`
- delete artifacts via `DeleteArtifactRequest` / `DeleteArtifactResult`

This port is intentionally key-based and artifact-oriented; adapters map keys to physical storage details.

This is an artifact/object storage port family.
If repo-backed provider semantics are introduced, they should be modeled through specialized storage ports/contracts instead of forcing all storage into this key/blob shape.
