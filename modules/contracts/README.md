# Contracts

This module contains shared boundary contracts used across application, hosts,
and adapters.

Current contract families include:

- `shared` result/error backbone
- `transport` plus `api` and `ipc` specializations
- `runtime`, `persistence`, `storage`, and `ingestion`
- `artifact`, `transform`, `lineage`, and `dataset` for ELT-style data flow
- `host` context metadata
- `logging` vocabulary
- `config` typed configuration concerns

## Terminology Guardrails

- Use **asset** terminology for composable system parts and built-system units.
- Use **artifact** terminology for stored/flowing ELT-side data objects.
- Keep ingestion/staging, transform, dataset, and lineage vocabulary explicit and typed.

## Public Surface Discipline

- Import contracts from family barrels (`modules/contracts/<family>`), not deep
  internal files.
- The root contracts entry (`modules/contracts`) exposes family namespaces only
  so boundaries stay explicit instead of flattened.
