import {
  AuthorizationPermissionCatalog,
  type AuthorizationActionFor,
  type AuthorizationResourceFamily,
  type CatalogPermissionKey,
} from "./AuthorizationPermissionCatalog";

export class AuthorizationRoleDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationRoleDefinitionError";
  }
}

export const AuthorizationRoleGrantStrategies = Object.freeze({
  static: "static",
  policyInfluenced: "policy-influenced",
});

export type AuthorizationRoleGrantStrategy =
  typeof AuthorizationRoleGrantStrategies[keyof typeof AuthorizationRoleGrantStrategies];

export const WorkspaceAuthorizationRoleKeys = Object.freeze({
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
});

export type WorkspaceAuthorizationRoleKey =
  typeof WorkspaceAuthorizationRoleKeys[keyof typeof WorkspaceAuthorizationRoleKeys];

export interface AuthorizationRoleDefinition {
  readonly key: WorkspaceAuthorizationRoleKey;
  readonly scope: "workspace";
  readonly grantStrategy: AuthorizationRoleGrantStrategy;
  readonly baselinePermissionKeys: ReadonlyArray<CatalogPermissionKey>;
}

export interface AuthorizationRoleCatalog {
  readonly version: 1;
  readonly deploymentProfileId: string;
  readonly roleKeys: ReadonlyArray<WorkspaceAuthorizationRoleKey>;
  readonly roleDefinitions: Readonly<Record<WorkspaceAuthorizationRoleKey, AuthorizationRoleDefinition>>;
}

export interface AuthorizationRolePermissionOverride {
  readonly grantStrategy?: AuthorizationRoleGrantStrategy;
  readonly addPermissionKeys?: ReadonlyArray<CatalogPermissionKey>;
  readonly removePermissionKeys?: ReadonlyArray<CatalogPermissionKey>;
}

export interface AuthorizationRoleCatalogOverrides {
  readonly deploymentProfileId: string;
  readonly rolePermissionOverrides: Readonly<Partial<Record<WorkspaceAuthorizationRoleKey, AuthorizationRolePermissionOverride>>>;
}

export interface WorkspaceMembershipAuthorizationSemantics {
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly roleKeys: ReadonlyArray<WorkspaceAuthorizationRoleKey>;
  readonly baselinePermissionKeys: ReadonlyArray<CatalogPermissionKey>;
  readonly permissionSources: ReadonlyArray<Readonly<{
    readonly roleKey: WorkspaceAuthorizationRoleKey;
    readonly permissionKey: CatalogPermissionKey;
  }>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AuthorizationRoleDefinitionError(`${field} is required.`);
  }
  return normalized;
}

function createPermissionSet(
  resourceFamily: AuthorizationResourceFamily,
  actions: ReadonlyArray<AuthorizationActionFor<AuthorizationResourceFamily>>,
): ReadonlyArray<CatalogPermissionKey> {
  const validActions = new Set<string>(AuthorizationPermissionCatalog.matrix[resourceFamily]);
  const resourcePermissions = AuthorizationPermissionCatalog.resources[resourceFamily] as Readonly<Record<string, CatalogPermissionKey>>;
  const keys: CatalogPermissionKey[] = [];
  for (const action of actions) {
    if (!validActions.has(action)) {
      throw new AuthorizationRoleDefinitionError(
        `Action '${action}' is not defined for resource family '${resourceFamily}'.`,
      );
    }
    keys.push(resourcePermissions[action]);
  }
  return Object.freeze(keys);
}

function mergePermissionSets(...sets: ReadonlyArray<ReadonlyArray<CatalogPermissionKey>>): ReadonlyArray<CatalogPermissionKey> {
  const deduped = new Set<CatalogPermissionKey>();
  for (const set of sets) {
    for (const permissionKey of set) {
      deduped.add(permissionKey);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function assertCatalogPermissionKey(value: string): asserts value is CatalogPermissionKey {
  if (!AuthorizationPermissionCatalog.keySet.has(value as CatalogPermissionKey)) {
    throw new AuthorizationRoleDefinitionError(`Permission key '${value}' is not defined in AuthorizationPermissionCatalog.`);
  }
}

function buildBaselineRoleDefinitions(): Readonly<Record<WorkspaceAuthorizationRoleKey, AuthorizationRoleDefinition>> {
  const allPermissionKeys = AuthorizationPermissionCatalog.keys;

  const publishLifecyclePermissions = allPermissionKeys.filter((permissionKey) => (
    permissionKey.endsWith(".publish") || permissionKey.endsWith(".unpublish")
  ));

  const adminPermissions = allPermissionKeys.filter((permissionKey) => !publishLifecyclePermissions.includes(permissionKey));

  const viewerPermissions = mergePermissionSets(
    createPermissionSet("asset", ["read"]),
    createPermissionSet("system", ["read"]),
    createPermissionSet("workflow", ["read"]),
    createPermissionSet("template", ["read"]),
    createPermissionSet("run", ["read", "list"]),
    createPermissionSet("queue", ["read"]),
    createPermissionSet("log", ["read", "list"]),
    createPermissionSet("storage-instance", ["read"]),
    createPermissionSet("secret-metadata", ["read", "list"]),
    createPermissionSet("artifact", ["read"]),
  );

  const memberPermissions = mergePermissionSets(
    viewerPermissions,
    createPermissionSet("asset", ["create", "update", "share"]),
    createPermissionSet("system", ["execute"]),
    createPermissionSet("workflow", ["create", "update", "run", "cancel"]),
    createPermissionSet("template", ["create", "update", "instantiate"]),
    createPermissionSet("run", ["cancel", "retry"]),
    createPermissionSet("queue", ["enqueue", "cancel"]),
    createPermissionSet("log", ["export"]),
    createPermissionSet("storage-instance", ["mount", "unmount"]),
    createPermissionSet("artifact", ["create", "update", "share"]),
  );

  return Object.freeze({
    [WorkspaceAuthorizationRoleKeys.owner]: Object.freeze({
      key: WorkspaceAuthorizationRoleKeys.owner,
      scope: "workspace",
      grantStrategy: AuthorizationRoleGrantStrategies.static,
      baselinePermissionKeys: Object.freeze([...allPermissionKeys]),
    }),
    [WorkspaceAuthorizationRoleKeys.admin]: Object.freeze({
      key: WorkspaceAuthorizationRoleKeys.admin,
      scope: "workspace",
      grantStrategy: AuthorizationRoleGrantStrategies.static,
      baselinePermissionKeys: Object.freeze([...adminPermissions]),
    }),
    [WorkspaceAuthorizationRoleKeys.member]: Object.freeze({
      key: WorkspaceAuthorizationRoleKeys.member,
      scope: "workspace",
      grantStrategy: AuthorizationRoleGrantStrategies.static,
      baselinePermissionKeys: memberPermissions,
    }),
    [WorkspaceAuthorizationRoleKeys.viewer]: Object.freeze({
      key: WorkspaceAuthorizationRoleKeys.viewer,
      scope: "workspace",
      grantStrategy: AuthorizationRoleGrantStrategies.static,
      baselinePermissionKeys: viewerPermissions,
    }),
  });
}

const BaselineWorkspaceAuthorizationRoleDefinitions = buildBaselineRoleDefinitions();

function applyRolePermissionOverrides(
  roleDefinitions: Readonly<Record<WorkspaceAuthorizationRoleKey, AuthorizationRoleDefinition>>,
  overrides?: AuthorizationRoleCatalogOverrides,
): Readonly<Record<WorkspaceAuthorizationRoleKey, AuthorizationRoleDefinition>> {
  if (!overrides) {
    return roleDefinitions;
  }

  const nextRoleDefinitions: Record<WorkspaceAuthorizationRoleKey, AuthorizationRoleDefinition> = {
    ...roleDefinitions,
  };

  for (const [roleKey, roleOverride] of Object.entries(overrides.rolePermissionOverrides)) {
    if (!roleOverride) {
      continue;
    }
    if (!isWorkspaceAuthorizationRoleKey(roleKey)) {
      throw new AuthorizationRoleDefinitionError(`Role override key '${roleKey}' is invalid.`);
    }

    const definition = roleDefinitions[roleKey];
    if (!definition) {
      throw new AuthorizationRoleDefinitionError(`Role override key '${roleKey}' is not defined.`);
    }

    const addPermissionKeys = roleOverride.addPermissionKeys ?? [];
    const removePermissionKeys = roleOverride.removePermissionKeys ?? [];

    for (const permissionKey of addPermissionKeys) {
      assertCatalogPermissionKey(permissionKey);
    }

    for (const permissionKey of removePermissionKeys) {
      assertCatalogPermissionKey(permissionKey);
    }

    const effectivePermissions = new Set<CatalogPermissionKey>(definition.baselinePermissionKeys);
    for (const permissionKey of addPermissionKeys) {
      effectivePermissions.add(permissionKey);
    }
    for (const permissionKey of removePermissionKeys) {
      effectivePermissions.delete(permissionKey);
    }

    nextRoleDefinitions[roleKey] = Object.freeze({
      ...definition,
      grantStrategy: roleOverride.grantStrategy ?? definition.grantStrategy,
      baselinePermissionKeys: Object.freeze([...effectivePermissions.values()]),
    });
  }

  return Object.freeze(nextRoleDefinitions);
}

export function isWorkspaceAuthorizationRoleKey(value: string): value is WorkspaceAuthorizationRoleKey {
  return Object.values(WorkspaceAuthorizationRoleKeys).includes(value as WorkspaceAuthorizationRoleKey);
}

export function createAuthorizationRoleCatalog(overrides?: AuthorizationRoleCatalogOverrides): AuthorizationRoleCatalog {
  const deploymentProfileId = normalizeRequired(overrides?.deploymentProfileId ?? "default", "Authorization role deploymentProfileId");
  const roleDefinitions = applyRolePermissionOverrides(BaselineWorkspaceAuthorizationRoleDefinitions, overrides);
  const roleKeys = Object.freeze(Object.values(WorkspaceAuthorizationRoleKeys));

  return Object.freeze({
    version: 1 as const,
    deploymentProfileId,
    roleKeys,
    roleDefinitions,
  });
}

export const AuthorizationRoleCatalog = createAuthorizationRoleCatalog();

export function normalizeWorkspaceMembershipRoleKeys(
  roleKeys: ReadonlyArray<string>,
): ReadonlyArray<WorkspaceAuthorizationRoleKey> {
  if (roleKeys.length === 0) {
    throw new AuthorizationRoleDefinitionError("Workspace membership authorization requires at least one role assignment.");
  }

  const deduped = new Set<WorkspaceAuthorizationRoleKey>();
  for (const roleKey of roleKeys) {
    const normalized = normalizeRequired(roleKey, "Workspace membership roleKey");
    if (!isWorkspaceAuthorizationRoleKey(normalized)) {
      throw new AuthorizationRoleDefinitionError(`Workspace membership roleKey '${normalized}' is invalid.`);
    }
    deduped.add(normalized);
  }

  return Object.freeze([...deduped.values()]);
}

export function createWorkspaceMembershipAuthorizationSemantics(input: {
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly roleKeys: ReadonlyArray<string>;
  readonly roleCatalog?: AuthorizationRoleCatalog;
}): WorkspaceMembershipAuthorizationSemantics {
  const workspaceId = normalizeRequired(input.workspaceId, "Workspace membership workspaceId");
  const userIdentityId = normalizeRequired(input.userIdentityId, "Workspace membership userIdentityId");
  const roleKeys = normalizeWorkspaceMembershipRoleKeys(input.roleKeys);

  const roleCatalog = input.roleCatalog ?? AuthorizationRoleCatalog;

  const permissionSources: Array<{ roleKey: WorkspaceAuthorizationRoleKey; permissionKey: CatalogPermissionKey }> = [];
  for (const roleKey of roleKeys) {
    const definition = roleCatalog.roleDefinitions[roleKey];
    if (!definition) {
      throw new AuthorizationRoleDefinitionError(`Workspace membership roleKey '${roleKey}' is not configured in role catalog.`);
    }

    for (const permissionKey of definition.baselinePermissionKeys) {
      permissionSources.push({
        roleKey,
        permissionKey,
      });
    }
  }

  const baselinePermissionKeys = Object.freeze([
    ...new Set(permissionSources.map((source) => source.permissionKey)).values(),
  ]);

  return Object.freeze({
    workspaceId,
    userIdentityId,
    roleKeys,
    baselinePermissionKeys,
    permissionSources: Object.freeze(permissionSources.map((source) => Object.freeze(source))),
  });
}
