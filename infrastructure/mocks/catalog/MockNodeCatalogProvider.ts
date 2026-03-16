import {
  ComfyNodeCatalogProvider,
  type IComfyObjectInfo,
} from "../../comfyui/catalog/ComfyNodeCatalogProvider";
import { SEED_NODE_CATALOG } from "./seedNodeCatalog";

export interface IMockNodeCatalogProviderOptions {
  readonly definitions?: Readonly<Record<string, IComfyObjectInfo>>;
}

export class MockNodeCatalogProvider extends ComfyNodeCatalogProvider {
  constructor(options: IMockNodeCatalogProviderOptions = {}) {
    super(options.definitions ?? SEED_NODE_CATALOG);
  }
}
