# Filesystem Storage Adapters

This module provides concrete storage adapters that map logical storage keys
to host-local filesystem paths for real artifact persistence.

For the desktop upload slice, use the adapter exposed by
`artifact-store/createDesktopFilesystemArtifactStorageAdapter`.

Boundary rules:

- callers provide logical, path-agnostic storage keys through storage contracts,
- absolute filesystem path resolution stays inside the adapter,
- operation results and failures are returned through storage contract envelopes.
