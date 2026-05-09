# Context Pack: Testing

- Pack name: `testing`

## Purpose

- Provide focused testing expectations that protect behavior and architecture without low-value test bloat.

## Use When

- Implementation tasks with meaningful behavior changes.
- Bug-fix tasks.
- Refactors that risk behavior drift.
- Adapter/host/runtime/transport changes needing targeted integration confidence.

## Do Not Use When

- Tasks that cannot affect runtime behavior (for example pure wording-only docs edits).
- Requests limited to architecture discussion with no code/test impact.

## Core Guidance

- Test meaningful behavior, not implementation trivia.
- Treat Node's built-in test runner (`node:test`) as the canonical default for non-browser tests.
- Use root `npm test` / `npm run test:non-browser` as the canonical non-browser execution path.
- Test domain logic directly with unit-level isolation.
- Test application use cases with controlled boundaries (ports/test doubles).
- Give adapters focused integration coverage for real boundary translation/behavior.
- Add targeted host/transport integration tests for wiring, composition, and delegation correctness.
- Add cross-family contract invariant tests (in `tests` folders) for major contract systems where drift risk is high.
  Focus these on boundary relationships such as transport/API/IPC specialization, runtime/logging alignment, and persistence/storage separation.
- Place contract invariants predictably: family tests in `modules/contracts/<family>/tests` and cross-family anti-drift tests in `modules/contracts/tests`.
- For application seam families with drift risk (for example logging ports), keep narrow anti-drift tests in `modules/application/ports/<family>/tests`.
- For application seams that drift across families, keep a minimal cross-family invariant layer in `modules/application/ports/tests`.
- Keep application-port anti-drift tests inside `tests` folders only; avoid ad hoc placement that hides seam guarantees.
- Resource-backed Asset Registry provider seam tests belong under `modules/application/ports/asset/tests`, while aggregate provider behavior belongs under `modules/application/services/asset/tests`; cover structured diagnostics, no-provider/unsupported behavior, sanitized partial failures, bounded limits, and no outer-layer dependencies.
- Concrete artifact/document resource-backed provider tests belong under `modules/application/services/asset/tests`; cover metadata-only mapping, document-like detection, storage-path/secret/raw/blob/base64 omission, safe filters/limits/cursor diagnostics, aggregate/facade composition, no content reads, no storage scans, and no asset-instance or durable-mapping creation.
- Concrete image/generated-output resource-backed provider tests belong under `modules/application/services/asset/tests`; cover descriptor-only finalized image mapping when a safe seam is injected, safe unsupported diagnostics when missing, injected already-known generated outputs, unfinalized/unregistered labeling, prompt/raw workflow/blob/base64/path/secret omission, safe filters/limits/cursor diagnostics, aggregate/facade composition, no bytes/previews/storage scans, no runtime task reads, no generation/finalization calls, and no asset-instance or durable-mapping creation.
- Phase 3 Review A tests should also prove direct descriptor detail reads are used when safe image/generated-output read seams are available, list-fallback detail reads are bounded and diagnosed when direct lookup is unavailable, aggregate provider routing avoids unnecessary fan-out after safe ownership is known, cursor limitations are diagnostic rather than silent, and provider/facade output omits request/task ids, prompts, workflow payloads, paths/storage keys, raw payloads, bytes/blob/base64/data URLs, secrets/auth values, command lines, and stack traces.
- Concrete dataset/model resource-backed provider tests belong under `modules/application/services/asset/tests`; cover injected safe dataset descriptors, unsupported missing dataset seams, persisted model inventory mapping through `includeDiscovered: false`, no local/Hugging Face cache discovery, no dataset preparation/file reads/storage scans, no model validation/training/publishing/loading, safe filters/limits/cursor diagnostics, aggregate/facade composition, sanitized paths/raw/logs/bytes/secrets/request ids, and no asset-instance or durable-mapping creation.
- Concrete external repository object resource-backed provider tests belong under `modules/application/services/asset/tests`; cover injected already-known descriptors, Hugging Face-style and artifact-repo metadata without provider calls, optional storage binding/model publishing metadata only when already persisted, safe unsupported diagnostics when no descriptor seam is wired, safe filters/limits/cursor diagnostics, aggregate/facade composition, sanitized auth/signed URL/path/raw/bytes/object-content fields, and no browse/list/retrieve/store/localize/publish/token/cache/runtime/file reads, asset-instance creation, or durable-mapping persistence.
- Phase 3 Review B tests should cover all implemented resource-backed families together, deterministic provider and item ordering, bounded aggregate limits, duplicate public view ID diagnostics with first-provider-wins behavior, deterministic aggregate detail reads, descriptor-only `local`/`http`/`custom` external provider labels, omitted repository object paths, provider-local descriptor-source seams, and non-exposure/import-boundary checks for every family provider.
- Phase 3 Prompt 7 host composition tests should verify the shared provider helper is side-effect free during construction, desktop/server pass a provider aggregate into `composeInternalAssetRegistry`, runtime roots are not used for Asset Kernel records or provider reads, unavailable safe seams return sanitized diagnostics, and host registration does not call source list/read methods, scans, provider/network clients, runtimes, or byte/content readers. The final Phase 3 cleanup allows only read-only resource-backed public route/channel additions.
- Phase 3 Prompt 8 regression should sweep provider port/family/aggregate/facade tests, host composition tests, API/IPC/preload/UI read-only tests, and non-exposure/import-boundary tests. Stabilization fixes should stay limited to Phase 3 provider/read-surface regressions and docs/context alignment; do not add mutation behavior to make tests pass.
- Phase 4 Prompt 2 controlled mutation contract tests belong under `modules/contracts/asset/tests`; cover the narrow operation union, no arbitrary editor/create/update/delete/patch operations, serializable command/result/failure fixtures, required approval/actor/context fields, safe source identity/deduplication, sanitized provenance/failure/result shapes, command-specific payload limits, unsafe fixture omission, and no imports from adapters/hosts/API/IPC/preload/UI/runtime/storage/persistence/provider clients. If later prompts add application skeletons, use-case boundary tests should prove they return safe unavailable results and do not write repositories or call providers/storage/runtime/external clients.
- Phase 4 Prompt 3 registration tests should cover eligible artifact/document, finalized image, dataset, and persisted model views; missing/deferred/unsupported views; approval/access-flag guards; target-definition validation and safe built-in inference; duplicate source identity handling; validation-before-save; sanitized source identity/provenance/metadata/failures; and boundary checks proving no public transport/UI/host/runtime/storage/provider exposure.
- Phase 4 Prompt 4 finalization tests should cover guard-first ordering with no source/repository/finalization calls on guard failures, generated-output re-read, eligibility rejection for failed/incomplete/cancelled/preview/finalized sources, approval/access-flag guards, target image definition validation and inference, finalization seam invocation, duplicate/idempotent existing results before and after finalization, already-finalized seam results with missing Asset Kernel registration, validation-before-save, required safe instance ID generation, retry-safe partial failure after finalization, sanitization of source identity/provenance/metadata/failures, and boundary checks proving no public transport/UI/host/runtime/storage/provider exposure.
- Phase 4 Prompt 5 import/localization tests should cover guard-first ordering with no source/repository/port calls on guard failures, external-object re-read by id, unsafe/repository-level/preview/unsupported/missing source rejection, approval requirements for network/credential/partial completion and localization filesystem writes, target definition validation/inference, safe port request shape, duplicate checks before and after import/localization, existing durable state retries, validation-before-save, required safe instance ID generation, retry-safe partial failures after durable import/localization, sanitization, and non-exposure boundaries.
- Add regression tests for bug fixes when practical in the layer where defect should be caught.
- For runtime task registry changes, cover start correlation, unknown request ids, delegate recovery, list aggregation/unsupported metadata, cancellation, and no-start behavior on status/list/cancel reads.
- Keep tests deterministic, CI-suitable, and non-flaky; avoid performative coverage-only tests.

## Key Constraints

- Do not use broad end-to-end suites as substitutes for layered testing.
- Avoid over-mocking internal details; mock boundaries deliberately.
- If regression coverage is not added for a bug fix, document clear rationale.

## Canonical Source Docs

- `docs/standards/testing-standards.md` — repository-wide testing strategy and anti-patterns.
- `docs/standards/naming-standards.md` — test file naming and behavior-oriented naming guidance.
- `docs/standards/coding-standards.md` — boundary-safe design that drives test layering.
- `docs/architecture/module-dependency-rules.md` — layer boundaries that testing should reinforce.

## Common Over-Inclusions to Avoid

- Pulling detailed host/runtime packs when not needed for current test scope.
- Requiring exhaustive integration coverage for simple domain-only changes.
- Asserting framework internals instead of observable behavior.

## Prompt Assembly Notes

- Typical set: `index` + `testing`.
- Add one scope-specific pack (`runtime`, `desktop-host`, `server-host`, or `architecture`) based on impacted boundaries.
