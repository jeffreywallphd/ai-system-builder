import { describe, expect, it, testDouble } from "../../../testing/node-test";

import type { HuggingFaceRepoBrowserPort } from "../../ports/storage";
import { BrowseHuggingFaceNamespaceDatasetsUseCase } from "../browse-huggingface-namespace-datasets.use-case";
import { BrowseHuggingFaceDatasetParquetFilesUseCase } from "../browse-huggingface-dataset-parquet-files.use-case";

describe("Hugging Face repo browse use cases", () => {
  it("delegates namespace dataset browse to repo-browser port", async () => {
    const repoBrowser: HuggingFaceRepoBrowserPort = {
      listNamespaceDatasets: testDouble.fn(async () => ({
        ok: true as const,
        value: {
          namespace: "OpenFinAL",
          datasets: [{ namespace: "OpenFinAL", repository: "OpenFinAL/financial-news" }],
        },
      })),
      listDatasetParquetFiles: testDouble.fn(),
    } as unknown as HuggingFaceRepoBrowserPort;

    const useCase = new BrowseHuggingFaceNamespaceDatasetsUseCase({ repoBrowser });
    const result = await useCase.execute({ namespace: "OpenFinAL" }, { requestId: "req-1" });

    expect(result.ok).toBe(true);
    expect(repoBrowser.listNamespaceDatasets).toHaveBeenCalledWith("OpenFinAL", { requestId: "req-1" });
  });

  it("delegates dataset parquet-file browse to repo-browser port", async () => {
    const repoBrowser: HuggingFaceRepoBrowserPort = {
      listNamespaceDatasets: testDouble.fn(),
      listDatasetParquetFiles: testDouble.fn(async () => ({
        ok: true as const,
        value: {
          repository: "OpenFinAL/financial-news",
          revision: "main",
          files: [{ repository: "OpenFinAL/financial-news", path: "data/a.parquet", revision: "main" }],
        },
      })),
    } as unknown as HuggingFaceRepoBrowserPort;

    const useCase = new BrowseHuggingFaceDatasetParquetFilesUseCase({ repoBrowser });
    const result = await useCase.execute({ repository: "OpenFinAL/financial-news", revision: "main" }, { correlationId: "corr-1" });

    expect(result.ok).toBe(true);
    expect(repoBrowser.listDatasetParquetFiles).toHaveBeenCalledWith(
      { repository: "OpenFinAL/financial-news", revision: "main" },
      { correlationId: "corr-1" },
    );
  });
});
