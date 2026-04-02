import {
  createSystemStudioTaxonomy,
  SystemStudioIdentity,
} from "../../../domain/system-studio/SystemAssetDomain";
import { createElement } from "react";
import { SystemExecutionMetadataEditor } from "../../components/studio-shell/SystemExecutionMetadataEditor";
import { SystemCompatibilityInsightsPanel } from "../../components/studio-shell/SystemCompatibilityInsightsPanel";
import { SystemRuntimeRunPanel } from "../../components/studio-shell/SystemRuntimeRunPanel";
import { SystemContextDebugPreviewPanel } from "../../components/studio-shell/SystemContextDebugPreviewPanel";
import { ReferenceImageExperiencePanel } from "../../components/studio-shell/ReferenceImageExperiencePanel";
import { SystemStudioWorkManagementPanel } from "../../components/studio-shell/SystemStudioWorkManagementPanel";
import WorkflowTemplateSelectionPanel from "../../components/studio-shell/workflow/WorkflowTemplateSelectionPanel";
import type { SystemStudioRegistration } from "../StudioShellExtensions";
import { createSystemStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";
import { ExperienceSurfaceAssetIds } from "../experience-assets/ExperienceSurfaceAssets";

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
    subtitle: "Compose systems from reusable assets using guided or canvas authoring.",
    experienceAssets: Object.freeze([
      ExperienceSurfaceAssetIds.loomWizard,
      ExperienceSurfaceAssetIds.loomCanvas,
    ]),
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
          pages: [
            {
              pageId: "page-1",
              title: "Main page",
              description: "Start here and shape the main experience.",
              layout: {
                layoutKind: "workspace",
                defaultRegionId: "workspace",
                regionIds: ["workspace"],
              },
              navigation: {
                route: "/",
                title: "Main page",
                supportsDeepLinking: false,
                requiresRuntimeSession: false,
              },
            },
          ],
          canvasAuthoring: {
            designFrame: {
              mode: "bounded-frame",
              ratio: { width: 16, height: 9 },
              dimensions: { width: 1600, height: 900 },
              boundedArea: { padding: 20 },
            },
            pageLayouts: [
              { pageId: "page-1", panels: [] },
            ],
          },
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
      id: "system-studio-template-selection",
      slot: "draft-authoring",
      title: "Starter templates",
      subtitle: "Choose a workflow template and prepare it for your system composition.",
      order: 7,
      render: () => createElement(WorkflowTemplateSelectionPanel, { surface: "system-studio" }),
    },
    {
      id: "system-studio-work-management",
      slot: "lifecycle",
      title: "Save and reopen your work",
      subtitle: "Easy save, open, copy, and rename actions for this system setup.",
      order: 10,
      render: (context) => createElement(SystemStudioWorkManagementPanel, { context }),
    },
    {
      id: "system-studio-reference-image-experience",
      slot: "lifecycle",
      title: "Reference image flow",
      subtitle: "Upload an image, adjust settings, and start processing from one guided panel.",
      order: 11,
      render: (context) => createElement(ReferenceImageExperiencePanel, { context }),
    },
    {
      id: "system-studio-runtime-run-trigger",
      slot: "lifecycle",
      title: "Run and monitor",
      subtitle: "Run the system and monitor progress/results.",
      order: 12,
      render: (context) => createElement(SystemRuntimeRunPanel, { context }),
    },
    {
      id: "system-studio-advanced-setup",
      slot: "lifecycle",
      title: "Advanced setup",
      subtitle: "Optional technical metadata and runtime controls.",
      order: 13,
      render: (context) => createElement(
        "details",
        undefined,
        createElement("summary", { className: "ui-text-small ui-text-secondary" }, "Advanced setup"),
        createElement(
          "div",
          { className: "ui-stack ui-stack--sm", style: { marginTop: "0.5rem" } },
          createElement(SystemExecutionMetadataEditor, { context }),
        ),
      ),
    },
    {
      id: "system-studio-advanced-validation",
      slot: "validation",
      title: "Advanced validation and debug",
      subtitle: "Compatibility, context preview, and diagnostics.",
      order: 12,
      render: (context) => createElement(
        "details",
        undefined,
        createElement("summary", { className: "ui-text-small ui-text-secondary" }, "Advanced validation and debug"),
        createElement(
          "div",
          { className: "ui-stack ui-stack--sm", style: { marginTop: "0.5rem" } },
          createElement(SystemCompatibilityInsightsPanel, { context }),
          createElement(SystemContextDebugPreviewPanel, { context }),
        ),
      ),
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
