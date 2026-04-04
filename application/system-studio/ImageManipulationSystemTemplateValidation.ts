import type { AssetValidationResult } from "../../domain/contracts/AssetValidation";
import type { ImageManipulationSystemTemplateDefinition } from "./ImageManipulationSystemTemplate";
import {
  ImageManipulationRuntimeTargets,
  validateImageManipulationTemplateCompleteness,
} from "./ImageManipulationSystemCompletenessValidationService";

export { ImageManipulationRuntimeTargets };

export function validateImageManipulationSystemTemplate(
  template: ImageManipulationSystemTemplateDefinition,
): AssetValidationResult {
  return validateImageManipulationTemplateCompleteness({ template }).assetValidation;
}
