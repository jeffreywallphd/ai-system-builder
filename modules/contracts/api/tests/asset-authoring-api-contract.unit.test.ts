import { describe, expect, it } from "../../../testing/node-test";
import * as contract from "../asset-authoring-api-contract";

describe("asset-authoring API contract", () => {
  it("exports phase 8a operations", () => {
    expect(contract.API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION).toBe("asset-authoring.list-effective-summaries");
    expect(contract.API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION).toBe("asset-authoring.create-workspace-authored-asset");
  });
});
