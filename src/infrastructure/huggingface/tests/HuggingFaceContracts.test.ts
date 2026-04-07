import { describe, expect, it } from "bun:test";
import type { IRemoteModelCatalog } from "@application/ports/interfaces/IRemoteModelCatalog";
import type { IModelDownloader } from "@application/ports/interfaces/IModelDownloader";
import { HuggingFaceModelCatalog } from "../HuggingFaceModelCatalog";
import { HuggingFaceModelDownloader } from "../HuggingFaceModelDownloader";

describe("huggingface contracts", () => {
  it("adheres to remote catalog and downloader contracts", () => {
    const catalog: IRemoteModelCatalog = new HuggingFaceModelCatalog({ apiClient: {} as never });
    const downloader: IModelDownloader = new HuggingFaceModelDownloader({ apiClient: {} as never, fileStorage: {} as never });

    expect(typeof catalog.search).toBe("function");
    expect(typeof downloader.download).toBe("function");
  });
});

