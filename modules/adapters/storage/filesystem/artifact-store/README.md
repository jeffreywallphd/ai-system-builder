# Filesystem Artifact Store Adapters

`createFilesystemArtifactStorageAdapter` is a real filesystem-backed
`ArtifactStoragePort` implementation for host-local storage.

`createFilesystemArtifactBrowserReadAdapter` is a filesystem-backed
artifact-browser read adapter that serves browse/detail/content-read from an
explicit metadata catalog file (`.catalog/artifact-browser.ndjson`).

Current behavior:

- stores artifact bytes to disk under a configured root directory,
- keeps storage key handling logical at the contract boundary,
- resolves absolute file paths only within the storage adapter,
- appends image metadata descriptors to a catalog on successful writes,
- serves artifact browser browse/detail/content-read from that catalog,
- does not define browser behavior via recursive filesystem traversal,
- returns structured contract successes/failures.
