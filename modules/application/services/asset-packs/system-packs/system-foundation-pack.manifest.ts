import type { AssetPackManifest } from "../../../../contracts/asset";

import { createSystemFoundationPackManifest } from "../asset-pack-manifest-builder.service";
import { UI_STRUCTURAL_PRIMITIVE_ENTRIES } from "./ui-primitives";

export const SYSTEM_FOUNDATION_PACK_MANIFEST: AssetPackManifest =
  createSystemFoundationPackManifest(UI_STRUCTURAL_PRIMITIVE_ENTRIES);
