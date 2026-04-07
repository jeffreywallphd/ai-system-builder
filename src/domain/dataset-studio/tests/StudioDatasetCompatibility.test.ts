import { describe, expect, it } from "bun:test";
import {
  createDatasetAssetReference,
  createDatasetInstanceReference,
  createDatasetRecordReference,
} from "../contracts/StudioDatasetCompatibility";

describe("StudioDatasetCompatibility contracts", () => {
  it("normalizes shared dataset asset + instance + record references", () => {
    const dataset = createDatasetAssetReference({
      assetId: " asset:image-dataset ",
      versionId: " 1.0.0 ",
    });
    const instance = createDatasetInstanceReference({
      systemId: " system:image-runtime ",
      instanceId: " dataset-instance:images ",
      dataset,
    });
    const record = createDatasetRecordReference({
      dataset,
      selectionId: " record-1 ",
      recordId: " record-1 ",
      instance,
      imageReference: " file:///tmp/image.png ",
    });

    expect(dataset.assetId).toBe("asset:image-dataset");
    expect(dataset.versionId).toBe("1.0.0");
    expect(instance.systemId).toBe("system:image-runtime");
    expect(record.selectionId).toBe("record-1");
    expect(record.dataset.assetId).toBe("asset:image-dataset");
    expect(record.instance?.instanceId).toBe("dataset-instance:images");
  });

  it("rejects empty required identifiers", () => {
    expect(() => createDatasetAssetReference({ assetId: " " })).toThrow("assetId is required");
  });
});
