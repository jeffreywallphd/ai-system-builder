import type {
  IMediaDatasetValidator,
  IMediaRecordValidator,
} from "../../../../domain/dataset-studio/interfaces/MediaValidation";
import type { IImageRecordValidator } from "../../../../domain/dataset-studio/contracts/ImageRecord";
import { ZodImageRecordValidator } from "./ImageRecordValidator";
import { ZodMediaDatasetValidator, ZodMediaRecordValidator } from "./MediaDatasetValidator";

export interface MediaValidationAdapterBundle {
  readonly imageRecordValidator: IImageRecordValidator;
  readonly mediaRecordValidator: IMediaRecordValidator;
  readonly mediaDatasetValidator: IMediaDatasetValidator;
}

export function createDefaultMediaValidationAdapters(): MediaValidationAdapterBundle {
  const imageRecordValidator = new ZodImageRecordValidator();
  const mediaRecordValidator = new ZodMediaRecordValidator(imageRecordValidator);
  const mediaDatasetValidator = new ZodMediaDatasetValidator(mediaRecordValidator);
  return Object.freeze({
    imageRecordValidator,
    mediaRecordValidator,
    mediaDatasetValidator,
  });
}
