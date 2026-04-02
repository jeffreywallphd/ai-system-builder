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
          schemas: {
            input: {
              assetId: "asset:schema:source",
            },
            output: {
              assetId: "asset:schema:prepared",
            },
          },
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
          runtime: {
            executionMode: "on-demand",
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
      subtitle: "Author reusable ingestion and transformation flows. Define structures in Schema Studio, then link them here.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Dataset Pipeline assets organize ingestion, mapping/transformation, enrichment, and execution-oriented data flow behavior.",
        "Use Schema Studio to author schemas. In this studio, link input/output schemas instead of designing table structures directly.",
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
