import type { IdentityLifecycleEvent } from "../../contracts/IdentityLifecycleEventContracts";
import type { IIdentityLifecycleEventPublisher } from "../ports/IIdentityLifecycleEventPublisher";

export async function publishIdentityLifecycleEventBestEffort(
  publisher: IIdentityLifecycleEventPublisher | undefined,
  event: IdentityLifecycleEvent,
): Promise<void> {
  if (!publisher) {
    return;
  }

  try {
    await publisher.publish(event);
  } catch {
    // Identity lifecycle operations should not fail if audit/governance subscribers are unavailable.
  }
}
