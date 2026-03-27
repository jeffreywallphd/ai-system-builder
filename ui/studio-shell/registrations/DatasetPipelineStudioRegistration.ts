import { createDatasetPipelineStudioTaxonomy, DatasetPipelineStudioIdentity } from "../../../domain/dataset-pipeline-studio/DatasetPipelineStudioDomain";
import type { CompositeStudioRegistration } from "../StudioShellExtensions";
import { createCompositeStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const datasetPipelineStudioRegistration: CompositeStudioRegistration = Object.freeze({
  studioType: DatasetPipelineStudioIdentity.studioType,
  studioId: DatasetPipelineStudioIdentity.defaultStudioId,
  kind: "composite",
  displayName: DatasetPipelineStudioIdentity.defaultStudioName,
  role: "dataset-pipeline",
  allowedBehaviorKinds: Object.freeze(["deterministic", "iterative"]),
  shell: Object.freeze({
    title: DatasetPipelineStudioIdentity.defaultStudioName,
    subtitle: "Shared composite shell for dataset-pipeline authoring with backend-authoritative lifecycle, validation, and publish/version flows.",
  }),
  defaults: {
    title: "Dataset Pipeline Asset Draft",
    tags: Object.freeze([
      "dataset-pipeline",
      "studio-shell",
      "composite",
      "source-ingestion",
      "data-cleaning",
      "dataset-transformation",
      "data-validation",
    ]),
    contentTemplate: JSON.stringify(
      {
        datasetPipelineSpec: {
          sources: [
            {
              datasetRef: "dataset:raw:v1",
              ingestionMode: "batch",
            },
          ],
          steps: [
            {
              id: "ingest-source",
              kind: "source-ingestion",
              mode: "append",
            },
            {
              id: "clean-records",
              kind: "data-cleaning",
              mode: "drop-invalid",
            },
            {
              id: "transform-fields",
              kind: "dataset-transformation",
              mode: "normalize",
            },
            {
              id: "validate-schema",
              kind: "data-validation",
              mode: "enforce",
            },
          ],
          outputs: {
            datasetVersionTarget: "dataset:prepared:v-next",
          },
        },
      },
      null,
      2,
    ),
    metadataPatch: createCompositeStudioMetadataPatch({
      title: "Dataset Pipeline Asset Draft",
      tags: [
        "dataset-pipeline",
        "studio-shell",
        "composite",
        "source-ingestion",
        "data-cleaning",
        "dataset-transformation",
        "data-validation",
      ],
      summary: "Composite dataset-pipeline asset drafted through Dataset Pipeline Studio.",
      taxonomy: createDatasetPipelineStudioTaxonomy("deterministic"),
      sourceLabel: DatasetPipelineStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "dataset-pipeline-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Dataset pipeline draft guidance",
      subtitle: "Author reusable data preparation pipelines with explicit ingestion, cleaning, transformation, and validation steps.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Dataset Pipeline assets are composite structures that organize dataset preparation behavior over dependent dataset/tool/config assets.",
        "Allowed behavior kinds: deterministic, iterative.",
        "Reuse existing source-ingestion, data-cleaning, dataset-transformation, and data-validation vocabulary in pipeline steps.",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "dataset-pipeline-studio-metadata-summary",
      slot: "metadata",
      title: "Dataset pipeline taxonomy and contract status",
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
