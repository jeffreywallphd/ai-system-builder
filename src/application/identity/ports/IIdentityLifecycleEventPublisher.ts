import type { IdentityLifecycleEvent } from "../../contracts/IdentityLifecycleEventContracts";

export interface IIdentityLifecycleEventPublisher {
  publish(event: IdentityLifecycleEvent): Promise<void>;
}
