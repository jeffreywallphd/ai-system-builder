> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

- User-facing glossary hints live in `modules/ui/shared/glossary`; add or update entries when introducing novel form-field or detail-label terms.
- Keep glossary hint buttons off broad page headings and descriptive home-area cards. Use them beside form labels, filters, and compact detail rows where users need help understanding what to enter or read.
- Artifact preview UI lives in `modules/ui/shared/artifact-preview`. Keep previews sampled and bounded: text-like previews should show only a small first-page-sized sample, image previews should prefer compressed/downscaled object URLs, video/PDF previews should be visually constrained, and full-fidelity viewing should remain a download action. Office document and spreadsheet previews should stay placeholder-only until a safe parser is added.
- Modal headers should stay fixed at the top of the modal, use a darker header background than the body, place the clear modal title on the left, and place the red square close button on the right. Put scrollable content inside the modal body region so only the body scrolls when needed. When one modal opens from another, use the stacked modal overlay class so the newest modal is visually on top.
- Asset package import UI lives in `modules/ui/shared/asset-package`. Keep file reading in the surface client, package parsing and trust decisions behind application use cases, require exact capability consent, and reuse the shared ordered-workflow surface in desktop and thin clients.
- Functional system-default previews live in `modules/ui/shared/foundation-assets`.
  They consume the closed data-only functional catalog, remain side-effect
  free, and never accept definition-provided components or source.
