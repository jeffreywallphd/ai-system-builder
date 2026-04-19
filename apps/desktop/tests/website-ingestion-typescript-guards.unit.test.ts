import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "../../../modules/testing/node-test";

function readSourceFile(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("website ingestion TypeScript regression guards", () => {
  it("keeps website ingestion metadata bridged to storage metadata contracts for webpack emit-safe typing", () => {
    const source = readSourceFile(
      "modules/application/use-cases/website-ingestion/website-ingestion.mappers.ts",
    );

    expect(source).toContain("StorageObjectMetadata");
    expect(source).toContain("StorageObjectMetadata\n  & WebsiteHtmlCaptureMetadata\n  & { artifactFamily: ArtifactFamily };");
  });
});
