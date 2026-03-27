import { createDatasetStudioTaxonomy, DatasetStudioIdentity } from "../../../domain/dataset-studio/DatasetStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";

export const datasetStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: DatasetStudioIdentity.studioType,
  studioId: DatasetStudioIdentity.defaultStudioId,
  displayName: DatasetStudioIdentity.defaultStudioName,
  role: "dataset",
  defaults: {
    title: "Dataset Asset Draft",
    tags: Object.freeze(["dataset", "studio-shell"]),
    contentTemplate: JSON.stringify({ datasetSpec: { format: "jsonl", schema: {}, source: "" } }, null, 2),
    metadataPatch: {
      title: "Dataset Asset Draft",
      tags: ["dataset", "studio-shell"],
      summary: "Atomic dataset asset drafted through Dataset Studio.",
      taxonomy: createDatasetStudioTaxonomy(),
      provenance: {
        sourceType: "generated",
        sourceLabel: DatasetStudioIdentity.studioType,
      },
    },
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
  ]),
});
