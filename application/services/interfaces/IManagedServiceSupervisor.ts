import type { ManagedServiceStatus } from "./ManagedServiceTypes";

export interface IManagedServiceSupervisor {
  ensureRunning(serviceId: string): Promise<ManagedServiceStatus>;
  start(serviceId: string): Promise<ManagedServiceStatus>;
  stop(serviceId: string): Promise<ManagedServiceStatus>;
  restart(serviceId: string): Promise<ManagedServiceStatus>;
  provision(serviceId: string): Promise<ManagedServiceStatus>;
  repair(serviceId: string): Promise<ManagedServiceStatus>;
  recreateEnvironment(serviceId: string): Promise<ManagedServiceStatus>;
}
