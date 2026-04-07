import { describe, expect, it } from "bun:test";
import {
  GovernanceAuditSortBy,
  normalizeGovernanceAuditQuery,
} from "../GovernanceAuditReviewModel";

describe("GovernanceAuditReviewModel", () => {
  it("normalizes query pagination, sorting, and trimmed search", () => {
    const result = normalizeGovernanceAuditQuery(Object.freeze({
      search: "   policy-change   ",
      pagination: Object.freeze({
        limit: 500,
        offset: -4,
      }),
      sorting: Object.freeze({
        sortBy: "unsupported",
        sortDirection: "unsupported",
      }),
      includeThinSafeOnly: true,
    }));

    expect(result.search).toBe("policy-change");
    expect(result.pagination).toEqual({
      limit: 200,
      offset: 0,
    });
    expect(result.sorting).toEqual({
      sortBy: GovernanceAuditSortBy.occurredAt,
      sortDirection: "desc",
    });
    expect(result.includeThinSafeOnly).toBeTrue();
  });
});
