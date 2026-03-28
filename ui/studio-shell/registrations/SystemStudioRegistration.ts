import {
  createSystemStudioTaxonomy,
  SystemStudioIdentity,
} from "../../../domain/system-studio/SystemAssetDomain";
import type { SystemStudioRegistration } from "../StudioShellExtensions";
import { createSystemStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const systemStudioRegistration: SystemStudioRegistration = Object.freeze({
  studioType: SystemStudioIdentity.studioType,
  studioId: SystemStudioIdentity.defaultStudioId,
  kind: "system",
  displayName: SystemStudioIdentity.defaultStudioName,
  role: "system",
  allowedBehaviorKinds: Object.freeze(["deterministic", "conditional", "iterative", "autonomous"]),
  compositionCapabilities: Object.freeze({
    supportsAtomicAssets: true,
    supportsCompositeAssets: true,
    supportsSystemAssets: true,
    supportsNestedSystemAssets: true,
  }),
  shell: Object.freeze({
    title: SystemStudioIdentity.defaultStudioName,
    subtitle: "Shared system shell for full AI system/app-template composition with backend-authoritative lifecycle, validation, and publish/version flows.",
  }),
  defaults: {
    title: "System Asset Draft",
    tags: Object.freeze(["system", "studio-shell", "system-composition"]),
    contentTemplate: JSON.stringify(
      {
        systemSpec: {
          semanticRole: "system",
          components: [],
          nestedSystems: [],
          dependencies: [],
          bindings: [],
          notes: "System assets may compose atomic, composite, and other system assets.",
        },
      },
      null,
      2,
    ),
    metadataPatch: createSystemStudioMetadataPatch({
      title: "System Asset Draft",
      tags: ["system", "studio-shell", "system-composition"],
      summary: "System-level composition asset drafted through System Studio.",
      taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
      sourceLabel: SystemStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "system-studio-draft-guidance",
      slot: "draft-authoring",
      title: "System draft guidance",
      subtitle: "Compose system-level structures while preserving identity/version as assets and behavior as taxonomy metadata.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "System assets are top-level compositions and may include atomic assets, composite assets, and nested system assets.",
        "Keep recursive composition explicit with version-pinned dependencies for publish-ready lineage.",
        "Do not collapse system semantics into composite-only roles; use system/app-template taxonomy roles.",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "system-studio-composition-capabilities",
      slot: "dependencies",
      title: "System composition capabilities",
      subtitle: "Registration metadata truth for system-of-systems composition scope.",
      order: 15,
      render: () => Object.freeze([
        "Supports atomic dependencies: yes",
        "Supports composite dependencies: yes",
        "Supports system dependencies: yes",
        "Supports nested system composition: yes",
      ]),
    },
    {
      id: "system-studio-metadata-summary",
      slot: "metadata",
      title: "System taxonomy and contract status",
      subtitle: "Read-only taxonomy/contract/provenance projection from backend-authoritative draft metadata.",
      order: 20,
      render: ({ snapshot }) => {
        const taxonomy = snapshot?.draft?.metadata.taxonomy;
        return Object.freeze([
          `Taxonomy: ${taxonomy
            ? `${taxonomy.structuralKind}/${taxonomy.semanticRole}/${taxonomy.behaviorKind}`
            : "missing"}`,
          `Contract: ${snapshot?.draft?.metadata.contract ? "present" : "missing"}`,
          `Provenance source: ${snapshot?.draft?.metadata.provenance?.sourceLabel ?? "-"}`,
        ]);
      },
    },
  ]),
});
