import { createDatasetPipelineStudioTaxonomy, DatasetPipelineStudioIdentity } from "../../../src/domain/dataset-pipeline-studio/DatasetPipelineStudioDomain";
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
    subtitle: "Build reusable data movement and transformation flows, then publish versioned pipeline assets.",
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
      subtitle: "Author data movement and transformation logic here. Define structures in Schema Studio, then link them here.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Pipeline assets organize ingestion, mapping, transformation, enrichment, and run behavior.",
        "Use Schema Studio to author schemas. In this studio, link input/output schemas instead of designing table structures directly.",
        "Allowed behavior kinds: deterministic, iterative.",
        "Reuse existing source-ingestion, data-cleaning, dataset-transformation, and data-validation vocabulary in pipeline steps.",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
  ]),
});
