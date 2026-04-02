import { describe, expect, it } from "bun:test";
import { DatasetSchemaIntentIds } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { DatasetInstanceRoles } from "../../../domain/system-runtime/DatasetInstanceDomain";
import {
  buildReferenceImageDatasetInstanceRequests,
  ReferenceImageSystemTemplate,
  ReferenceImageSystemTemplateId,
} from "../ReferenceImageSystemTemplate";

describe("ReferenceImageSystemTemplate", () => {
  it("defines a bounded reference-image system composition with explicit IO contracts", () => {
    expect(ReferenceImageSystemTemplate.templateId).toBe(ReferenceImageSystemTemplateId);
    expect(ReferenceImageSystemTemplate.systemAsset.inputs.map((entry) => entry.inputId)).toEqual(["sourceImage", "editInstruction"]);
    expect(ReferenceImageSystemTemplate.systemAsset.outputs.map((entry) => entry.outputId)).toEqual(["editedImages"]);
    expect(ReferenceImageSystemTemplate.systemAsset.components.map((entry) => entry.alias)).toEqual([
      "input-image-dataset-asset",
      "output-image-dataset-asset",
      "reference-workflow",
      "reference-ui",
    ]);
  });

  it("declares system-owned dataset instance bindings aligned to media schema intent", () => {
    const inputBinding = ReferenceImageSystemTemplate.datasetInstances.find((entry) => entry.bindingId === "input-image-dataset");
    const outputBinding = ReferenceImageSystemTemplate.datasetInstances.find((entry) => entry.bindingId === "output-image-dataset");

    expect(inputBinding?.runtimeOwner).toBe("system-runtime");
    expect(inputBinding?.role).toBe(DatasetInstanceRoles.inputStore);
    expect(inputBinding?.requiredSchemaIntentId).toBe(DatasetSchemaIntentIds.media);
    expect(inputBinding?.requiredOutputShapeKind).toBe("image-metadata-records");

    expect(outputBinding?.runtimeOwner).toBe("system-runtime");
    expect(outputBinding?.role).toBe(DatasetInstanceRoles.outputStore);
    expect(outputBinding?.requiredSchemaIntentId).toBe(DatasetSchemaIntentIds.media);
    expect(outputBinding?.requiredOutputShapeKind).toBe("image-metadata-records");
  });

  it("builds runtime-owned dataset ensure requests scoped by system id", () => {
    const requests = buildReferenceImageDatasetInstanceRequests("system:reference-image");

    expect(requests).toHaveLength(2);
    expect(requests.every((entry) => entry.systemId === "system:reference-image")).toBeTrue();
    expect(requests.map((entry) => entry.instanceId)).toEqual([
      "dataset-instance:reference-image:input",
      "dataset-instance:reference-image:output",
    ]);
    expect(requests[0]?.seedMetadata?.runtimeOwner).toBe("system-runtime");
    expect(requests[1]?.seedMetadata?.templateId).toBe(ReferenceImageSystemTemplateId);
  });
});
