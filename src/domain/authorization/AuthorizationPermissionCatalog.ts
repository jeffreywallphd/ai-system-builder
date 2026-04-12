import { createPermissionKey, type PermissionKey } from "./AuthorizationDomain";

export const AuthorizationResourceFamilies = Object.freeze({
  asset: "asset",
  system: "system",
  workflow: "workflow",
  template: "template",
  run: "run",
  queue: "queue",
  log: "log",
  storageInstance: "storage-instance",
  secretMetadata: "secret-metadata",
  artifact: "artifact",
});

export const AuthorizationPermissionActionMatrix = Object.freeze({
  [AuthorizationResourceFamilies.asset]: Object.freeze([
    "read",
    "create",
    "update",
    "delete",
    "share",
    "publish",
    "unpublish",
    "manage",
  ]),
  [AuthorizationResourceFamilies.system]: Object.freeze([
    "read",
    "create",
    "update",
    "delete",
    "share",
    "execute",
    "publish",
    "unpublish",
    "manage",
  ]),
  [AuthorizationResourceFamilies.workflow]: Object.freeze([
    "read",
    "create",
    "update",
    "delete",
    "share",
    "run",
    "cancel",
    "manage",
  ]),
  [AuthorizationResourceFamilies.template]: Object.freeze([
    "read",
    "create",
    "update",
    "delete",
    "share",
    "instantiate",
    "publish",
    "unpublish",
    "manage",
  ]),
  [AuthorizationResourceFamilies.run]: Object.freeze([
    "read",
    "list",
    "cancel",
    "retry",
    "delete",
    "manage",
  ]),
  [AuthorizationResourceFamilies.queue]: Object.freeze([
    "read",
    "enqueue",
    "dequeue",
    "cancel",
    "manage",
  ]),
  [AuthorizationResourceFamilies.log]: Object.freeze([
    "read",
    "list",
    "export",
    "redact",
    "delete",
    "manage",
  ]),
  [AuthorizationResourceFamilies.storageInstance]: Object.freeze([
    "read",
    "create",
    "update",
    "delete",
    "mount",
    "unmount",
    "manage",
  ]),
  [AuthorizationResourceFamilies.secretMetadata]: Object.freeze([
    "read",
    "list",
    "create",
    "update",
    "delete",
    "share",
    "manage",
  ]),
  [AuthorizationResourceFamilies.artifact]: Object.freeze([
    "read",
    "create",
    "update",
    "delete",
    "share",
    "publish",
    "unpublish",
    "manage",
  ]),
} as const);

export type AuthorizationResourceFamily = keyof typeof AuthorizationPermissionActionMatrix;

export type AuthorizationActionFor<TResourceFamily extends AuthorizationResourceFamily> =
  (typeof AuthorizationPermissionActionMatrix)[TResourceFamily][number];

export type CatalogPermissionKeyFor<
  TResourceFamily extends AuthorizationResourceFamily,
  TAction extends AuthorizationActionFor<TResourceFamily>,
> = `${TResourceFamily}.${TAction}`;

export type CatalogPermissionKey = {
  [TResourceFamily in AuthorizationResourceFamily]:
  CatalogPermissionKeyFor<TResourceFamily, AuthorizationActionFor<TResourceFamily>>;
}[AuthorizationResourceFamily];

type PermissionLookupByResource = {
  readonly [TResourceFamily in AuthorizationResourceFamily]: Readonly<{
    readonly [TAction in AuthorizationActionFor<TResourceFamily>]: CatalogPermissionKeyFor<TResourceFamily, TAction>;
  }>;
};

interface AuthorizationPermissionCatalogShape {
  readonly version: 1;
  readonly namingConvention: "<resource-family>.<action>";
  readonly matrix: typeof AuthorizationPermissionActionMatrix;
  readonly resources: PermissionLookupByResource;
  readonly keys: ReadonlyArray<CatalogPermissionKey>;
  readonly keySet: ReadonlySet<CatalogPermissionKey>;
}

function createCatalogPermissionKeyInternal(
  resourceFamily: string,
  action: string,
): PermissionKey {
  return createPermissionKey(`${resourceFamily}.${action}`);
}

function createAuthorizationPermissionCatalog(): AuthorizationPermissionCatalogShape {
  const resourcesByFamily = {} as {
    -readonly [TResourceFamily in AuthorizationResourceFamily]: {
      -readonly [TAction in AuthorizationActionFor<TResourceFamily>]: CatalogPermissionKeyFor<TResourceFamily, TAction>;
    };
  };

  const keys: CatalogPermissionKey[] = [];
  const keySet = new Set<CatalogPermissionKey>();

  for (const [resourceFamily, actions] of Object.entries(AuthorizationPermissionActionMatrix)) {
    const familyPermissionMap: Record<string, CatalogPermissionKey> = {};

    for (const action of actions) {
      const key = createCatalogPermissionKeyInternal(resourceFamily, action) as CatalogPermissionKey;
      if (keySet.has(key)) {
        throw new Error(`Duplicate catalog permission key '${key}' is not allowed.`);
      }
      familyPermissionMap[action] = key;
      keySet.add(key);
      keys.push(key);
    }

    resourcesByFamily[resourceFamily as AuthorizationResourceFamily] = Object.freeze(familyPermissionMap) as never;
  }

  return Object.freeze({
    version: 1 as const,
    namingConvention: "<resource-family>.<action>" as const,
    matrix: AuthorizationPermissionActionMatrix,
    resources: Object.freeze(resourcesByFamily),
    keys: Object.freeze(keys),
    keySet: keySet as ReadonlySet<CatalogPermissionKey>,
  });
}

export const AuthorizationPermissionCatalog = createAuthorizationPermissionCatalog();

export function createCatalogPermissionKey<
  TResourceFamily extends AuthorizationResourceFamily,
  TAction extends AuthorizationActionFor<TResourceFamily>,
>(
  resourceFamily: TResourceFamily,
  action: TAction,
): CatalogPermissionKeyFor<TResourceFamily, TAction> {
  return AuthorizationPermissionCatalog.resources[resourceFamily][action];
}

export function isCatalogPermissionKey(value: string): value is CatalogPermissionKey {
  return AuthorizationPermissionCatalog.keySet.has(value as CatalogPermissionKey);
}

export function getCatalogActionsForResourceFamily<TResourceFamily extends AuthorizationResourceFamily>(
  resourceFamily: TResourceFamily,
): ReadonlyArray<AuthorizationActionFor<TResourceFamily>> {
  return AuthorizationPermissionCatalog.matrix[resourceFamily];
}
