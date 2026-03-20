import type {
  ManagedServiceDescriptor,
  ManagedServiceLogListener,
  ManagedServiceStatus,
  ManagedServiceStatusListener,
  ManagedServiceSubscription,
} from "./ManagedServiceTypes";

export interface IManagedServiceManager {
  listServices(): ReadonlyArray<ManagedServiceDescriptor>;
  getServiceStatus(serviceId: string): ManagedServiceStatus | undefined;
  subscribeToStatus(serviceId: string, listener: ManagedServiceStatusListener): ManagedServiceSubscription;
  subscribeToLogs(serviceId: string, listener: ManagedServiceLogListener): ManagedServiceSubscription;
}
