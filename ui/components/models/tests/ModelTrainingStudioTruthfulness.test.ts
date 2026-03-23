import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ModelTrainingStudio truthfulness", () => {
  it("keeps real training, export-only, and reconciliation language explicit", () => {
    const source = readSource("ui/components/models/ModelTrainingStudio.tsx");

    expect(source).toContain("Submit real training job");
    expect(source).toContain("Prepare export-only bundle");
    expect(source).toContain("Refresh active jobs");
    expect(source).toContain("Reconcile");
    expect(source).toContain("Export-only work writes durable manifests and bundles without claiming a trained model");
    expect(source).toContain("submitted → queued → running → terminal lifecycle states");
  });
});
