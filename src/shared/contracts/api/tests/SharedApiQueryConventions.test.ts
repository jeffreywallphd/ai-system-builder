import { describe, expect, it } from "bun:test";
import {
  SharedApiQueryParamKeys,
  appendSharedApiListQueryConventions,
  appendSharedApiQueryBoolean,
  appendSharedApiQueryList,
  appendSharedApiQueryValue,
  buildSharedApiListQueryKey,
  toSharedApiQuerySuffix,
} from "../SharedApiQueryConventions";

describe("SharedApiQueryConventions", () => {
  it("builds canonical list query conventions with stable key names", () => {
    const query = new URLSearchParams();
    appendSharedApiListQueryConventions(query, {
      workspaceId: "workspace:alpha",
      actorWorkspaceId: "workspace:actor",
      search: "latest",
      pagination: {
        limit: 25,
        offset: 10,
      },
      sorting: {
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });
    appendSharedApiQueryValue(query, "ownerUserIdentityId", "user:owner");
    appendSharedApiQueryList(query, "status", ["active", "suspended"]);
    appendSharedApiQueryBoolean(query, "includeDeleted", false);

    expect(query.toString()).toBe(
      "workspaceId=workspace%3Aalpha"
      + "&actorWorkspaceId=workspace%3Aactor"
      + "&search=latest"
      + "&limit=25"
      + "&offset=10"
      + "&sortBy=createdAt"
      + "&sortDirection=desc"
      + "&ownerUserIdentityId=user%3Aowner"
      + "&status=active"
      + "&status=suspended"
      + "&includeDeleted=false",
    );

    expect(SharedApiQueryParamKeys.workspaceId).toBe("workspaceId");
    expect(SharedApiQueryParamKeys.limit).toBe("limit");
    expect(toSharedApiQuerySuffix(query)).toBe(`?${query.toString()}`);
  });

  it("builds stable query keys for shared list caches", () => {
    const first = buildSharedApiListQueryKey({
      domain: "workspaces",
      operation: "list",
      context: {
        workspaceId: "workspace:alpha",
        search: "owners",
        pagination: { limit: 20, offset: 0 },
      },
      filters: {
        status: ["active", "suspended"],
        visibility: "team",
      },
    });

    const second = buildSharedApiListQueryKey({
      domain: "workspaces",
      operation: "list",
      context: {
        workspaceId: "workspace:alpha",
        search: "owners",
        pagination: { limit: 20, offset: 0 },
      },
      filters: {
        visibility: "team",
        status: ["active", "suspended"],
      },
    });

    expect(first).toBe(second);
  });
});
