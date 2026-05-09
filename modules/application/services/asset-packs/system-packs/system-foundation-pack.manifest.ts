import type { AssetPackManifest } from "../../../../contracts/asset";

import { createSystemFoundationPackManifest } from "../asset-pack-manifest-builder.service";

export const SYSTEM_FOUNDATION_PACK_MANIFEST: AssetPackManifest =
  createSystemFoundationPackManifest();
