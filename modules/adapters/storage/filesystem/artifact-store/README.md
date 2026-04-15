# Desktop Artifact Store Adapter

`createDesktopFilesystemArtifactStorageAdapter` is a real filesystem-backed
`ArtifactStoragePort` implementation for desktop-host storage.

Current behavior:

- stores artifact bytes to disk under a configured root directory,
- keeps storage key handling logical at the contract boundary,
- resolves absolute file paths only within the adapter,
- returns structured contract successes/failures for store/retrieve/has/delete.
