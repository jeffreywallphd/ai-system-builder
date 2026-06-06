import { describe, expect, it } from "../../../../testing/node-test";
import {
  ARTIFACT_PREVIEW_MAX_LINES,
  createTextArtifactPreview,
  createUnsupportedArtifactPreview,
  describeArtifactPreview,
} from "../index";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("artifact preview model", () => {
  it("classifies the first supported artifact preview types by media type and extension", () => {
    expect(describeArtifactPreview({ storageKey: "uploads/a.pdf", mediaType: "application/pdf" }).kind).toBe("pdf");
    expect(describeArtifactPreview({ storageKey: "uploads/a.docx" }).kind).toBe("office-document");
    expect(describeArtifactPreview({ storageKey: "uploads/a.xlsx" }).kind).toBe("office-spreadsheet");
    expect(describeArtifactPreview({ storageKey: "uploads/a.csv" }).kind).toBe("csv");
    expect(describeArtifactPreview({ storageKey: "uploads/a.txt" }).kind).toBe("text");
    expect(describeArtifactPreview({ storageKey: "uploads/a.md" }).kind).toBe("markdown");
    expect(describeArtifactPreview({ storageKey: "uploads/a.json" }).kind).toBe("json");
    expect(describeArtifactPreview({ storageKey: "uploads/a.png", mediaType: "image/png" }).kind).toBe("image");
    expect(describeArtifactPreview({ storageKey: "uploads/a.mp4", mediaType: "video/mp4" }).kind).toBe("video");
  });

  it("formats complete JSON previews and keeps the preview visibly limited", () => {
    const preview = createTextArtifactPreview(
      { storageKey: "uploads/config.json", mediaType: "application/json" },
      bytes('{"name":"demo","enabled":true}'),
    );

    expect(preview.title).toContain("JSON preview for uploads/config.json");
    expect(preview.text).toContain('\n  "name": "demo"');
    expect(preview.truncated).toBe(false);
  });

  it("truncates long text previews by line count", () => {
    const preview = createTextArtifactPreview(
      { storageKey: "uploads/notes.md", mediaType: "text/markdown" },
      bytes(Array.from({ length: ARTIFACT_PREVIEW_MAX_LINES + 10 }, (_, index) => `line ${index}`).join("\n")),
    );

    expect(preview.text?.split("\n").length).toBe(ARTIFACT_PREVIEW_MAX_LINES);
    expect(preview.truncated).toBe(true);
  });

  it("uses a recognized placeholder for Office files until a safe parser is added", () => {
    const preview = createUnsupportedArtifactPreview({ storageKey: "uploads/report.docx" });

    expect(preview.title).toContain("DOCX preview for uploads/report.docx");
    expect(preview.message).toContain("recognized");
    expect(preview.message).toContain("Download");
  });
});
