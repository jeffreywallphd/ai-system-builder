import type { AssetReference } from "../../../contracts/asset";
import type {
  AssetDefinitionCard,
  AssetDefinitionDetail,
  AssetRegistryListQuery,
  AssetRegistryListResult,
  AssetRegistryReadOptions,
} from "../../services/asset/asset-registry-read-facade.types";

export interface AssetRegistryDefinitionReadPort {
  listDefinitionCards(query?: AssetRegistryListQuery): Promise<AssetRegistryListResult<AssetDefinitionCard>>;
  readDefinitionDetail(ref: AssetReference, options?: AssetRegistryReadOptions): Promise<AssetDefinitionDetail | undefined>;
}
