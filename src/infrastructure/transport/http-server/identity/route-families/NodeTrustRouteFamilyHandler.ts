import { z } from "zod";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

export function createNodeTrustRouteFamilyHandler(deps: Record<string, unknown>): IdentityHttpRouteFamilyHandler {
  const d = deps as any;
  const options = d.options;
  const maxBodyBytes = d.maxBodyBytes;
  const parseAndValidateNodeEnrollmentSubmissionRequest = d.parseAndValidateNodeEnrollmentSubmissionRequest;
  const writeJson = d.writeJson;
  const mapNodeTrustStatusCode = d.mapNodeTrustStatusCode;
  const logResponse = d.logResponse;
  const requireAuthenticatedSession = d.requireAuthenticatedSession;
  const normalizeOptionalString = d.normalizeOptionalString;
  const parseOptionalInteger = d.parseOptionalInteger;
  const parseOptionalBoolean = d.parseOptionalBoolean;
  const buildNodeTrustQueryValidationError = d.buildNodeTrustQueryValidationError;
  const NodePendingEnrollmentStatusValues = d.NodePendingEnrollmentStatusValues;
  const NodeTypeValues = d.NodeTypeValues;
  const NodeCapabilityValues = d.NodeCapabilityValues;
  const NodeApprovalStatusValues = d.NodeApprovalStatusValues;
  const NodeInventoryOperationalStateValues = d.NodeInventoryOperationalStateValues;
  const NodeInventoryPresenceStateValues = d.NodeInventoryPresenceStateValues;
  const NodeEnrollmentRequestStatusValues = d.NodeEnrollmentRequestStatusValues;
  const buildNodeTrustInvalidRequestResponse = d.buildNodeTrustInvalidRequestResponse;
  const decodePathTail = d.decodePathTail;
  const parseAndValidateRevokeNodeTrustRequest = d.parseAndValidateRevokeNodeTrustRequest;
  const requireAuthenticatedNodeTransport = d.requireAuthenticatedNodeTransport;
  const resolveRequestSearchParams = d.resolveRequestSearchParams;
  const parseResolveNodeRuntimeTrustMaterialRequestDto = d.parseResolveNodeRuntimeTrustMaterialRequestDto;
  const NodeTrustApiSchemaValidationError = d.NodeTrustApiSchemaValidationError;
  const NodeTrustApiErrorCodes = d.NodeTrustApiErrorCodes;
  const parseAndValidateNodeHeartbeatRequest = d.parseAndValidateNodeHeartbeatRequest;
  const parseAndValidateNodeOperationalUpdateRequest = d.parseAndValidateNodeOperationalUpdateRequest;
  const parseAndValidateApproveNodeEnrollmentRequest = d.parseAndValidateApproveNodeEnrollmentRequest;
  const parseAndValidateRejectNodeEnrollmentRequest = d.parseAndValidateRejectNodeEnrollmentRequest;

  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    const searchParams = resolveRequestSearchParams(request.url);
      if (
        options.nodeTrustBackendApi
        && request.method === "POST"
        && path === "/api/v1/nodes/enrollments"
      ) {
        const parsedRequest = await parseAndValidateNodeEnrollmentSubmissionRequest(
          request,
          requestId,
          logger,
          maxBodyBytes,
        );
        if (!parsedRequest.ok) {
          writeJson(response, parsedRequest.statusCode, parsedRequest.body);
          return;
        }

        const apiResponse = await options.nodeTrustBackendApi.submitNodeEnrollment(parsedRequest.data);
        const statusCode = mapNodeTrustStatusCode(apiResponse);
        writeJson(response, statusCode, apiResponse);
        logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "GET"
        && path === "/api/v1/nodes/enrollments/pending"
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const statuses = url.searchParams.getAll("status");
            const statusValidation = z.array(NodePendingEnrollmentStatusValues).safeParse(statuses);
            if (!statusValidation.success) {
              const validationError = buildNodeTrustQueryValidationError("status", "status values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const apiResponse = await options.nodeTrustBackendApi.listPendingNodeEnrollments({
              actorUserIdentityId: context.principal.userIdentityId,
              nodeId: normalizeOptionalString(url.searchParams.get("nodeId")),
              statuses: statusValidation.data.length > 0 ? statusValidation.data : undefined,
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
            });
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "GET"
        && path === "/api/v1/nodes/trusted"
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const nodeTypes = url.searchParams.getAll("nodeType");
            const nodeTypeValidation = z.array(NodeTypeValues).safeParse(nodeTypes);
            if (!nodeTypeValidation.success) {
              const validationError = buildNodeTrustQueryValidationError("nodeType", "nodeType values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const capabilities = url.searchParams.getAll("capability");
            const capabilityValidation = z.array(NodeCapabilityValues).safeParse(capabilities);
            if (!capabilityValidation.success) {
              const validationError = buildNodeTrustQueryValidationError("capability", "capability values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const inventoryRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              nodeTypes: nodeTypeValidation.data.length > 0 ? nodeTypeValidation.data : undefined,
              capabilityAnyOf: capabilityValidation.data.length > 0 ? capabilityValidation.data : undefined,
              deploymentTagAnyOf: url.searchParams.getAll("deploymentTag"),
              lastSeenAfter: normalizeOptionalString(url.searchParams.get("lastSeenAfter")),
              lastSeenBefore: normalizeOptionalString(url.searchParams.get("lastSeenBefore")),
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
            });

            const apiResponse = await options.nodeTrustBackendApi.listTrustedNodeInventory(inventoryRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "GET"
        && path === "/api/v1/nodes/inventory"
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const nodeTypes = url.searchParams.getAll("nodeType");
            const nodeTypeValidation = z.array(NodeTypeValues).safeParse(nodeTypes);
            if (!nodeTypeValidation.success) {
              const validationError = buildNodeTrustQueryValidationError("nodeType", "nodeType values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const approvalStatuses = url.searchParams.getAll("approvalStatus");
            const approvalStatusValidation = z.array(NodeApprovalStatusValues).safeParse(approvalStatuses);
            if (!approvalStatusValidation.success) {
              const validationError = buildNodeTrustQueryValidationError("approvalStatus", "approvalStatus values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const operationalStates = url.searchParams.getAll("operationalState");
            const operationalStateValidation = z.array(NodeInventoryOperationalStateValues).safeParse(operationalStates);
            if (!operationalStateValidation.success) {
              const validationError = buildNodeTrustQueryValidationError(
                "operationalState",
                "operationalState values are invalid.",
              );
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const presenceStates = url.searchParams.getAll("presenceState");
            const presenceStateValidation = z.array(NodeInventoryPresenceStateValues).safeParse(presenceStates);
            if (!presenceStateValidation.success) {
              const validationError = buildNodeTrustQueryValidationError("presenceState", "presenceState values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const enrollmentStatuses = url.searchParams.getAll("enrollmentStatus");
            const enrollmentStatusValidation = z.array(NodeEnrollmentRequestStatusValues).safeParse(enrollmentStatuses);
            if (!enrollmentStatusValidation.success) {
              const validationError = buildNodeTrustQueryValidationError(
                "enrollmentStatus",
                "enrollmentStatus values are invalid.",
              );
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const capabilities = url.searchParams.getAll("capability");
            const capabilityValidation = z.array(NodeCapabilityValues).safeParse(capabilities);
            if (!capabilityValidation.success) {
              const validationError = buildNodeTrustQueryValidationError("capability", "capability values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const inventoryRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              nodeTypes: nodeTypeValidation.data.length > 0 ? nodeTypeValidation.data : undefined,
              approvalStatuses: approvalStatusValidation.data.length > 0 ? approvalStatusValidation.data : undefined,
              operationalStates: operationalStateValidation.data.length > 0 ? operationalStateValidation.data : undefined,
              enrollmentStatuses: enrollmentStatusValidation.data.length > 0 ? enrollmentStatusValidation.data : undefined,
              presenceStates: presenceStateValidation.data.length > 0 ? presenceStateValidation.data : undefined,
              capabilityAnyOf: capabilityValidation.data.length > 0 ? capabilityValidation.data : undefined,
              deploymentTagAnyOf: url.searchParams.getAll("deploymentTag"),
              lastSeenAfter: normalizeOptionalString(url.searchParams.get("lastSeenAfter")),
              lastSeenBefore: normalizeOptionalString(url.searchParams.get("lastSeenBefore")),
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
            });

            const apiResponse = await options.nodeTrustBackendApi.listNodeInventory(inventoryRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/nodes/inventory/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const nodeId = decodePathTail(path, "/api/v1/nodes/inventory/");
            if (!nodeId) {
              const invalid = buildNodeTrustInvalidRequestResponse("nodeId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const inventoryDetailRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              nodeId,
            });
            const apiResponse = await options.nodeTrustBackendApi.getNodeInventoryDetail(inventoryDetailRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, inventoryDetailRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "POST"
        && path.endsWith("/revoke")
        && path.startsWith("/api/v1/nodes/")
        && !path.startsWith("/api/v1/nodes/enrollments/")
        && !path.startsWith("/api/v1/nodes/inventory/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const nodeId = decodePathTail(path, "/api/v1/nodes/", "/revoke");
            if (!nodeId) {
              const invalid = buildNodeTrustInvalidRequestResponse("nodeId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateRevokeNodeTrustRequest(
              request,
              context.principal.userIdentityId,
              nodeId,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const revokeRequest = Object.freeze({
              actorUserIdentityId: parsedRequest.data.actorUserIdentityId,
              nodeId: parsedRequest.data.nodeId,
              reason: parsedRequest.data.reason,
              revokedAt: parsedRequest.data.revokedAt,
              note: parsedRequest.data.note,
              correlationId: parsedRequest.data.correlationId,
              metadata: parsedRequest.data.metadata,
            });
            const apiResponse = await options.nodeTrustBackendApi.revokeNodeTrust(revokeRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, revokeRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "GET"
        && path.endsWith("/runtime-trust-material")
        && path.startsWith("/api/v1/nodes/")
        && !path.startsWith("/api/v1/nodes/enrollments/")
      ) {
        const runtimeTrustMaterialNodeId = decodePathTail(path, "/api/v1/nodes/", "/runtime-trust-material");
        await requireAuthenticatedNodeTransport(
          request,
          response,
          requestId,
          options.backendApi,
          options.nodeTrustBackendApi,
          logger,
          options.transportTrust,
          runtimeTrustMaterialNodeId,
          async (context) => {
            const nodeId = context.nodeId;

            const includeLeafCertificateInput = searchParams.get("includeLeafCertificate");
            const includeCertificateChainInput = searchParams.get("includeCertificateChain");
            const includeTrustBundleInput = searchParams.get("includeTrustBundle");
            const includeLeafCertificate = parseOptionalBoolean(includeLeafCertificateInput);
            const includeCertificateChain = parseOptionalBoolean(includeCertificateChainInput);
            const includeTrustBundle = parseOptionalBoolean(includeTrustBundleInput);

            if (includeLeafCertificateInput !== null && includeLeafCertificate === undefined) {
              const invalid = buildNodeTrustQueryValidationError(
                "includeLeafCertificate",
                "includeLeafCertificate must be 'true' or 'false'.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                nodeId,
                includeLeafCertificate: includeLeafCertificateInput,
              }), invalid);
              return;
            }

            if (includeCertificateChainInput !== null && includeCertificateChain === undefined) {
              const invalid = buildNodeTrustQueryValidationError(
                "includeCertificateChain",
                "includeCertificateChain must be 'true' or 'false'.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                nodeId,
                includeCertificateChain: includeCertificateChainInput,
              }), invalid);
              return;
            }

            if (includeTrustBundleInput !== null && includeTrustBundle === undefined) {
              const invalid = buildNodeTrustQueryValidationError(
                "includeTrustBundle",
                "includeTrustBundle must be 'true' or 'false'.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                nodeId,
                includeTrustBundle: includeTrustBundleInput,
              }), invalid);
              return;
            }

            let runtimeTrustMaterialRequest;
            try {
              const parsedRequest = parseResolveNodeRuntimeTrustMaterialRequestDto({
                actorUserIdentityId: nodeId,
                nodeId,
                workspaceId: normalizeOptionalString(searchParams.get("workspaceId")),
                certificateAuthorityId: normalizeOptionalString(searchParams.get("certificateAuthorityId")),
                serialNumber: normalizeOptionalString(searchParams.get("serialNumber")),
                includeLeafCertificate,
                includeCertificateChain,
                includeTrustBundle,
                occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
              });
              runtimeTrustMaterialRequest = Object.freeze({
                actorUserIdentityId: parsedRequest.actorUserIdentityId,
                nodeId: parsedRequest.nodeId,
                workspaceId: parsedRequest.workspaceId,
                certificateAuthorityId: parsedRequest.certificateAuthorityId,
                serialNumber: parsedRequest.serialNumber,
                includeLeafCertificate: parsedRequest.includeLeafCertificate,
                includeCertificateChain: parsedRequest.includeCertificateChain,
                includeTrustBundle: parsedRequest.includeTrustBundle,
                occurredAt: parsedRequest.occurredAt,
              });
            } catch (error) {
              if (error instanceof NodeTrustApiSchemaValidationError) {
                const invalid = Object.freeze({
                  ok: false,
                  error: Object.freeze({
                    code: NodeTrustApiErrorCodes.invalidRequest,
                    message: "Request validation failed.",
                    validationErrors: Object.freeze(error.issues.map((issue) => Object.freeze({
                      path: issue.path,
                      code: issue.code,
                      message: issue.message,
                    }))),
                  }),
                });
                writeJson(response, 400, invalid);
                logResponse(logger, requestId, request, 400, Object.freeze({
                  nodeId,
                  query: Object.freeze({
                    workspaceId: normalizeOptionalString(searchParams.get("workspaceId")),
                    certificateAuthorityId: normalizeOptionalString(searchParams.get("certificateAuthorityId")),
                    serialNumber: normalizeOptionalString(searchParams.get("serialNumber")),
                    includeLeafCertificate: includeLeafCertificateInput,
                    includeCertificateChain: includeCertificateChainInput,
                    includeTrustBundle: includeTrustBundleInput,
                    occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
                  }),
                }), invalid);
                return;
              }

              const invalid = buildNodeTrustInvalidRequestResponse("Request validation failed.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                nodeId,
              }), invalid);
              return;
            }

            const apiResponse = await options.nodeTrustBackendApi.resolveNodeRuntimeTrustMaterial(runtimeTrustMaterialRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, runtimeTrustMaterialRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "POST"
        && path.endsWith("/heartbeat")
        && path.startsWith("/api/v1/nodes/")
        && !path.startsWith("/api/v1/nodes/enrollments/")
      ) {
        const heartbeatNodeId = decodePathTail(path, "/api/v1/nodes/", "/heartbeat");
        await requireAuthenticatedNodeTransport(
          request,
          response,
          requestId,
          options.backendApi,
          options.nodeTrustBackendApi,
          logger,
          options.transportTrust,
          heartbeatNodeId,
          async (context) => {
            const nodeId = context.nodeId;

            const parsedRequest = await parseAndValidateNodeHeartbeatRequest(
              request,
              nodeId,
              nodeId,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const heartbeatRequest = Object.freeze({
              actorUserIdentityId: parsedRequest.data.actorUserIdentityId,
              nodeId: parsedRequest.data.nodeId,
              heartbeatStatus: parsedRequest.data.heartbeatStatus,
              seenAt: parsedRequest.data.seenAt,
              observedBy: parsedRequest.data.observedBy,
              metadata: parsedRequest.data.metadata,
            });
            const apiResponse = await options.nodeTrustBackendApi.recordNodeHeartbeat(heartbeatRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, heartbeatRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "POST"
        && path.endsWith("/operational-update")
        && path.startsWith("/api/v1/nodes/")
        && !path.startsWith("/api/v1/nodes/enrollments/")
      ) {
        const operationalUpdateNodeId = decodePathTail(path, "/api/v1/nodes/", "/operational-update");
        await requireAuthenticatedNodeTransport(
          request,
          response,
          requestId,
          options.backendApi,
          options.nodeTrustBackendApi,
          logger,
          options.transportTrust,
          operationalUpdateNodeId,
          async (context) => {
            const nodeId = context.nodeId;

            const parsedRequest = await parseAndValidateNodeOperationalUpdateRequest(
              request,
              nodeId,
              nodeId,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const operationalUpdateRequest = Object.freeze({
              actorUserIdentityId: parsedRequest.data.actorUserIdentityId,
              nodeId: parsedRequest.data.nodeId,
              heartbeatStatus: parsedRequest.data.heartbeatStatus,
              seenAt: parsedRequest.data.seenAt,
              observedBy: parsedRequest.data.observedBy,
              capabilityProfile: parsedRequest.data.capabilityProfile,
              deploymentTags: parsedRequest.data.deploymentTags,
              metadata: parsedRequest.data.metadata,
            });
            const apiResponse = await options.nodeTrustBackendApi.recordNodeOperationalUpdate(operationalUpdateRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, operationalUpdateRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/nodes/enrollments/")
        && !path.endsWith("/approve")
        && !path.endsWith("/reject")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const enrollmentRequestId = decodePathTail(path, "/api/v1/nodes/enrollments/");
            if (!enrollmentRequestId) {
              const invalid = buildNodeTrustInvalidRequestResponse("requestId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const enrollmentDetailRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              requestId: enrollmentRequestId,
            });
            const apiResponse = await options.nodeTrustBackendApi.getNodeEnrollmentDetail(enrollmentDetailRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, enrollmentDetailRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "POST"
        && path.endsWith("/approve")
        && path.startsWith("/api/v1/nodes/enrollments/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const enrollmentRequestId = decodePathTail(path, "/api/v1/nodes/enrollments/", "/approve");
            if (!enrollmentRequestId) {
              const invalid = buildNodeTrustInvalidRequestResponse("requestId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateApproveNodeEnrollmentRequest(
              request,
              context.principal.userIdentityId,
              enrollmentRequestId,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const approveRequest = Object.freeze({
              actorUserIdentityId: parsedRequest.data.actorUserIdentityId,
              requestId: parsedRequest.data.requestId,
              reviewedAt: parsedRequest.data.reviewedAt,
              decisionNote: parsedRequest.data.decisionNote,
              certificate: parsedRequest.data.certificate,
              correlationId: parsedRequest.data.correlationId,
              metadata: parsedRequest.data.metadata,
            });
            const apiResponse = await options.nodeTrustBackendApi.approveNodeEnrollment(approveRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, approveRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.nodeTrustBackendApi
        && request.method === "POST"
        && path.endsWith("/reject")
        && path.startsWith("/api/v1/nodes/enrollments/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context) => {
            const enrollmentRequestId = decodePathTail(path, "/api/v1/nodes/enrollments/", "/reject");
            if (!enrollmentRequestId) {
              const invalid = buildNodeTrustInvalidRequestResponse("requestId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateRejectNodeEnrollmentRequest(
              request,
              context.principal.userIdentityId,
              enrollmentRequestId,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const rejectRequest = Object.freeze({
              actorUserIdentityId: parsedRequest.data.actorUserIdentityId,
              requestId: parsedRequest.data.requestId,
              reviewedAt: parsedRequest.data.reviewedAt,
              decisionNote: parsedRequest.data.decisionNote,
              correlationId: parsedRequest.data.correlationId,
              metadata: parsedRequest.data.metadata,
            });
            const apiResponse = await options.nodeTrustBackendApi.rejectNodeEnrollment(rejectRequest);
            const statusCode = mapNodeTrustStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, rejectRequest, apiResponse);
          },
        );
        return;
      }

    return Object.freeze({ handled: false });
  };
}

