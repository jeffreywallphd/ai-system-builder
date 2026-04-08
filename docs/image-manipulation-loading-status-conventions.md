# Image Manipulation Studio Loading and Status Conventions

## Purpose
This note defines UX conventions for operational feedback in the image manipulation runtime editor so users are never left with stagnant, generic waiting states.

## Principles
- Keep status authoritative: do not imply completion before backend state confirms it.
- Prefer specific progress context over generic spinners.
- Show what is happening now and what data surface is being refreshed.
- Keep transitions visible between run launch, monitoring, result retrieval, persistence, and review refresh.

## Implemented conventions
- Contextual loading copy:
  - Preview loading identifies whether source, result, or reference preview is being loaded.
  - Gallery loading identifies the active dataset surface being queried.
  - Collection refresh messages identify which of source/result/reference datasets are currently loading.
- Transitional run messaging:
  - After execution completes, the UI explicitly shows retrieval, persistence, and refresh transitions before final completion.
  - Run progress fallback copy distinguishes queued and early-running states when node-level progress is not yet available.
- Loading-state presentation polish:
  - Status notices support a loading variant (`aria-busy`) with a lightweight animated loading bar.
  - High-frequency operational waits (hydration, readiness checks, run history/image-library loading, review refresh) use loading notices instead of static status blocks.
- Manual refresh clarity:
  - Refresh actions communicate that authoritative run history and output selections are being updated.
- Operational readiness and outage messaging:
  - Launch precheck explicitly separates setup blockers (image/configuration issues) from execution-environment blockers (backend/node operational issues).
  - Backend/node availability copy distinguishes:
    - no eligible node currently routable (`execution-node-no-eligible-match`),
    - temporary backend outage/unavailability,
    - degraded-but-runnable backend state,
    - unknown readiness state when checks have not yet run.
  - Operational summaries include whether the condition is likely temporary and what to do now (wait, refresh readiness, retry later, or adjust configuration).
  - Optional advanced details expose authoritative backend/node reason codes and counts without forcing technical detail into primary UX.
  - Preview-delay scenarios are communicated as operational delay (results may exist while previews are still pending).

## Authoritative boundary
- Completion is only shown after result persistence and post-run refresh complete.
- Degraded and warning states continue to surface backend advisories instead of masking them.
- Outage/degraded/no-eligible-node messaging is derived from authoritative readiness contracts (readiness state, issues, node-availability reason codes), not UI-local inference.
