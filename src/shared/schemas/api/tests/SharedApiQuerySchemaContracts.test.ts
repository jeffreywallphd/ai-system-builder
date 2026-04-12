import { describe, expect, it } from "bun:test";
import {
  SharedApiQuerySchemaValidationError,
  parseSharedApiListQueryConventions,
} from "../SharedApiQuerySchemaContracts";

describe("SharedApiQuerySchemaContracts", () => {
  it("parses shared pagination, sorting, search and workspace context", () => {
    const searchParams = new URLSearchParams(
      "workspaceId=workspace%3Aalpha"
      + "&actorWorkspaceId=workspace%3Aops"
      + "&search=workspaces"
      + "&limit=25"
      + "&offset=10"
      + "&sortBy=createdAt"
      + "&sortDirection=desc",
    );

    const parsed = parseSharedApiListQueryConventions(searchParams);
    expect(parsed.workspaceId).toBe("workspace:alpha");
    expect(parsed.actorWorkspaceId).toBe("workspace:ops");
    expect(parsed.search).toBe("workspaces");
    expect(parsed.pagination).toEqual({ limit: 25, offset: 10 });
    expect(parsed.sorting).toEqual({ sortBy: "createdAt", sortDirection: "desc" });
  });

  it("throws validation errors for invalid pagination and sort inputs", () => {
    const searchParams = new URLSearchParams("limit=0&offset=-1&sortDirection=latest-first");

    expect(() => parseSharedApiListQueryConventions(searchParams)).toThrow(SharedApiQuerySchemaValidationError);

    try {
      parseSharedApiListQueryConventions(searchParams);
      throw new Error("Expected validation error");
    } catch (error) {
      if (!(error instanceof SharedApiQuerySchemaValidationError)) {
        throw error;
      }

      expect(error.issues.map((issue) => issue.path)).toEqual(["limit", "offset", "sortDirection"]);
    }
  });
});
