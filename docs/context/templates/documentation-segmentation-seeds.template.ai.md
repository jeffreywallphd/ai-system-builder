# AI Companion: Documentation Segmentation Seed Templates

Copy these snippets for fast migration/classification decisions.

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
Retention/removal trigger: <remove after inbound-link migration is complete>
```

For split replacements, use `Canonical destinations:` and list each canonical path.

## Baseline Introduction Template

```markdown
## Baseline Introduction

Snapshot date: YYYY-MM-DD
Snapshot scope: <feature/epic/story/system area>
Why this baseline exists: <one sentence>
Current canonical guidance: `docs/<active-path>.md`
Historical handling note: Historical evidence only; not authoritative for new implementation decisions.
```

## Migration Decision Checklist Template

```markdown
## Migration Decision Checklist

- [ ] Segment selected from `docs/context/documentation-segmentation-taxonomy.ai.md`.
- [ ] Metadata updated (`status`, `authoritativeness`, `superseded_by` when needed).
- [ ] Baseline target selected from `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`.
- [ ] Supersession marker follows `docs/context/documentation-supersession-and-redirect-conventions.ai.md`.
- [ ] Canonical destination and routers updated in same change.
- [ ] Human and AI companion docs kept aligned.
```
