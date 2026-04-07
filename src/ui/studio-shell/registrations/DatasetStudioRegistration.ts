import { createDatasetStudioTaxonomy, DatasetStudioIdentity } from "@domain/dataset-studio/DatasetStudioDomain";
import { createElement } from "react";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";
import DatasetStudioDraftPreviewPanel from "../../components/assets/DatasetStudioDraftPreviewPanel";
import { ExperienceSurfaceAssetIds } from "../experience-assets/ExperienceSurfaceAssets";
import { DataStudioPreparationWizardStateAdapter } from "../data/DataStudioPreparationWizardStateAdapter";

const defaultDataStudioPipelineState = new DataStudioPreparationWizardStateAdapter().exportPipelineStateJson();

export const datasetStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: DatasetStudioIdentity.studioType,
  studioId: DatasetStudioIdentity.defaultStudioId,
  kind: "atomic",
  displayName: DatasetStudioIdentity.defaultStudioName,
  role: "dataset",
  allowedBehaviorKinds: Object.freeze(["none"]),
  shell: Object.freeze({
    title: "Data Studio",
    subtitle: "Organize data preparation in one place. Use Schema Studio for structure design and Pipeline Studio for reusable flow logic.",
    experienceAssets: Object.freeze([
      ExperienceSurfaceAssetIds.loomWizard,
      ExperienceSurfaceAssetIds.loomCanvas,
    ]),
    toolbar: Object.freeze({
      actions: Object.freeze([
        {
          id: "data-studio-toolbar-save",
          kind: "save-draft",
          label: "Save",
          tone: "primary",
          order: 10,
        },
        {
          id: "data-studio-toolbar-validate",
          kind: "run-validation",
          label: "Run Validation",
          tone: "default",
          order: 20,
        },
        {
          id: "data-studio-toolbar-run",
          kind: "run-data-pipeline",
          label: "Run Pipeline",
          tone: "default",
          order: 25,
        },
        {
          id: "data-studio-toolbar-refresh",
          kind: "refresh-snapshot",
          label: "Refresh Snapshot",
          tone: "ghost",
          order: 30,
        },
      ]),
    }),
  }),
  defaults: {
    title: "Dataset Asset Draft",
    tags: Object.freeze(["dataset", "studio-shell"]),
    contentTemplate: defaultDataStudioPipelineState,
    metadataPatch: createAtomicStudioMetadataPatch({
      title: "Dataset Asset Draft",
      tags: ["dataset", "studio-shell"],
      summary: "Atomic dataset asset drafted through Dataset Studio.",
      taxonomy: createDatasetStudioTaxonomy(),
      sourceLabel: DatasetStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "dataset-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Data Studio guidance",
      subtitle: "Use this page as an organizer for schema and flow work, then return here for preview and preparation.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Use Data Studio as your data workspace home for preparation and preview tasks.",
        "Go to Schema Studio for table and field design, and Pipeline Studio for reusable flow authoring.",
        "Asset role: dataset (atomic)",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "dataset-studio-data-preview-panel",
      slot: "draft-authoring",
      title: "Data preview panel",
      subtitle: "Preview of draft content through data converter + execution contracts.",
      order: 20,
      render: ({ snapshot }) => createElement(DatasetStudioDraftPreviewPanel, {
        draftId: snapshot?.draft?.draftId,
        draftAssetId: snapshot?.draft?.assetId,
        draftTitle: snapshot?.draft?.metadata.title,
        draftContent: snapshot?.draft?.content,
      }),
    },
  ]),
});

