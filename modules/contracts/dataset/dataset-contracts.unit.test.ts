import { describe, expect, it } from "vitest";

import { normalizeDatasetDescriptor } from ".";

describe("dataset contracts", () => {
  it("normalizes dataset descriptors and materialization references", () => {
    const descriptor = normalizeDatasetDescriptor({
      id: " orders.curated.v1 ",
      name: " Orders Curated ",
      sourceArtifactKeys: [" derived/orders/normalized.parquet "],
      transformIds: [" normalize-orders "],
      schema: {
        fields: [
          {
            name: " order_id ",
            type: " string ",
          },
        ],
      },
      materializations: [
        {
          artifactKey: " dataset/orders/curated-v1.parquet ",
          format: " parquet ",
        },
      ],
    });

    expect(descriptor).toEqual({
      id: "orders.curated.v1",
      name: "Orders Curated",
      sourceArtifactKeys: ["derived/orders/normalized.parquet"],
      transformIds: ["normalize-orders"],
      schema: {
        fieldCount: undefined,
        fields: [
          {
            name: "order_id",
            type: "string",
          },
        ],
      },
      materializations: [
        {
          artifactKey: "dataset/orders/curated-v1.parquet",
          format: "parquet",
          rowCount: undefined,
          materializedAt: undefined,
        },
      ],
      createdAt: undefined,
    });
  });
});
