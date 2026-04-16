# Artifact Contracts

Artifact contracts define boundary-safe metadata for ingested and derived data objects.

Use this family for artifact-level semantics that sit above storage operations:

- lifecycle kind (`raw-staged`, `derived`, `materialized`)
- format/media metadata
- provenance links to ingestion source, parent artifacts, and transforms
- normalized artifact descriptors keyed by storage artifact key

This family complements (and does not replace) storage operation contracts.
