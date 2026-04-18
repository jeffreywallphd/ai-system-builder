import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "../../../modules/testing/node-test";

function readSourceFile(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("artifact browser TypeScript regression guards", () => {
  it("keeps selectedStorageKey destructured in desktop ArtifactBrowserFeature", () => {
    const source = readSourceFile(
      "apps/desktop/src/renderer/features/artifact-browser/components/ArtifactBrowserFeature.tsx",
    );

    expect(source).toContain("selectedStorageKey");
    expect(source).toMatchObject(expect.stringMatching(/const\s*\{\s*[\s\S]*selectedStorageKey[\s\S]*\}\s*=\s*useArtifactBrowserFeature\(client\);/));
  });

  it("keeps publish logic result typed with TDetail for setPublishedBackingFromDetail", () => {
    const source = readSourceFile("modules/ui/shared/hooks/useArtifactBrowserPublishLogic.ts");

    expect(source).toContain("export interface UseArtifactBrowserPublishLogicResult<");
    expect(source).toContain("setPublishedBackingFromDetail: (detail: TDetail | undefined) => void;");
    expect(source).toContain("): UseArtifactBrowserPublishLogicResult<TDetail> {");
  });
});
