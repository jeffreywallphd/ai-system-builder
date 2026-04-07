import {
  createPromptTemplateStudioTaxonomy,
  PromptTemplateStudioIdentity,
} from "@domain/prompt-template-studio/PromptTemplateStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const promptTemplateStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: PromptTemplateStudioIdentity.studioType,
  studioId: PromptTemplateStudioIdentity.defaultStudioId,
  kind: "atomic",
  displayName: PromptTemplateStudioIdentity.defaultStudioName,
  role: "prompt-template",
  allowedBehaviorKinds: Object.freeze(["none"]),
  defaults: {
    title: "Prompt Template Asset Draft",
    tags: Object.freeze(["prompt-template", "studio-shell"]),
    contentTemplate: JSON.stringify(
      {
        promptTemplateSpec: {
          format: "mustache",
          template: "You are a helpful assistant for {{audience}}.",
          variables: ["audience"],
        },
      },
      null,
      2,
    ),
    metadataPatch: createAtomicStudioMetadataPatch({
      title: "Prompt Template Asset Draft",
      tags: ["prompt-template", "studio-shell"],
      summary: "Atomic prompt-template asset drafted through Prompt Template Studio.",
      taxonomy: createPromptTemplateStudioTaxonomy(),
      sourceLabel: PromptTemplateStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "prompt-template-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Prompt template draft guidance",
      subtitle: "Author reusable template structure/version as atomic assets; execution remains behavior metadata.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Keep prompt template authoring atomic: template identity/version in assets, execution patterns in behaviors.",
        "Asset role: prompt-template (atomic)",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
  ]),
});

