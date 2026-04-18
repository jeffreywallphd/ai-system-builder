import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "../../../modules/testing/node-test";

function readSourceFile(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("hugging face adapter TypeScript regression guards", () => {
  it("keeps explicit method parameter types for repo-browser methods used by desktop webpack compilation", () => {
    const source = readSourceFile(
      "modules/adapters/storage/huggingface/createHuggingFaceArtifactRepoStorageAdapter.ts",
    );

    expect(source).toContain("async listNamespaceDatasets(");
    expect(source).toContain("namespace: string,");
    expect(source).toContain("async listDatasetParquetFiles(");
    expect(source).toContain("input: { repository: string; revision?: string },");
  });
});
