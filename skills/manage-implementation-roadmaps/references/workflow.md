# Implementation roadmap workflow

## Invariants

- Repository instructions and implemented behavior remain authoritative.
- The user approves high-level product or architecture options and the roadmap.
- A request to draft, inspect, research, or review is not implementation approval.
- Implementation proceeds in ordered increments. Each increment is researched and
  planned immediately before its code changes.
- Durable repository artifacts supplement conversation state; they do not replace
  user communication.
- Evidence describes what actually ran. Pending, skipped, and controlled-environment
  checks remain visibly distinct from passes.
- The state engine records workflow facts but never runs implementation or test
  commands.

## Artifact model

Maintain three repository-relative files:

1. A Markdown roadmap for approved intent, increment definitions, acceptance
   criteria, verification, rollback, and exclusions.
2. A Markdown implementation report for current status, completed chunks, feedback,
   evidence, blockers, resume audits, and the next checkpoint.
3. A JSON state file as the canonical input for deterministic rendering.

The engine adds a generated notice to both Markdown files. Do not edit them directly.
Use an event to change state. Use `render` only to repair drift or finish an
interrupted multi-file write after reviewing the difference.

## Preparation loop

### 1. Discover

Inspect:

- all uncommitted changes and current branch status;
- repository and area-level agent instructions;
- the repository and documentation entry points;
- affected code, tests, adapters, hosts, and user interfaces;
- accepted architecture decisions and explicit open decisions;
- relevant issue, review, CI, and prior roadmap evidence supplied by the user;
- primary external sources when behavior is current, specialized, or high risk.

Record summaries and source links, not raw retrieved content. Make code/documentation
conflicts visible under repository policy.

### 2. Decide

A high-level decision is one whose alternatives materially change architecture,
public behavior, persisted data, migration, compatibility, security boundaries,
operational ownership, scope, or roadmap shape.

Present two or three options. Exactly one must be recommended. For each option state:

- the outcome;
- tradeoffs;
- foreseeable consequences;
- why the recommendation best fits the discovered constraints.

Wait for a real user response. If the response modifies an option, update the
proposal and ask again rather than recording an approval for stale text.

### 3. Define increments

Use the smallest independently useful and verifiable vertical slices. Every
increment contains:

- a stable id and contiguous number;
- objective and dependencies;
- work packages and deliverables;
- acceptance criteria with local or controlled-environment qualification;
- verification methods;
- rollback strategy;
- explicit exclusions.

Dependencies may point only to earlier increments. Make deferred work and external
qualification visible.

### 4. Obtain roadmap approval

Present the full roadmap with its recommendation and important assumptions. Wait for
explicit approval before recording the approval event or editing implementation
code. Approval is fingerprinted; changed decisions or increment definitions require
new approval.

## Per-increment execution loop

### 1. Reconcile

Before starting or resuming an increment:

- inspect the current worktree;
- compare existing changes with the approved intent;
- check outstanding feedback, failures, and blockers;
- verify the roadmap approval is current;
- run narrow diagnostics needed to establish the baseline.

Do not delete or rewrite unrelated work. If reconciliation requires new scope or a
high-level choice, record feedback, invalidate approval, and ask the user.

### 2. Research

Research the specific increment even when roadmap-level research exists. Inspect the
nearest implementation, tests, documentation, contracts, boundaries, and current
primary sources. Record conclusions, risks, and links. Research must precede the
increment plan.

### 3. Plan

Write an implementation plan with:

- ordered steps;
- coherent work chunks;
- acceptance criteria covered by each chunk;
- narrow and repository-level tests;
- documentation updates;
- assumptions;
- rollback.

Every criterion belongs to at least one chunk. A chunk should be reviewable and
produce an observable outcome, commonly a contract/use-case slice, adapter/host
slice, UI slice, migration slice, or verification/documentation slice. Do not make
each file its own chunk.

### 4. Implement and report

After a coherent chunk:

1. Run its narrow checks.
2. Record files or areas changed, tests, documentation, and feedback addressed.
3. Update state so the Markdown report is regenerated.
4. Give the user a clickable report link and a concise outcome/update.

Reasonable report checkpoints include completion of a vertical slice, a resolved
defect, a host integration, a significant UI outcome, or a gate/review boundary.

### 5. Verify and complete

Record evidence separately for each acceptance criterion. The latest evidence is
authoritative. A controlled-environment criterion may remain pending only when the
increment explicitly permits it; the increment then becomes
`implemented-pending-qualification`, not complete. Later passing evidence promotes
it to complete.

An increment closes only when every planned chunk is recorded and every criterion
has passing or explicitly permitted pending evidence. A roadmap closes only when all
criteria, including controlled-environment qualification, pass.

## Feedback loop

Classify each feedback item:

| Category      | Typical handling                                                      |
| ------------- | --------------------------------------------------------------------- |
| clarification | Apply within the increment if approved intent is unchanged.           |
| defect        | Fix in the current or targeted increment and add regression evidence. |
| verification  | Update checks or evidence without rewriting product scope.            |
| environment   | Record a blocker or controlled-environment qualification.             |
| decision      | Stop and obtain a new high-level option approval.                     |
| scope         | Stop, revise or replace the roadmap, and obtain roadmap approval.     |

Record a disposition of accepted, deferred, needs-decision, or blocked plus a
specific next action. A high-level or scope-changing item invalidates roadmap
approval.

## Block and resume loop

Record the exact blocker and required external action. When it clears:

1. Inspect worktree and generated artifact drift.
2. State what changed while work was stopped.
3. Reconcile partial changes against the current plan.
4. Re-check approval fingerprints and unresolved feedback.
5. Record a resume audit and rerun affected baseline checks.
6. Continue at research, planning, implementation, or verification according to the
   last proven state.

Never treat a cleared operating-system or sandbox issue as evidence that product
checks now pass.

## State recovery

- `validate` detects state errors and generated Markdown drift.
- `status` identifies the next checkpoint without changing files.
- `apply --dry-run` validates a proposed event without changing files.
- `render --dry-run` previews whether state can render.
- `render` restores generated Markdown from canonical JSON state.

If a write is interrupted, inspect state and Markdown diffs before choosing the
canonical version. Do not overwrite hand-authored content unless the generated
notice proves the file belongs to this workflow.
