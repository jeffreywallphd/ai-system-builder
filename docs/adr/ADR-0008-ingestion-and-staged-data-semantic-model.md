# ADR-0008: Ingestion and Staged-Data Semantic Model

- Status: accepted
- Date: 2026-04-16
- Deciders: ai-system-builder maintainers
- Related: docs/architecture/system-overview.md, docs/architecture/persistence-and-storage.md, docs/context/packs/persistence-storage.pack.md

## Context

The current implementation has a working image-upload vertical slice, but the platform direction is broader than image/file upload alone.

Inbound content now spans more than one intake shape:

- user-uploaded content,
- scraped content,
- generated outputs selected for retention,
- API/runtime-driven inbound payloads.

Treating each of these as isolated file operations causes vocabulary and contract drift:

- narrow "upload/file" semantics become overfit to one vertical slice,
- metadata conventions drift between transports and hosts,
- future staged viewing/exploration surfaces lack a shared canonical object model,
- multi-host evolution (desktop/server/hybrid) risks duplicating intake semantics in host- or transport-specific ways.

The repository already separates persistence (records) from storage (artifacts). What is missing is a higher-level semantic contract for inbound staged data that sits above raw storage mechanics while staying transport-neutral.

## Decision

Adopt ingestion/staged-data as the canonical higher-level semantic model for inbound content.

### Direction-setting decisions

- The system moves from isolated upload/file semantics toward a shared ingestion and staged-data model.
- Uploaded, scraped, and selected generated/API/runtime inbound content are modeled as entries into staged data.
- Storage remains a generic capability for artifact bytes and keys, while ingestion contracts define higher-level staged-data semantics.
- Existing image upload remains a specialized intake path and is aligned to the staged-data model.
- Canonical metadata vocabulary for intake outcomes becomes ingestion-centric (source kind + staged descriptor), not image-only.
- Early viewer direction is staged-data inspection (an early data-lake-like surface), not a generic file browser.

### ELT progression posture

This ADR sets semantic direction compatible with future ELT-style progression:

1. intake,
2. raw/staged storage,
3. metadata/cataloging,
4. transformation,
5. viewing/exploration.

This ADR does **not** commit the repository to implementing a full ELT platform immediately.

## Consequences

### Positive

- Contract vocabulary becomes durable across transports (API/IPC) and hosts (desktop/server).
- Image upload remains functional while becoming clearly one intake specialization.
- Future ingestion paths can reuse the same staged-data descriptor semantics, reducing parallel contract families.
- Documentation and context-routing can reference one intake model with minimum-sufficient pack inclusion.

### Negative

- Teams must distinguish ingestion semantics from storage mechanics instead of using "file upload" as a catch-all.
- Some existing image-upload-centric naming remains as a transitional vertical-slice artifact.
- Additional follow-up ADRs may be needed when metadata cataloging, transformation orchestration, or viewer capabilities become implementation priorities.

### Follow-up

- Keep ingestion contracts intentionally small and transport/storage neutral.
- Align specialized intake contracts/results (starting with image upload) to staged-data descriptor semantics.
- Update context packs and architecture docs only where stable semantic guidance changed.
