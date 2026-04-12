import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
  PersistenceSchemaValidationError,
  PersistenceTenancyMetadataSchema,
  parsePersistenceSchema,
} from "../PersistenceSchemaPrimitives";

describe("PersistenceSchemaPrimitives", () => {
  it("enforces tenancy-specific identifier requirements", () => {
    expect(() => PersistenceTenancyMetadataSchema.parse({
      scope: "workspace",
    })).toThrow("workspaceId");

    const parsed = PersistenceTenancyMetadataSchema.parse({
      scope: "workspace",
      workspaceId: "workspace-1",
    });

    expect(parsed.workspaceId).toBe("workspace-1");
  });

  it("returns typed validation failures from parse helper", () => {
    expect(() => parsePersistenceSchema(
      "ExampleSchema",
      z.object({
        id: z.string().min(1),
      }),
      {
        id: "",
      },
    )).toThrow(PersistenceSchemaValidationError);
  });
});
