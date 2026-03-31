import { createDatasetStudioTaxonomy, DatasetStudioIdentity } from "../../../domain/dataset-studio/DatasetStudioDomain";
import { createElement } from "react";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";
import DatasetStudioDraftPreviewPanel from "../../components/assets/DatasetStudioDraftPreviewPanel";
import DatasetStageAuthoringPanel from "../../components/assets/DatasetStageAuthoringPanel";

export const datasetStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: DatasetStudioIdentity.studioType,
  studioId: DatasetStudioIdentity.defaultStudioId,
  kind: "atomic",
  displayName: DatasetStudioIdentity.defaultStudioName,
  role: "dataset",
  allowedBehaviorKinds: Object.freeze(["none"]),
  defaults: {
    title: "Dataset Asset Draft",
    tags: Object.freeze(["dataset", "studio-shell"]),
    contentTemplate: JSON.stringify({ datasetSpec: { format: "jsonl", schema: {}, source: "" } }, null, 2),
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
      subtitle: "Dataset structure/versioning is authored as an atomic asset; pipelines remain composite assets.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Keep dataset authoring atomic: schema/profile/version in the asset, execution in behaviors.",
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
      id: "dataset-studio-stage-authoring-panel",
      slot: "draft-authoring",
      title: "Stage authoring",
      subtitle: "Stage-aware wizard and canvas authoring powered by shared WizardFlowEngine state.",
      order: 15,
      render: () => createElement(DatasetStageAuthoringPanel),
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
