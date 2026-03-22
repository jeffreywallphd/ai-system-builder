import { describe, expect, it } from "bun:test";
import { ModelTrainingStore } from "../ModelTrainingStore";

describe("ModelTrainingStore", () => {
  it("refreshes and submits jobs through the service layer", async () => {
    const calls: string[] = [];
    const store = new ModelTrainingStore({
      listJobs: async () => {
        calls.push("list");
        return [];
      },
      submitJob: async () => {
        calls.push("submit");
        return undefined as never;
      },
    } as never);

    await store.refresh();
    await store.submitJob({
      name: "Job",
      baseModelId: "base",
      datasetId: "dataset",
      datasetVersionId: "version",
      createdBy: "tester",
      configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
    });

    expect(calls).toEqual(["list", "submit", "list"]);
  });
});
