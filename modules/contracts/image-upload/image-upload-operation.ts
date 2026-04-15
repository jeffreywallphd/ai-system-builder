import { createTransportOperation } from "../transport";

const IMAGE_UPLOAD_OPERATION_SEGMENTS = ["image", "upload"] as const;

export const IMAGE_UPLOAD_OPERATION = createTransportOperation(
  ...IMAGE_UPLOAD_OPERATION_SEGMENTS,
);
