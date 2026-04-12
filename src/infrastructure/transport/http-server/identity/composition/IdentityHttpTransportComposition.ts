import {
  createIdentityHttpTransportAdapter,
  type IdentityHttpTransportAdapter,
  type IdentityHttpTransportServerFactory,
} from "../adapters/IdentityHttpTransportAdapterContracts";
import type { AuthoritativeApiRouteRegistrationPlan } from "../../AuthoritativeApiRouteRegistration";
import {
  createIdentityHttpRouteModuleRegistry,
  type IdentityHttpRouteFamilyModule,
  type IdentityHttpRouteModuleRegistry,
} from "./RouteModuleRegistry";
import { DefaultIdentityHttpRouteFamilyModules } from "../route-families/AuthoritativeIdentityRouteFamilyModules";

export interface IdentityHttpTransportComposition {
  readonly routeRegistrationPlan: AuthoritativeApiRouteRegistrationPlan;
  readonly routeModuleRegistry: IdentityHttpRouteModuleRegistry;
  readonly serverAdapter: IdentityHttpTransportAdapter;
}

export function composeIdentityHttpTransport(input: {
  readonly routeRegistrationPlan: AuthoritativeApiRouteRegistrationPlan;
  readonly serverFactory: IdentityHttpTransportServerFactory;
  readonly routeFamilyModules?: ReadonlyArray<IdentityHttpRouteFamilyModule>;
}): IdentityHttpTransportComposition {
  const routeModuleRegistry = createIdentityHttpRouteModuleRegistry({
    routeRegistrationPlan: input.routeRegistrationPlan,
    routeFamilyModules: input.routeFamilyModules ?? DefaultIdentityHttpRouteFamilyModules,
    requireModuleCoverage: true,
  });

  return Object.freeze({
    routeRegistrationPlan: input.routeRegistrationPlan,
    routeModuleRegistry,
    serverAdapter: createIdentityHttpTransportAdapter({
      createServer: input.serverFactory,
    }),
  });
}
