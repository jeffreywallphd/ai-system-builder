import type {
  AuthoritativeApiRouteFamilyRegistration,
  AuthoritativeApiRouteRegistrationPlan,
} from "../../AuthoritativeApiRouteRegistration";
import {
  type IdentityHttpRouteRegistrySnapshotDto,
  toIdentityHttpRouteFamilySummaryDto,
} from "../dto/IdentityHttpRouteRegistryDtos";
import { doesPathMatchRoutePrefix } from "../primitives/RoutePrefixMatcher";

export class IdentityHttpRouteModuleRegistryError extends Error {}

export interface IdentityHttpRouteModuleRegistrar {
  registerRoutePrefix(routePrefix: string): void;
}

export interface IdentityHttpRouteFamilyModule {
  readonly routeFamily: AuthoritativeApiRouteFamilyRegistration;
  register(registrar: IdentityHttpRouteModuleRegistrar): void;
}

export interface IdentityHttpRouteModuleRegistry {
  readonly routeRegistrationPlan: AuthoritativeApiRouteRegistrationPlan;
  readonly routeFamilies: ReadonlyArray<AuthoritativeApiRouteFamilyRegistration>;
  readonly routePrefixes: ReadonlyArray<{ readonly routeFamilyId: string; readonly routePrefix: string }>;
  resolveRouteFamilyByPath(path: string): AuthoritativeApiRouteFamilyRegistration | undefined;
  toSnapshot(): IdentityHttpRouteRegistrySnapshotDto;
}

export function createIdentityHttpRouteModuleRegistry(input: {
  readonly routeRegistrationPlan: AuthoritativeApiRouteRegistrationPlan;
  readonly routeFamilyModules: ReadonlyArray<IdentityHttpRouteFamilyModule>;
  readonly requireModuleCoverage?: boolean;
}): IdentityHttpRouteModuleRegistry {
  const moduleByFamilyId = new Map<string, IdentityHttpRouteFamilyModule>();
  for (const routeFamilyModule of input.routeFamilyModules) {
    const routeFamilyId = routeFamilyModule.routeFamily.routeFamilyId;
    if (moduleByFamilyId.has(routeFamilyId)) {
      throw new IdentityHttpRouteModuleRegistryError(
        `Duplicate identity HTTP route family module registration for '${routeFamilyId}'.`,
      );
    }
    moduleByFamilyId.set(routeFamilyId, routeFamilyModule);
  }

  const requireModuleCoverage = input.requireModuleCoverage ?? true;
  const routeFamilies: AuthoritativeApiRouteFamilyRegistration[] = [];
  const routePrefixes: Array<{ readonly routeFamilyId: string; readonly routePrefix: string }> = [];
  const plannedRouteFamilyIds = new Set<string>();
  const routeFamilyIdByRegisteredPrefix = new Map<string, string>();

  for (const plannedRouteFamily of input.routeRegistrationPlan.registeredRouteFamilies) {
    if (plannedRouteFamilyIds.has(plannedRouteFamily.routeFamilyId)) {
      throw new IdentityHttpRouteModuleRegistryError(
        `Identity HTTP route registration plan has duplicate route family '${plannedRouteFamily.routeFamilyId}'.`,
      );
    }
    plannedRouteFamilyIds.add(plannedRouteFamily.routeFamilyId);

    const module = moduleByFamilyId.get(plannedRouteFamily.routeFamilyId);
    if (!module) {
      if (requireModuleCoverage) {
        throw new IdentityHttpRouteModuleRegistryError(
          `Identity HTTP route module registry is missing module '${plannedRouteFamily.routeFamilyId}'.`,
        );
      }
      continue;
    }

    const collectedRoutePrefixes: string[] = [];
    module.register(Object.freeze({
      registerRoutePrefix(routePrefix: string): void {
        const normalizedRoutePrefix = routePrefix.trim();
        if (!normalizedRoutePrefix) {
          throw new IdentityHttpRouteModuleRegistryError(
            `Identity HTTP route module '${plannedRouteFamily.routeFamilyId}' registered an empty route prefix.`,
          );
        }
        if (!plannedRouteFamily.routePrefixes.includes(normalizedRoutePrefix)) {
          throw new IdentityHttpRouteModuleRegistryError(
            `Identity HTTP route module '${plannedRouteFamily.routeFamilyId}' registered non-canonical route prefix '${normalizedRoutePrefix}'.`,
          );
        }
        collectedRoutePrefixes.push(normalizedRoutePrefix);
      },
    }));

    const deduplicatedPrefixes = Array.from(new Set(collectedRoutePrefixes));
    if (deduplicatedPrefixes.length === 0) {
      throw new IdentityHttpRouteModuleRegistryError(
        `Identity HTTP route module '${plannedRouteFamily.routeFamilyId}' did not register any route prefixes.`,
      );
    }

    routeFamilies.push(plannedRouteFamily);
    for (const routePrefix of deduplicatedPrefixes) {
      const previouslyRegisteredFamilyId = routeFamilyIdByRegisteredPrefix.get(routePrefix);
      if (previouslyRegisteredFamilyId && previouslyRegisteredFamilyId !== plannedRouteFamily.routeFamilyId) {
        throw new IdentityHttpRouteModuleRegistryError(
          `Identity HTTP route prefix '${routePrefix}' is registered by both '${previouslyRegisteredFamilyId}' and '${plannedRouteFamily.routeFamilyId}'.`,
        );
      }
      routeFamilyIdByRegisteredPrefix.set(routePrefix, plannedRouteFamily.routeFamilyId);
      routePrefixes.push(Object.freeze({
        routeFamilyId: plannedRouteFamily.routeFamilyId,
        routePrefix,
      }));
    }
  }

  const routeFamilyById = new Map(routeFamilies.map((routeFamily) => [routeFamily.routeFamilyId, routeFamily] as const));

  return Object.freeze({
    routeRegistrationPlan: input.routeRegistrationPlan,
    routeFamilies: Object.freeze(routeFamilies),
    routePrefixes: Object.freeze(routePrefixes),
    resolveRouteFamilyByPath(path: string): AuthoritativeApiRouteFamilyRegistration | undefined {
      for (const registeredPrefix of routePrefixes) {
        if (!doesPathMatchRoutePrefix(path, registeredPrefix.routePrefix)) {
          continue;
        }
        return routeFamilyById.get(registeredPrefix.routeFamilyId);
      }
      return undefined;
    },
    toSnapshot(): IdentityHttpRouteRegistrySnapshotDto {
      return Object.freeze({
        routeFamilies: Object.freeze(routeFamilies.map((routeFamily) => toIdentityHttpRouteFamilySummaryDto(routeFamily))),
        routePrefixes: Object.freeze(routePrefixes.map((entry) => Object.freeze({
          routeFamilyId: entry.routeFamilyId,
          routePrefix: entry.routePrefix,
        }))),
      });
    },
  });
}
