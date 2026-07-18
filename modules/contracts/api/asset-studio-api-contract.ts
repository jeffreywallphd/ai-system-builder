import { createTransportOperation } from "../transport";

export const API_ASSET_STUDIO_OPERATIONS = {
  start: createTransportOperation("asset-studio", "start"),
  propose: createTransportOperation("asset-studio", "propose"),
  review: createTransportOperation("asset-studio", "review"),
  read: createTransportOperation("asset-studio", "read"),
  list: createTransportOperation("asset-studio", "list"),
} as const;
