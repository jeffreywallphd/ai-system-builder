import {
  createSystemStudioTaxonomy,
  SystemStudioIdentity,
} from "../../../domain/system-studio/SystemAssetDomain";
import { createElement } from "react";
import { SystemCompositionEditor } from "../../components/studio-shell/SystemCompositionEditor";
import { SystemInterfaceEditor } from "../../components/studio-shell/SystemInterfaceEditor";
import { SystemParameterConfigEditor } from "../../components/studio-shell/SystemParameterConfigEditor";
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
      id: "system-studio-structure-editor",
      slot: "draft-authoring",
      title: "System composition canvas / structure editor",
      subtitle: "Bounded, backend-authoritative structure editor for multi-level system composition.",
      order: 8,
      render: (context) => createElement(SystemCompositionEditor, { context }),
    },
    {
      id: "system-studio-interface-editor",
      slot: "draft-authoring",
      title: "System input/output definition",
      subtitle: "First-class authoring for explicit system interfaces (inputs + outputs).",
      order: 9,
      render: (context) => createElement(SystemInterfaceEditor, { context }),
    },
    {
      id: "system-studio-parameter-editor",
      slot: "draft-authoring",
      title: "System parameter/configuration defaults",
      subtitle: "First-class authoring for system parameters and bounded default configuration values.",
      order: 10,
      render: (context) => createElement(SystemParameterConfigEditor, { context }),
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
