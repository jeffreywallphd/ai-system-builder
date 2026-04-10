import {
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginWarmupRequest,
  type DesktopPostLoginWarmupTriggerSource,
} from "../../../electron/shared/DesktopContracts";

let warmupRequest: Promise<void> | undefined;
let warmupCompleted = false;

function createWarmupRequest(triggerSource: DesktopPostLoginWarmupTriggerSource): DesktopPostLoginWarmupRequest {
  return Object.freeze({
    triggerSource,
    requestedAt: new Date().toISOString(),
  });
}

export async function requestDesktopPostLoginWarmup(
  triggerSource: DesktopPostLoginWarmupTriggerSource,
): Promise<void> {
  const runtimeBridge = window.aiLoomDesktop?.runtime;
  if (!runtimeBridge?.startPostLoginWarmup) {
    return;
  }
  if (warmupCompleted) {
    console.info(`[ai-loom] Skipping duplicate post-login warmup request from '${triggerSource}' (already completed).`);
    return;
  }
  if (warmupRequest) {
    console.info(`[ai-loom] Coalescing post-login warmup request from '${triggerSource}' (warmup already running).`);
    await warmupRequest;
    return;
  }

  const request = createWarmupRequest(triggerSource);
  console.info(`[ai-loom] Requesting post-login warmup from '${request.triggerSource}'.`);

  warmupRequest = runtimeBridge.startPostLoginWarmup(request)
    .then(() => {
      warmupCompleted = true;
      console.info(`[ai-loom] Post-login warmup acknowledged for '${request.triggerSource}'.`);
    })
    .catch((error: unknown) => {
      console.warn("Desktop post-login warmup request failed.", error);
    })
    .finally(() => {
      warmupRequest = undefined;
    });
  await warmupRequest;
}

export function resetDesktopPostLoginWarmupStateForTests(): void {
  warmupRequest = undefined;
  warmupCompleted = false;
}

export {
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginWarmupTriggerSource,
};
