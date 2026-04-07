import type { IdentityIdNamespace } from "../../contracts/IdentityApplicationContracts";

export interface IIdentityIdGenerator {
  nextId(namespace: IdentityIdNamespace): string;
}
