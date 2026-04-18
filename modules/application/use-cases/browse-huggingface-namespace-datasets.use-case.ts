import type { ApplicationRequestContext } from "../ports";
import type { HuggingFaceRepoBrowserPort } from "../ports/storage";

export interface BrowseHuggingFaceNamespaceDatasetsCommand {
  namespace: string;
}

export class BrowseHuggingFaceNamespaceDatasetsUseCase {
  private readonly repoBrowser: HuggingFaceRepoBrowserPort;

  public constructor(dependencies: { repoBrowser: HuggingFaceRepoBrowserPort }) {
    this.repoBrowser = dependencies.repoBrowser;
  }

  public async execute(
    command: BrowseHuggingFaceNamespaceDatasetsCommand,
    context: ApplicationRequestContext = {},
  ) {
    return this.repoBrowser.listNamespaceDatasets(command.namespace, context);
  }
}
