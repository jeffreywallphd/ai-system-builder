import { describe, expect, it } from "vitest";

import { createContractError } from "../../../contracts/shared";
import { mapStoreImageUploadToRegisterStagedDataResult } from "../image-upload/mapStoreImageUploadToRegisterStagedDataResult";

describe("mapStoreImageUploadToRegisterStagedDataResult", () => {
  it("maps staged-data descriptor success into a register-staged-data success result", () => {
    const result = mapStoreImageUploadToRegisterStagedDataResult(
      {
        ok: true,
        descriptor: {
          key: " uploads/cat.png ",
          mediaType: "image/png",
          sizeBytes: 4,
        },
        sourceKind: "upload",
        originalName: " cat.png ",
      },
      {
        requestId: "req-map-1",
      },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        sourceKind: "upload",
        originalName: "cat.png",
        storage: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
      requestId: "req-map-1",
      correlationId: undefined,
    });
  });

  it("maps contract failures into register-staged-data failure results", () => {
    const result = mapStoreImageUploadToRegisterStagedDataResult(
      {
        ok: false,
        error: createContractError("validation", "bytes must not be empty."),
      },
      {
        requestId: "req-map-2",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "validation",
        message: "bytes must not be empty.",
        details: undefined,
        requestId: undefined,
        correlationId: undefined,
      },
      requestId: "req-map-2",
      correlationId: undefined,
    });
  });
});
