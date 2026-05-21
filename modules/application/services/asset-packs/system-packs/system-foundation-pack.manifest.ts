import type { AssetPackManifest } from "../../../../contracts/asset";

import { createSystemFoundationPackManifest } from "../asset-pack-manifest-builder.service";
import { DISPLAY_PRIMITIVE_ENTRIES } from "./display-primitives";
import { FORM_PRIMITIVE_ENTRIES } from "./form-primitives";
import { SHELL_PRIMITIVE_ENTRIES } from "./shell-primitives";
import { UI_STRUCTURAL_PRIMITIVE_ENTRIES } from "./ui-primitives";

export const SYSTEM_FOUNDATION_PACK_MANIFEST: AssetPackManifest =
  createSystemFoundationPackManifest([
    ...UI_STRUCTURAL_PRIMITIVE_ENTRIES,
    ...FORM_PRIMITIVE_ENTRIES,
    ...DISPLAY_PRIMITIVE_ENTRIES,
    ...SHELL_PRIMITIVE_ENTRIES,
  ]);
