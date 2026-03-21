import type { ManagedModelLibrarySnapshot } from "../../models/ManagedModelLibrary";

export interface IManagedModelLibrary {
  inspectLibrary(): Promise<ManagedModelLibrarySnapshot>;
}
