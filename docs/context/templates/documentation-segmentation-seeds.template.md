# Documentation Segmentation Seed Templates

Use these blocks as copy/paste starters during migration and classification work.

## Classification Note Template

```markdown
## Classification Note

Source path: `docs/<path>.md`
Primary segment: <Active Guidance|Baselines|Historical Notes|Migration Guides and Records|Rollout-Boundary Notes|Temporary Transition Documents|Superseded or Deprecated Documents>
Current authority state: <canonical|reference|supplemental|historical>
Decision summary: <one sentence>
Canonical destination (if changed): `docs/<destination>.md`
```

## Supersession Marker Template

```markdown
## Supersession Notice

This document is superseded and is not authoritative for current implementation or operations.

Effective date: YYYY-MM-DD.
Reason: <one sentence>.
Canonical source: `docs/<replacement-path>.md`
Retention/removal trigger: <remove once inbound links are migrated>
```

For multi-destination replacements, use `Canonical destinations:` and list each destination.

## Baseline Introduction Template

```markdown
## Baseline Introduction

Snapshot date: YYYY-MM-DD
Snapshot scope: <feature/epic/story/system area>
Why this baseline exists: <one sentence>
Current canonical guidance: `docs/<active-path>.md`
Historical handling note: This file preserves historical evidence and is non-authoritative for new implementation work.
```

## Migration Decision Checklist Template

```markdown
## Migration Decision Checklist

- [ ] Segment category selected using `docs/context/documentation-segmentation-taxonomy.md`.
- [ ] Metadata updated (`status`, `authoritativeness`, and `superseded_by` when applicable).
- [ ] Baseline destination chosen using `docs/context/documentation-baseline-and-historical-folder-strategy.md` when history is retained.
- [ ] Supersession marker follows `docs/context/documentation-supersession-and-redirect-conventions.md`.
- [ ] Canonical destination links and router links updated in the same change.
- [ ] `.md` and `.ai.md` companion docs remain aligned.
```
