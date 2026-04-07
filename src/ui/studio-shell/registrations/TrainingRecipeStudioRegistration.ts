import {
  createTrainingRecipeStudioTaxonomy,
  TrainingRecipeStudioIdentity,
} from "@domain/training-recipe-studio/TrainingRecipeStudioDomain";
import type { CompositeStudioRegistration } from "../StudioShellExtensions";
import { createCompositeStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const trainingRecipeStudioRegistration: CompositeStudioRegistration = Object.freeze({
  studioType: TrainingRecipeStudioIdentity.studioType,
  studioId: TrainingRecipeStudioIdentity.defaultStudioId,
  kind: "composite",
  displayName: TrainingRecipeStudioIdentity.defaultStudioName,
  role: "training-recipe",
  allowedBehaviorKinds: Object.freeze(["deterministic"]),
  shell: Object.freeze({
    title: TrainingRecipeStudioIdentity.defaultStudioName,
    subtitle: "Shared composite shell for training-recipe authoring with backend-authoritative lifecycle, validation, and publish/version flows.",
  }),
  defaults: {
    title: "Training Recipe Asset Draft",
    tags: Object.freeze([
      "training-recipe",
      "studio-shell",
      "composite",
      "model-training",
      "fine-tuning",
      "runtime-config",
    ]),
    contentTemplate: JSON.stringify(
      {
        trainingRecipeSpec: {
          baseModelRef: "installed-model:base:v1",
          datasetRefs: [
            "dataset-version:train:v1",
          ],
          configProfileRef: "config-profile:runtime:v1",
          executionKind: "local-gradient-training",
          flow: {
            epochs: 3,
            batchSize: 8,
            learningRate: 0.0001,
          },
        },
      },
      null,
      2,
    ),
    metadataPatch: createCompositeStudioMetadataPatch({
      title: "Training Recipe Asset Draft",
      tags: ["training-recipe", "studio-shell", "composite", "model-training", "fine-tuning", "runtime-config"],
      summary: "Composite training-recipe asset drafted through Training Recipe Studio.",
      taxonomy: createTrainingRecipeStudioTaxonomy(),
      sourceLabel: TrainingRecipeStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "training-recipe-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Training recipe draft guidance",
      subtitle: "Author deterministic training flow structure while keeping runtime execution behavior in backend/application seams.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Training Recipe assets are composite structures coordinating base models, dataset versions, config profiles, and deterministic training-flow settings.",
        "Reuse current model-training and fine-tuning vocabulary for execution kind and bounded flow configuration.",
        "Pin dependent dataset/model/config assets by version for publish-ready lineage.",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
  ]),
});

