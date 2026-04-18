import type { ApplicationRequestContext } from "../ports";
import type { HuggingFaceRepoBrowserPort } from "../ports/storage";

export interface BrowseHuggingFaceDatasetParquetFilesCommand {
  repository: string;
  revision?: string;
}

export class BrowseHuggingFaceDatasetParquetFilesUseCase {
  private readonly repoBrowser: HuggingFaceRepoBrowserPort;

  public constructor(dependencies: { repoBrowser: HuggingFaceRepoBrowserPort }) {
    this.repoBrowser = dependencies.repoBrowser;
  }

  public async execute(
    command: BrowseHuggingFaceDatasetParquetFilesCommand,
    context: ApplicationRequestContext = {},
  ) {
    return this.repoBrowser.listDatasetParquetFiles({
      repository: command.repository,
      revision: command.revision,
    }, context);
  }
}
