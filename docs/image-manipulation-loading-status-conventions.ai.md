# AI Companion Note: Image Manipulation Loading and Status Conventions

Use this as the implementation contract for operational UX feedback in the image manipulation runtime editor.

## Required behavior
- Use authoritative state for lifecycle updates.
- Avoid stagnant generic loading indicators.
- Keep users informed across:
  - asset collection loading,
  - readiness checks,
  - run launch/monitoring,
  - result retrieval,
  - persistence,
  - post-run refresh.

## Messaging rules
- Loading copy must identify the active surface (source/output/reference dataset, preview role, or run phase).
- Transitional run states must be explicit between execution completion and result availability.
- Fallback progress copy must acknowledge uncertainty honestly when node counts are unavailable.

## UI pattern rules
- Loading notices should expose `aria-busy` and clear status text.
- Keep warnings visible when backend is degraded or constrained.
- Do not hide advisory uncertainty under success framing.

## Definition of done for this convention
- Users can tell what the system is doing now.
- Users can tell whether they should wait, retry, or adjust setup.
- The UI does not overstate completion before authoritative persistence and refresh finish.
