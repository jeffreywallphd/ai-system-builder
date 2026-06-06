# API Contracts

> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

API contracts specialize the shared transport core for server-facing API surfaces.

- Build on `modules/contracts/transport` instead of redefining request/response/error semantics.
- Reuse transport response factories and envelope semantics; only API-specific classification is added in this family.
- Keep operation identity and boundary context (`requestId`, `correlationId`) aligned with the shared transport vocabulary.
- Keep HTTP mechanics (status codes, headers, framework objects) out of this layer.

This layer stays intentionally thin so API adapters can map contract outcomes to HTTP details later without making HTTP the center of application contracts.
