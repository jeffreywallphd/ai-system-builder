import { createElement } from "react";
import {
  createEmptyWorkflowDraft,
  createWorkflowStudioTaxonomy,
  serializeWorkflowDraft,
  WorkflowStudioIdentity,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import WorkflowStudioModePanel from "../../components/studio-shell/workflow/WorkflowStudioModePanel";
import type { CompositeStudioRegistration } from "../StudioShellExtensions";
import { createCompositeStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const workflowStudioRegistration: CompositeStudioRegistration = Object.freeze({
  studioType: WorkflowStudioIdentity.studioType,
  studioId: WorkflowStudioIdentity.defaultStudioId,
  kind: "composite",
  displayName: WorkflowStudioIdentity.defaultStudioName,
  role: "workflow",
  allowedBehaviorKinds: Object.freeze(["deterministic", "conditional", "iterative"]),
  shell: Object.freeze({
    title: WorkflowStudioIdentity.defaultStudioName,
    subtitle: "Shared composite shell for workflow orchestrator authoring with backend-authoritative lifecycle, validation, and publish/version flows.",
  }),
  defaults: {
    title: "Workflow Asset Draft",
    tags: Object.freeze(["workflow", "studio-shell", "composite", "orchestrator"]),
    contentTemplate: serializeWorkflowDraft(createEmptyWorkflowDraft()),
    metadataPatch: createCompositeStudioMetadataPatch({
      title: "Workflow Asset Draft",
      tags: ["workflow", "studio-shell", "composite", "orchestrator"],
      summary: "Composite workflow orchestrator asset drafted through Workflow Studio.",
      taxonomy: createWorkflowStudioTaxonomy("deterministic"),
      sourceLabel: WorkflowStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "workflow-studio-mode-abstraction",
      slot: "draft-authoring",
      title: "Workflow mode abstraction",
      subtitle: "Wizard and canvas modes are registered authoring modes over one shared canonical workflow draft state.",
      order: 5,
      render: ({ workflowModeState }) => (workflowModeState
        ? createElement(WorkflowStudioModePanel, { workflowModeState })
        : "Workflow mode state is unavailable for this studio session."),
    },
    {
      id: "workflow-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Workflow draft guidance",
      subtitle: "Author orchestrator structure as a composite asset while keeping execution behavior in taxonomy metadata.",
      order: 10,
      render: ({ snapshot, workflowModeState }) => Object.freeze([
        "Workflow assets are specialized composite orchestrators: structure/version in assets, execution patterns in behavior metadata.",
        "Canonical draft sections: triggers, inputs, steps, outputs.",
        "Allowed behavior kinds: deterministic, conditional, iterative.",
        `Selected mode: ${workflowModeState?.state.selectedModeId ?? "canvas"}`,
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "workflow-studio-metadata-summary",
      slot: "metadata",
      title: "Workflow taxonomy and contract status",
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
