import type { ImageRunHistoryRecord } from "@application/system-runtime/ImageRunHistoryDataContract";
import type { OutputGalleryItem } from "@application/system-runtime/OutputGalleryDataContract";

export interface ReferenceImageCrossStudioSyncRequest {
  readonly refreshSharedStudioSnapshot: () => Promise<void>;
  readonly loadLatestResults: () => Promise<ReadonlyArray<OutputGalleryItem>>;
  readonly loadLatestHistory: () => Promise<ReadonlyArray<ImageRunHistoryRecord>>;
  readonly previousActiveResultId?: string;
  readonly selectedSourceRecordId?: string;
}

export interface ReferenceImageCrossStudioSyncResult {
  readonly outputs: ReadonlyArray<OutputGalleryItem>;
  readonly history: ReadonlyArray<ImageRunHistoryRecord>;
  readonly activeResultId?: string;
  readonly selectedSourceRecordId?: string;
}

function resolveActiveResultId(input: {
  readonly outputs: ReadonlyArray<OutputGalleryItem>;
  readonly previousActiveResultId?: string;
}): string | undefined {
  if (input.previousActiveResultId && input.outputs.some((entry) => entry.image.recordId === input.previousActiveResultId)) {
    return input.previousActiveResultId;
  }
  return input.outputs[0]?.image.recordId;
}

function resolveSelectedSourceRecordId(input: {
  readonly history: ReadonlyArray<ImageRunHistoryRecord>;
  readonly previousSelectedSourceRecordId?: string;
}): string | undefined {
  if (input.previousSelectedSourceRecordId) {
    return input.previousSelectedSourceRecordId;
  }
  return input.history[0]?.inputs.images[0]?.recordId;
}

export class ReferenceImageCrossStudioSyncService {
  public async synchronize(request: ReferenceImageCrossStudioSyncRequest): Promise<ReferenceImageCrossStudioSyncResult> {
    await request.refreshSharedStudioSnapshot();
    const [outputs, history] = await Promise.all([
      request.loadLatestResults(),
      request.loadLatestHistory(),
    ]);

    return Object.freeze({
      outputs,
      history,
      activeResultId: resolveActiveResultId({
        outputs,
        previousActiveResultId: request.previousActiveResultId,
      }),
      selectedSourceRecordId: resolveSelectedSourceRecordId({
        history,
        previousSelectedSourceRecordId: request.selectedSourceRecordId,
      }),
    });
  }
}

