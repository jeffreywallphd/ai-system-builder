import { createDatasetStudioTaxonomy, DatasetStudioIdentity } from "../../../domain/dataset-studio/DatasetStudioDomain";
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
    subtitle: "Prepare and move data through guided pipeline stages. Use Schema Studio for structure design.",
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
      title: "Dataset draft guidance",
      subtitle: "Keep this workspace focused on ingestion, mapping, cleanup, and execution flow.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Use Data Studio for pipeline and preparation work. Use Schema Studio for table and field design.",
        "Asset role: dataset (atomic)",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "dataset-studio-metadata-summary",
      slot: "metadata",
      title: "Dataset taxonomy and contract status",
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
