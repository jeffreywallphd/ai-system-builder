import {
  ConfigProfileStudioIdentity,
  createConfigProfileStudioTaxonomy,
} from "../../../domain/config-profile-studio/ConfigProfileStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const configProfileStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: ConfigProfileStudioIdentity.studioType,
  studioId: ConfigProfileStudioIdentity.defaultStudioId,
  kind: "atomic",
  displayName: ConfigProfileStudioIdentity.defaultStudioName,
  role: "config-profile",
  allowedBehaviorKinds: Object.freeze(["none"]),
  defaults: {
    title: "Config Profile Asset Draft",
    tags: Object.freeze(["config-profile", "studio-shell", "runtime"]),
    contentTemplate: JSON.stringify(
      {
        runtimeProfile: {
          preferredRuntime: "python",
          executionPolicy: "acyclic-only",
          environment: {
            mode: "local",
            timeoutMs: 120000,
          },
        },
      },
      null,
      2,
    ),
    metadataPatch: createAtomicStudioMetadataPatch({
      title: "Config Profile Asset Draft",
      tags: ["config-profile", "studio-shell", "runtime"],
      summary: "Atomic config-profile asset drafted through Config Profile Studio.",
      taxonomy: createConfigProfileStudioTaxonomy(),
      sourceLabel: ConfigProfileStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "config-profile-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Config profile draft guidance",
      subtitle: "Author runtime/config bundle identity/version as atomic assets through shared shell flows.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Keep config profile authoring atomic: runtime/config structure and version in assets; execution remains behavior metadata.",
        "Asset role: config-profile (atomic)",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "config-profile-studio-metadata-summary",
      slot: "metadata",
      title: "Config profile taxonomy and contract status",
      subtitle: "Read-only projection of backend-authoritative metadata state.",
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
