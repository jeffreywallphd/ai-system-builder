import type { ManagedServiceStatus } from "./ManagedServiceTypes";

export interface IManagedServiceStatusRefresher {
  refreshServiceStatus(serviceId: string): Promise<ManagedServiceStatus>;
}
