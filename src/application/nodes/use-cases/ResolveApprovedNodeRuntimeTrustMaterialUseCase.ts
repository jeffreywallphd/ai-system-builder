import type { RuntimeTrustMaterialPackageViewDto } from "@shared/dto/security/CertificateAuthorityDtos";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import {
  ResolveRuntimeTrustMaterialPackageErrorCodes,
  type ResolveRuntimeTrustMaterialPackageUseCase,
} from "../../security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";
import {
  DefaultNodeTrustUseCaseIdGenerator,
  NodeTrustUseCaseErrorCodes,
  NodeTrustUseCaseIdNamespaces,
  type NodeTrustUseCaseClock,
  type NodeTrustUseCaseIdGenerator,
  type NodeTrustUseCaseOutcome,
  enforceNodeAuthenticatedOperationTrust,
  normalizeOptional,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface ResolveApprovedNodeRuntimeTrustMaterialUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly workspaceId?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly includeLeafCertificate?: boolean;
  readonly includeCertificateChain?: boolean;
  readonly includeTrustBundle?: boolean;
  readonly includeProtectedReferences?: boolean;
  readonly occurredAt?: string;
}

export interface ResolveApprovedNodeRuntimeTrustMaterialUseCaseResponse {
  readonly runtimeTrustMaterial: RuntimeTrustMaterialPackageViewDto;
}

interface ResolveApprovedNodeRuntimeTrustMaterialUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly runtimeTrustMaterialResolver?: ResolveRuntimeTrustMaterialPackageUseCase;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
}

export class ResolveApprovedNodeRuntimeTrustMaterialUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: ResolveApprovedNodeRuntimeTrustMaterialUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ResolveApprovedNodeRuntimeTrustMaterialUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<ResolveApprovedNodeRuntimeTrustMaterialUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "nodeId is required.");
    }

    if (actorUserIdentityId !== nodeId) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        "Node runtime trust material retrieval requires actorUserIdentityId to match nodeId.",
      );
    }

    if (request.includeProtectedReferences === true) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidRequest,
        "Node runtime trust material retrieval does not allow includeProtectedReferences=true.",
      );
    }

    if (!this.dependencies.runtimeTrustMaterialResolver) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.conflict,
        "Managed runtime trust material retrieval is not available in this runtime composition.",
      );
    }

    const node = await this.dependencies.nodeRepository.findNodeById(nodeId);
    if (!node) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.notFound, `Node '${nodeId}' was not found.`);
    }

    const trustFailure = enforceNodeAuthenticatedOperationTrust(node, "retrieve managed runtime trust material");
    if (trustFailure) {
      return trustFailure;
    }

    const runtimePackage = await this.dependencies.runtimeTrustMaterialResolver.execute({
      operationKey: `resolve-node-runtime-trust-material:${
        this.idGenerator.nextId(NodeTrustUseCaseIdNamespaces.mutationOperation)
      }`,
      actorUserIdentityId,
      targetKind: "node",
      targetReferenceId: nodeId,
      workspaceId: normalizeOptional(request.workspaceId),
      certificateAuthorityId: normalizeOptional(request.certificateAuthorityId),
      serialNumber: normalizeOptional(request.serialNumber),
      includeLeafCertificate: request.includeLeafCertificate,
      includeCertificateChain: request.includeCertificateChain,
      includeTrustBundle: request.includeTrustBundle,
      includeProtectedReferences: false,
      occurredAt: normalizeOptional(request.occurredAt) ?? this.clock.now().toISOString(),
    });

    if (!runtimePackage.ok) {
      if (runtimePackage.error.code === ResolveRuntimeTrustMaterialPackageErrorCodes.invalidRequest) {
        return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, runtimePackage.error.message);
      }
      if (runtimePackage.error.code === ResolveRuntimeTrustMaterialPackageErrorCodes.forbidden) {
        return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.forbidden, runtimePackage.error.message);
      }
      if (runtimePackage.error.code === ResolveRuntimeTrustMaterialPackageErrorCodes.notFound) {
        return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.notFound, runtimePackage.error.message);
      }

      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.conflict, runtimePackage.error.message);
    }

    return {
      ok: true,
      value: Object.freeze({
        runtimeTrustMaterial: Object.freeze({
          ...runtimePackage.value,
          protectedReferences: Object.freeze(runtimePackage.value.protectedReferences),
        }),
      }),
    };
  }
}

