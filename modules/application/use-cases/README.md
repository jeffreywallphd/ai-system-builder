# Application Use Cases

> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

Use cases in this folder own application orchestration and remain adapter-agnostic.

- `StoreArtifactUploadUseCase`
  - validates upload input at a basic, honest level,
  - delegates artifact persistence to `ArtifactStoragePort`,
  - emits structured start/success/failure events through `LoggingPort`,
  - returns a narrow descriptor-based result aligned to upload contracts.
