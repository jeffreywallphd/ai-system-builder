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
- Operational precheck messaging must keep setup-vs-backend causes separate:
  - setup blockers = user configuration/image selection actions,
  - backend blockers = readiness/node availability conditions from authoritative APIs.
- Backend messaging must distinguish:
  - no eligible node,
  - temporary backend outage/unavailable state,
  - degraded but runnable backend,
  - unknown/unchecked readiness.
- Operational copy should include:
  - short status summary,
  - likely temporary flag when applicable,
  - immediate next action (`wait`, `refresh`, `retry later`, or `adjust setup`).
- Preview-delay issues should be framed as operational delay (results may persist before preview service catches up).

## UI pattern rules
- Loading notices should expose `aria-busy` and clear status text.
- Keep warnings visible when backend is degraded or constrained.
- Do not hide advisory uncertainty under success framing.
- Keep primary copy non-technical; place codes/counts/reason details in optional advanced details.
- Avoid UI-local outage guessing: use readiness issues, readiness state, and node-availability reason codes from authoritative contracts.

## Definition of done for this convention
- Users can tell what the system is doing now.
- Users can tell whether they should wait, retry, or adjust setup.
- The UI does not overstate completion before authoritative persistence and refresh finish.
