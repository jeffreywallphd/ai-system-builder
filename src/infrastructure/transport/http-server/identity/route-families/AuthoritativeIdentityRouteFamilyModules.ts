import type { AuthoritativeApiRouteFamilyRegistration } from "../../AuthoritativeApiRouteRegistration";
import { AssetManagementAuthoritativeApiRouteFamily } from "../../authoritative-route-families/AssetAuthoritativeApiRoutes";
import { ImageAssetManagementAuthoritativeApiRouteFamily } from "../../authoritative-route-families/ImageAssetAuthoritativeApiRoutes";
import { AuditLedgerAuthoritativeApiRouteFamily } from "../../authoritative-route-families/AuditAuthoritativeApiRoutes";
import { AuthorizationAuthoritativeApiRouteFamily } from "../../authoritative-route-families/AuthorizationAuthoritativeApiRoutes";
import {
  DeploymentPolicyReadAuthoritativeApiRouteFamily,
  DeploymentPolicyWriteAuthoritativeApiRouteFamily,
} from "../../authoritative-route-families/DeploymentAuthoritativeApiRoutes";
import { IdentityAuthoritativeApiRouteFamily } from "../../authoritative-route-families/IdentityAuthoritativeApiRoutes";
import { ExecutionNodeManagementAuthoritativeApiRouteFamily } from "../../authoritative-route-families/ExecutionNodeManagementAuthoritativeApiRoutes";
import { NodeTrustAuthoritativeApiRouteFamily } from "../../authoritative-route-families/NodeTrustAuthoritativeApiRoutes";
import {
  SecurityCertificateAuthoritativeApiRouteFamily,
  SecuritySecretMetadataAuthoritativeApiRouteFamily,
} from "../../authoritative-route-families/SecurityAuthoritativeApiRoutes";
import { StorageManagementAuthoritativeApiRouteFamily } from "../../authoritative-route-families/StorageAuthoritativeApiRoutes";
import {
  ImageRunAuthoritativeApiRouteFamily,
  RunExecutionUpdateAuthoritativeApiRouteFamily,
  RunMutationAuthoritativeApiRouteFamily,
  RunReadAuthoritativeApiRouteFamily,
  RunSubmissionAuthoritativeApiRouteFamily,
  RuntimeAuthoritativeApiRouteFamily,
} from "../../authoritative-route-families/RuntimeAuthoritativeApiRoutes";
import {
  WorkspaceAdministrationAuthoritativeApiRouteFamily,
  WorkspaceInvitationAuthoritativeApiRouteFamily,
} from "../../authoritative-route-families/WorkspaceAuthoritativeApiRoutes";
import type { IdentityHttpRouteModuleRegistrar, IdentityHttpRouteFamilyModule } from "../composition/RouteModuleRegistry";

function createRouteFamilyModule(
  routeFamily: AuthoritativeApiRouteFamilyRegistration,
): IdentityHttpRouteFamilyModule {
  return Object.freeze({
    routeFamily,
    register(registrar: IdentityHttpRouteModuleRegistrar): void {
      for (const routePrefix of routeFamily.routePrefixes) {
        registrar.registerRoutePrefix(routePrefix);
      }
    },
  });
}

export const IdentityAuthRouteFamilyModule = createRouteFamilyModule(IdentityAuthoritativeApiRouteFamily);
export const WorkspaceInvitationRouteFamilyModule = createRouteFamilyModule(
  WorkspaceInvitationAuthoritativeApiRouteFamily,
);
export const WorkspaceAdministrationRouteFamilyModule = createRouteFamilyModule(
  WorkspaceAdministrationAuthoritativeApiRouteFamily,
);
export const AuthorizationManagementRouteFamilyModule = createRouteFamilyModule(
  AuthorizationAuthoritativeApiRouteFamily,
);
export const DeploymentPolicyReadRouteFamilyModule = createRouteFamilyModule(
  DeploymentPolicyReadAuthoritativeApiRouteFamily,
);
export const DeploymentPolicyWriteRouteFamilyModule = createRouteFamilyModule(
  DeploymentPolicyWriteAuthoritativeApiRouteFamily,
);
export const AuditLedgerRouteFamilyModule = createRouteFamilyModule(AuditLedgerAuthoritativeApiRouteFamily);
export const NodeTrustRouteFamilyModule = createRouteFamilyModule(NodeTrustAuthoritativeApiRouteFamily);
export const ExecutionNodeManagementRouteFamilyModule = createRouteFamilyModule(
  ExecutionNodeManagementAuthoritativeApiRouteFamily,
);
export const SecurityCertificateOperationsRouteFamilyModule = createRouteFamilyModule(
  SecurityCertificateAuthoritativeApiRouteFamily,
);
export const SecuritySecretMetadataRouteFamilyModule = createRouteFamilyModule(
  SecuritySecretMetadataAuthoritativeApiRouteFamily,
);
export const StorageManagementRouteFamilyModule = createRouteFamilyModule(
  StorageManagementAuthoritativeApiRouteFamily,
);
export const AssetManagementRouteFamilyModule = createRouteFamilyModule(AssetManagementAuthoritativeApiRouteFamily);
export const ImageAssetManagementRouteFamilyModule = createRouteFamilyModule(
  ImageAssetManagementAuthoritativeApiRouteFamily,
);
export const RuntimeRouteFamilyModule = createRouteFamilyModule(RuntimeAuthoritativeApiRouteFamily);
export const RunSubmissionRouteFamilyModule = createRouteFamilyModule(RunSubmissionAuthoritativeApiRouteFamily);
export const RunReadRouteFamilyModule = createRouteFamilyModule(RunReadAuthoritativeApiRouteFamily);
export const RunMutationRouteFamilyModule = createRouteFamilyModule(RunMutationAuthoritativeApiRouteFamily);
export const RunExecutionUpdateRouteFamilyModule = createRouteFamilyModule(
  RunExecutionUpdateAuthoritativeApiRouteFamily,
);
export const ImageRunRouteFamilyModule = createRouteFamilyModule(ImageRunAuthoritativeApiRouteFamily);

export const DefaultIdentityHttpRouteFamilyModules = Object.freeze<ReadonlyArray<IdentityHttpRouteFamilyModule>>([
  IdentityAuthRouteFamilyModule,
  WorkspaceInvitationRouteFamilyModule,
  WorkspaceAdministrationRouteFamilyModule,
  AuthorizationManagementRouteFamilyModule,
  DeploymentPolicyReadRouteFamilyModule,
  DeploymentPolicyWriteRouteFamilyModule,
  AuditLedgerRouteFamilyModule,
  NodeTrustRouteFamilyModule,
  ExecutionNodeManagementRouteFamilyModule,
  SecurityCertificateOperationsRouteFamilyModule,
  SecuritySecretMetadataRouteFamilyModule,
  StorageManagementRouteFamilyModule,
  AssetManagementRouteFamilyModule,
  ImageAssetManagementRouteFamilyModule,
  RunSubmissionRouteFamilyModule,
  RunReadRouteFamilyModule,
  RunMutationRouteFamilyModule,
  ImageRunRouteFamilyModule,
  RunExecutionUpdateRouteFamilyModule,
  RuntimeRouteFamilyModule,
]);
