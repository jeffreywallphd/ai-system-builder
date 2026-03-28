# Codex Prompt: Harden Python Runtime Provisioning Against Corrupted `.venv` / `pip`

Work in the GitHub repository `jeffreywallphd-ai/ai-loom-studio`.

## Required prep (read before coding)
Before making any changes, review and follow:
- `docs/general-prompt-guidance.md`
- `docs/architecture/README.ai.md` (and referenced architecture docs)
- `docs/architecture/desktop-runtime-and-hosts.ai.md`
- `docs/architecture/layers-and-boundaries.ai.md`
- any other relevant runtime/provisioning/truthfulness docs in `docs/` (including `.ai.md` variants)

Adhere to the current architecture and naming patterns in the repo. Keep changes small, explicit, and behavior-driven.

## Problem to fix
In development, the managed Python environment can become internally corrupted (example failure):

`ModuleNotFoundError: No module named 'pip._internal.cli.main'`

Today, an existing `.venv` can be treated as healthy too early, and provisioning can fail unclearly when `pip` is present but broken.

## Architectural constraints (must preserve)
- Keep the existing desktop/runtime direction intact:
  - Development: managed, disposable local `.venv`
  - Packaged desktop production: private/bundled runtime direction remains unchanged
- Preserve supervisor ownership of provisioning lifecycle; do not scatter provisioning across unrelated layers.
- Preserve truthfulness: never report runtime/provisioning healthy when environment integrity checks fail.
- Avoid broad refactors or speculative abstractions.

## Implementation scope
Primary target:
- `infrastructure/runtime/service-supervisor.js`

Secondary likely touchpoints:
- `infrastructure/runtime/tests/ServiceSupervisor.test.ts`
- `README.md`
- relevant docs in `docs/` (and matching `.ai.md` files if applicable)

## Required behavior changes
1. **Add explicit venv/pip integrity checks before pip usage.**
   - Validate venv interpreter existence.
   - Add concrete pip integrity validation (import/use check), not only file existence.
   - A `.venv` with broken pip must be classified as unhealthy/corrupted.

2. **Add bounded repair flow before full recreation.**
   - If pip integrity check fails in an existing venv:
     - attempt standard-library bootstrap repair (`ensurepip --upgrade`)
     - revalidate pip integrity
   - If still unhealthy, mark environment as corrupted/needs recreation and recreate deterministically inside existing supervisor lifecycle where appropriate.

3. **Keep recreation deterministic.**
   - Rebuild using resolved compatible interpreter + `python-runtime/requirements.txt`.
   - Keep all steps explicit in supervisor logs/diagnostics.

4. **Improve provisioning metadata with minimal fingerprinting.**
   - Extend existing metadata in a minimal way to detect stale/mismatched environments.
   - Include lightweight signals such as requirements fingerprint + env schema/fingerprint version + platform/arch as appropriate.
   - Use this to set `needsReprovision` truthfully when inputs drift.

5. **Improve structured diagnostics categories/messages.**
   - Clearly distinguish at least:
     - unprovisioned
     - provisioning
     - provision-failed
     - corrupted environment / broken pip
     - needs reprovision/version mismatch
   - Ensure status surfaces and detail text communicate what happened and what action is needed.

6. **Ensure recovery from the exact reported failure mode.**
   - `pip` package can exist but be internally broken.
   - System should repair or recreate without requiring manual deletion of `.venv`.

## Testing requirements
Add/update targeted tests (prefer behavior contracts over implementation details), including:
- healthy existing venv path
- broken pip path that triggers bounded repair attempt
- unrecoverable path that triggers deterministic recreate (or explicit failed state where architecture expects)
- fingerprint/metadata drift path that sets reprovision signals correctly (if added)

Run the smallest relevant tests first, then broader runtime-related tests if needed. At minimum, run updated `ServiceSupervisor` tests.

## Documentation requirements
Update docs to reflect truthful provisioning/repair behavior in development mode while preserving production runtime positioning. Keep related `.md` and `.ai.md` docs aligned where applicable.

## Deliverables
1. Code changes
2. Tests
3. Docs

At the end of your implementation response, include a concise self-review:
1. Core work completed
2. Whether architecture/conventions were preserved
3. Remaining risks/gaps
4. Prioritized next improvements
