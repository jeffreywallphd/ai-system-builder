import { describe, expect, it } from "../../../testing/node-test";

import { normalizeArtifactFamily, resolveArtifactFamily } from "../ArtifactFamily";

describe("ArtifactFamily", () => {
  it("normalizes and validates family values", () => {
    expect(normalizeArtifactFamily(" image ")).toBe("image");
    expect(() => normalizeArtifactFamily("unknown")).toThrow();
  });

  it("resolves media type and extension families", () => {
    expect(resolveArtifactFamily({ mediaType: "image/png" })).toBe("image");
    expect(resolveArtifactFamily({ mediaType: "application/pdf" })).toBe("document");
    expect(resolveArtifactFamily({ fileName: "notes.md" })).toBe("text");
    expect(resolveArtifactFamily({ extension: "json" })).toBe("structured-text");
    expect(resolveArtifactFamily({ fileName: "table.parquet" })).toBe("tabular");
  });

  it("falls back to binary", () => {
    expect(resolveArtifactFamily({ mediaType: "application/octet-stream" })).toBe("binary");
  });
});
