> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

- User-facing glossary hints live in `modules/ui/shared/glossary`; add or update entries when introducing novel form-field or detail-label terms.
- Keep glossary hint buttons off broad page headings and descriptive home-area cards. Use them beside form labels, filters, and compact detail rows where users need help understanding what to enter or read.
- Artifact preview UI lives in `modules/ui/shared/artifact-preview`. Keep previews sampled and bounded: text-like previews should show only a small first-page-sized sample, image previews should prefer compressed/downscaled object URLs, video/PDF previews should be visually constrained, and full-fidelity viewing should remain a download action. Office document and spreadsheet previews should stay placeholder-only until a safe parser is added.
- Modal headers should stay fixed at the top of the modal, use a darker header background than the body, place the clear modal title on the left, and place the red square close button on the right. Put scrollable content inside the modal body region so only the body scrolls when needed. When one modal opens from another, use the stacked modal overlay class so the newest modal is visually on top.
- Asset package import UI lives in `modules/ui/shared/asset-package`. Keep file reading in the surface client, package parsing and trust decisions behind application use cases, require exact capability consent, and reuse the shared ordered-workflow surface in desktop and thin clients.
- Functional system-default previews live in `modules/ui/shared/foundation-assets`.
  They consume the closed data-only functional catalog, remain side-effect
  free, and never accept definition-provided components or source.
- The shared System Builder editor lives in `modules/ui/shared/system-builder`.
  Keep system records and immutable revision state behind its client interface;
  both desktop and thin-client surfaces must use the same catalog, composition,
  inspector, validation, and history semantics. Native labeled controls and
  explicit buttons are the required keyboard path; drag-and-drop may only be a
  later enhancement.
- The shared System Builder Build & Release workflow lives beside the editor in
  `modules/ui/shared/system-builder`. Keep exact revision selection, deployment
  profile, build diagnostics/evidence, approval, immutable release history, and
  comparison semantics in this shared presenter. Host clients may translate
  transport envelopes only; they must not generate releases or bypass artifact
  verification in the renderer.
- The shared `SystemDataRunTest` presenter consumes only an approved release
  descriptor and narrow CRUD/audit client. It renders native labeled controls,
  summary plus field errors, bounded lists, explicit masked values, optimistic
  conflicts, and safe audit evidence identically in desktop and thin client.
  Authorization, schema validation, masking, and audit decisions remain in the
  trusted application layer.
- The shared `ConversationRunTest` presenter consumes actual execution-plan
  summaries plus the controlled conversation client. Keep execution-plan
  identity intact, use application-projected actions/availability, bound
  message and transcript rendering, preserve the accessible live log, and show
  unsupported capabilities truthfully. It must not accept composition-plan ids,
  expose protected instruction/provider payloads, or call a provider directly.
