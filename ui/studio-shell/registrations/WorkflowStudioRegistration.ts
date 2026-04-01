import { createElement } from "react";
import {
  createEmptyWorkflowDraft,
  createWorkflowStudioTaxonomy,
  serializeWorkflowDraft,
  WorkflowStudioIdentity,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import WorkflowStudioModePanel from "../../components/studio-shell/workflow/WorkflowStudioModePanel";
import WorkflowStudioRunHistoryPanel from "../../components/studio-shell/workflow/WorkflowStudioRunHistoryPanel";
import WorkflowTemplateSelectionPanel from "../../components/studio-shell/workflow/WorkflowTemplateSelectionPanel";
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
    drawers: Object.freeze({
      left: Object.freeze({
        label: "Nodes",
        defaultOpen: false,
      }),
      right: Object.freeze({
        label: "Inspector",
        defaultOpen: true,
      }),
    }),
    toolbar: Object.freeze({
      actions: Object.freeze([
        {
          id: "workflow-studio-toolbar-mode-wizard",
          kind: "set-workflow-mode",
          modeId: "wizard",
          label: "Wizard Mode",
          tone: "ghost",
          order: 10,
        },
        {
          id: "workflow-studio-toolbar-mode-canvas",
          kind: "set-workflow-mode",
          modeId: "canvas",
          label: "Canvas Mode",
          tone: "ghost",
          order: 20,
        },
        {
          id: "workflow-studio-toolbar-save",
          kind: "save-draft",
          label: "Save",
          tone: "primary",
          order: 30,
        },
        {
          id: "workflow-studio-toolbar-validate",
          kind: "run-validation",
          label: "Run Validation",
          tone: "default",
          order: 40,
        },
        {
          id: "workflow-studio-toolbar-run-workflow",
          kind: "run-workflow-draft",
          label: "Run Workflow",
          tone: "primary",
          order: 45,
        },
        {
          id: "workflow-studio-toolbar-refresh",
          kind: "refresh-snapshot",
          label: "Refresh Snapshot",
          tone: "ghost",
          order: 50,
        },
      ]),
    }),
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
      id: "workflow-studio-template-selection",
      slot: "draft-authoring",
      title: "Workflow template selection",
      subtitle: "Select, preview, and instantiate starter workflow-template assets into a working draft configuration.",
      order: 7,
      render: () => createElement(WorkflowTemplateSelectionPanel, { surface: "workflow-studio" }),
    },
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
      id: "workflow-studio-run-history",
      slot: "session-context",
      title: "Workflow run history",
      subtitle: "Durable run summaries and structured run detail for the active workflow definition.",
      order: 15,
      render: ({ snapshot }) => createElement(WorkflowStudioRunHistoryPanel, {
        workflowId: snapshot?.draft?.assetId,
        workflowName: snapshot?.draft?.metadata.title,
      }),
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
