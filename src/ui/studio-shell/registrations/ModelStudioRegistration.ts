import { createModelStudioTaxonomy, ModelStudioIdentity } from "../../../src/domain/model-studio/ModelStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const modelStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: ModelStudioIdentity.studioType,
  studioId: ModelStudioIdentity.defaultStudioId,
  kind: "atomic",
  displayName: ModelStudioIdentity.defaultStudioName,
  role: "model",
  allowedBehaviorKinds: Object.freeze(["none"]),
  defaults: {
    title: "Model Asset Draft",
    tags: Object.freeze(["model", "studio-shell"]),
    contentTemplate: JSON.stringify({ modelSpec: { provider: "", modelId: "", parameters: {} } }, null, 2),
    metadataPatch: createAtomicStudioMetadataPatch({
      title: "Model Asset Draft",
      tags: ["model", "studio-shell"],
      summary: "Atomic model asset drafted through Model Studio.",
      taxonomy: createModelStudioTaxonomy(),
      sourceLabel: ModelStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "model-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Model draft guidance",
      subtitle: "Bounded model-specific authoring hints layered over the shared shell flow.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        `Keep model authoring atomic: identity/version in assets, execution patterns in behavior metadata.`,
        `Asset role: model (atomic)`,
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
  ]),
});
