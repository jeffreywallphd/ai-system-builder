import { describe, expect, it } from "bun:test";
import {
  assertNoUserManagedStoragePaths,
  validateNoUserManagedStoragePaths,
} from "../StoragePathPolicyValidation";

describe("StoragePathPolicyValidation", () => {
  it("reports inspectable issues for nested path-like storage fields", () => {
    const issues = validateNoUserManagedStoragePaths({
      metadata: {
        io: {
          inputDirectory: "/tmp/input",
          outputPath: "/tmp/output",
        },
      },
    });

    expect(issues.map((issue) => issue.path)).toEqual([
      "request.metadata.io.inputDirectory",
      "request.metadata.io.outputPath",
    ]);
  });

  it("throws a clear validation error when forbidden path configuration is present", () => {
    expect(() => assertNoUserManagedStoragePaths(
      {
        metadata: {
          filesystemRoot: "/tmp/custom",
        },
      },
      "invalid-request:Storage references must not include caller-managed filesystem paths.",
    )).toThrow("invalid-request:Storage references must not include caller-managed filesystem paths.");
  });
});
