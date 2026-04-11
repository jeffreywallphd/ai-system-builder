# AI Companion: Documentation Top-Level Contract (Story 1.1.2)

Use this file to route new docs into stable top-level folders.

## Required folder contract
- `docs/architecture/`: canonical architecture contracts and system design baselines.
- `docs/contributors/`: contributor extension guides and implementation workflow guardrails.
- `docs/operations/`: runtime/admin runbooks, diagnostics, and troubleshooting procedures.
- `docs/baselines/`: historical baseline artifacts, migration inventories, and completion snapshots.
- `docs/adr/`: architecture decision records and supersession history.
- `docs/context/`: shared taxonomy/context references for cross-domain understanding.
- `docs/prompts/`: prompt templates and prompt engineering helpers.
- `docs/ui/`: UI behavior and UX contract documentation.

## Routing expectations
- Every top-level folder must retain a router README with explicit `Purpose`, `Belongs here`, and `Does not belong here` sections.
- Place each new doc by primary role; use links instead of duplicating authority across folders.

## Guardrails
- Folder contract test: `dev/tests/DocsTopLevelContractGuardrails.test.ts`.
- Inventory parity test: `dev/tests/DocumentationMigrationBaselineGuardrails.test.ts`.
