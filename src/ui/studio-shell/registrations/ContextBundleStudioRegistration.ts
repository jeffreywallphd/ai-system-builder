import { createContextBundleStudioTaxonomy, ContextBundleStudioIdentity } from "../../../domain/context-bundle-studio/ContextBundleStudioDomain";
import type { CompositeStudioRegistration } from "../StudioShellExtensions";
import { createCompositeStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const contextBundleStudioRegistration: CompositeStudioRegistration = Object.freeze({
  studioType: ContextBundleStudioIdentity.studioType,
  studioId: ContextBundleStudioIdentity.defaultStudioId,
  kind: "composite",
  displayName: ContextBundleStudioIdentity.defaultStudioName,
  role: "context-bundle",
  allowedBehaviorKinds: Object.freeze(["none", "deterministic"]),
  shell: Object.freeze({
    title: ContextBundleStudioIdentity.defaultStudioName,
    subtitle: "Shared composite shell for context input-preparer authoring with backend-authoritative lifecycle, validation, and publish/version flows.",
  }),
  defaults: {
    title: "Context Bundle Asset Draft",
    tags: Object.freeze(["context-bundle", "studio-shell", "composite", "input-preparer", "context-package", "context-recipe"]),
    contentTemplate: JSON.stringify(
      {
        contextBundleSpec: {
          packageRefs: [],
          recipeRefs: [],
          assemblyPolicy: "merge",
          retrievalPolicy: {
            mode: "bounded",
            maxTokens: 4096,
          },
        },
      },
      null,
      2,
    ),
    metadataPatch: createCompositeStudioMetadataPatch({
      title: "Context Bundle Asset Draft",
      tags: ["context-bundle", "studio-shell", "composite", "input-preparer", "context-package", "context-recipe"],
      summary: "Composite context-bundle input preparer asset drafted through Context Bundle Studio.",
      taxonomy: createContextBundleStudioTaxonomy("none"),
      sourceLabel: ContextBundleStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "context-bundle-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Context bundle draft guidance",
      subtitle: "Author reusable context package/recipe assembly as a composite input-preparer asset.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Context Bundle assets are specialized composite input preparers: bundle structure/version in the asset, execution semantics in behavior metadata.",
        "Allowed behavior kinds: none (package-style), deterministic (recipe-style).",
        "Reuse existing context package, context recipe, and retrieval assembly vocabulary in your draft payloads.",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
  ]),
});
