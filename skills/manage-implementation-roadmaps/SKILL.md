---
name: manage-implementation-roadmaps
description: Prepare, review, resume, and execute implementation roadmaps as approval-gated increments with research, high-level options, durable Markdown reports, feedback reconciliation, tests, documentation, and evidence. Use when a user asks for an implementation roadmap; asks to implement, continue, review, or resume roadmap increments; requests a skill for roadmap work without naming one; or wants systematic progress tracking across a long coding task.
---

# Manage Implementation Roadmaps

Use this skill to turn a substantial change into an explicitly approved sequence of
increments and to preserve enough repository state for another contributor or AI to
resume faithfully.

## Start

1. Read the repository agent instructions, root README, documentation entry point,
   current worktree status, affected code, nearest README files, tests, architecture
   decisions, and change-impact guidance before proposing work.
2. Read [workflow.md](references/workflow.md) and
   [events.md](references/events.md) completely.
3. Locate an existing roadmap, report, and state file for the requested work. Resume
   those artifacts when they exist; do not silently create a competing roadmap.
4. Treat user feedback, CI output, interrupted work, and uncommitted changes as
   inputs to reconcile before making new edits.
5. Use the term **increment**. Do not rename increments to phases.

Resolve all script and reference paths from the directory containing this
`SKILL.md`. Do not assume an agent-specific skill environment variable.

## Choose the workflow

- **Prepare** when the user needs options or a new roadmap.
- **Execute** when an approved roadmap exists and implementation is requested.
- **Resume** when work or a prior task stopped, the worktree is dirty, a blocker was
  cleared, or feedback arrived after planning.
- **Review** when the user asks for diagnosis, status, or roadmap quality without
  authorizing implementation. Do not mutate product code during review.

The preparation and execution workflows may occur in one task, but never infer an
approval from a request to draft or inspect a roadmap.

## Prepare a roadmap

1. Research the repository and relevant primary sources. Record a concise discovery
   summary, constraints, and source links; never copy private chat transcripts or
   machine-specific paths into tracked artifacts.
2. Identify decisions that materially affect architecture, scope, compatibility,
   security, data, operations, or user experience.
3. For each high-level decision, present two or three mutually exclusive options.
   Mark exactly one as recommended and explain tradeoffs and consequences.
4. Stop for explicit user approval of the high-level option. Record
   `decision-approved` only after the user actually selects or accepts an option.
5. Define ordered, contiguous increments. Each increment must include dependencies,
   an objective, deliverables, acceptance criteria, verification, rollback, and
   exclusions. Favor independently verifiable vertical slices.
6. Present the complete roadmap and stop for explicit user approval. Record
   `roadmap-approved` only after that approval.

Do not start implementation while an option or roadmap approval is missing or stale.

## Execute each increment

For every approved increment, repeat this loop:

1. Inspect all current uncommitted changes and reconcile them with the roadmap.
2. Start only the next pending increment; do not skip dependencies.
3. Conduct increment-specific repository and primary-source research.
4. Write the increment implementation plan before editing. Map every acceptance
   criterion to at least one coherent work chunk and name tests, documentation,
   assumptions, and rollback.
5. Implement one coherent chunk at a time. A chunk is a reviewable outcome, not an
   individual file write.
6. Add or update tests and documentation with the behavior. Run narrow checks while
   iterating and applicable repository gates before closing the increment.
7. Record chunk completion and update the generated Markdown report. Provide the
   user a clickable report link after each meaningful chunk or natural checkpoint,
   not after every file change.
8. Attach evidence to every acceptance criterion. Distinguish local passes from
   controlled-environment qualification; never describe pending external evidence
   as passed.
9. Complete the increment only when all planned chunks and required evidence are
   accounted for. Then begin research and planning for the next increment.

## Reconcile feedback and interruptions

- Classify feedback as a clarification, defect, scope change, decision, environment
  issue, or verification issue.
- Keep in-scope defects within the current increment when its approved objective is
  unchanged.
- Invalidate approval and stop when feedback changes a high-level decision or scope.
- Record blockers with the action required to clear them.
- On resume, inspect worktree and artifact drift, resolve the blocker, document the
  reconciliation, re-run affected checks, and continue from the last proven state.
- Treat direct edits to generated roadmap or report Markdown as drift. Review the
  diff, update state with a valid event, or restore generated files with `render`.

## Use the state engine

The standard-library Python engine does not execute commands. It validates workflow
events and renders deterministic repository artifacts.

```text
python <skill-root>/scripts/roadmap.py init --repo <repo> --config <config.json>
python <skill-root>/scripts/roadmap.py apply --repo <repo> --state <state.json> --event-file <event.json>
python <skill-root>/scripts/roadmap.py validate --repo <repo> --state <state.json>
python <skill-root>/scripts/roadmap.py status --repo <repo> --state <state.json>
```

Start from [roadmap-config.example.json](assets/roadmap-config.example.json). Keep
the state, roadmap, and report repository-relative and tracked unless repository
policy explicitly requires another location. Use temporary event files and do not
commit secrets, raw private conversations, credentials, or local absolute paths.

## Close

Before claiming completion:

1. Confirm every increment is complete and no controlled-environment evidence is
   pending.
2. Run the applicable repository gates and validate generated artifacts.
3. Reconcile documentation, feedback, blockers, assumptions, and excluded work.
4. Record roadmap completion and provide links to the final roadmap and report.
5. Report commands run, failures, evidence that remains external, and work not done.

Read [installation.md](references/installation.md) when installing or publishing the
skill for Codex, Claude Code, GitHub Copilot, or another Agent Skills-compatible
host.
