import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

export function createCertificateOperationsRouteFamilyHandler(deps: Record<string, unknown>): IdentityHttpRouteFamilyHandler {
  const d = deps as any;
  const options = d.options;
  const maxBodyBytes = d.maxBodyBytes;
  const requireAuthenticatedSession = d.requireAuthenticatedSession;
  const parseOptionalInteger = d.parseOptionalInteger;
  const parseOptionalBoolean = d.parseOptionalBoolean;
  const normalizeOptionalString = d.normalizeOptionalString;
  const buildCertificateOperationsQueryValidationError = d.buildCertificateOperationsQueryValidationError;
  const buildCertificateOperationsInvalidRequestResponse = d.buildCertificateOperationsInvalidRequestResponse;
  const mapCertificateOperationsStatusCode = d.mapCertificateOperationsStatusCode;
  const CertificateStatusValues = d.CertificateStatusValues;
  const CertificateSubjectReferenceKindValues = d.CertificateSubjectReferenceKindValues;
  const CertificateUsageValues = d.CertificateUsageValues;
  const CertificateTrustStatusValues = d.CertificateTrustStatusValues;
  const decodePathTail = d.decodePathTail;
  const parseAndValidateRequest = d.parseAndValidateRequest;
  const RevokeIssuedCertificateRequestSchema = d.RevokeIssuedCertificateRequestSchema;
  const RenewIssuedCertificateRequestSchema = d.RenewIssuedCertificateRequestSchema;
  const resolveRequestSearchParams = d.resolveRequestSearchParams;
  const writeJson = d.writeJson;
  const logResponse = d.logResponse;

  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
      if (
        options.certificateOperationsBackendApi
        && request.method === "GET"
        && path === "/api/v1/security/certificates/authority/status"
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const asOf = normalizeOptionalString(url.searchParams.get("asOf"));
            const rotationWarningWindowDaysInput = url.searchParams.get("rotationWarningWindowDays");
            const certificateExpiryWarningWindowDaysInput = url.searchParams.get("certificateExpiryWarningWindowDays");
            const rotationWarningWindowDays = parseOptionalInteger(rotationWarningWindowDaysInput);
            const certificateExpiryWarningWindowDays = parseOptionalInteger(certificateExpiryWarningWindowDaysInput);

            if (
              rotationWarningWindowDaysInput !== null
              && (rotationWarningWindowDays === undefined || rotationWarningWindowDays < 1)
            ) {
              const invalid = buildCertificateOperationsQueryValidationError(
                "rotationWarningWindowDays",
                "rotationWarningWindowDays must be an integer >= 1.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            if (
              certificateExpiryWarningWindowDaysInput !== null
              && (certificateExpiryWarningWindowDays === undefined || certificateExpiryWarningWindowDays < 1)
            ) {
              const invalid = buildCertificateOperationsQueryValidationError(
                "certificateExpiryWarningWindowDays",
                "certificateExpiryWarningWindowDays must be an integer >= 1.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const apiResponse = await options.certificateOperationsBackendApi.getCertificateAuthorityStatus({
              actorUserIdentityId: context.principal.userIdentityId,
              asOf,
              rotationWarningWindowDays,
              certificateExpiryWarningWindowDays,
            });
            const statusCode = mapCertificateOperationsStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              asOf,
              rotationWarningWindowDays,
              certificateExpiryWarningWindowDays,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.certificateOperationsBackendApi
        && request.method === "GET"
        && path === "/api/v1/security/certificates"
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const statuses = url.searchParams.getAll("status");
            const subjectReferenceKinds = url.searchParams.getAll("subjectReferenceKind");
            const usageAnyOf = url.searchParams.getAll("usage");
            const trustStatuses = url.searchParams.getAll("trustStatus");
            const includeRevokedInput = url.searchParams.get("includeRevoked");
            const includeRevoked = parseOptionalBoolean(includeRevokedInput);
            const limitInput = url.searchParams.get("limit");
            const offsetInput = url.searchParams.get("offset");
            const limit = parseOptionalInteger(limitInput);
            const offset = parseOptionalInteger(offsetInput);

            if (statuses.some((status) => !CertificateStatusValues.has(status))) {
              const invalid = buildCertificateOperationsQueryValidationError("status", "status values are invalid.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (subjectReferenceKinds.some((kind) => !CertificateSubjectReferenceKindValues.has(kind))) {
              const invalid = buildCertificateOperationsQueryValidationError(
                "subjectReferenceKind",
                "subjectReferenceKind values are invalid.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (usageAnyOf.some((usage) => !CertificateUsageValues.has(usage))) {
              const invalid = buildCertificateOperationsQueryValidationError("usage", "usage values are invalid.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (trustStatuses.some((status) => !CertificateTrustStatusValues.has(status))) {
              const invalid = buildCertificateOperationsQueryValidationError(
                "trustStatus",
                "trustStatus values are invalid.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (includeRevokedInput !== null && includeRevoked === undefined) {
              const invalid = buildCertificateOperationsQueryValidationError(
                "includeRevoked",
                "includeRevoked must be 'true' or 'false'.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (limitInput !== null && (limit === undefined || limit < 1)) {
              const invalid = buildCertificateOperationsQueryValidationError("limit", "limit must be an integer >= 1.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (offsetInput !== null && (offset === undefined || offset < 0)) {
              const invalid = buildCertificateOperationsQueryValidationError(
                "offset",
                "offset must be an integer >= 0.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const listRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              certificateAuthorityId: normalizeOptionalString(url.searchParams.get("certificateAuthorityId")),
              statuses: statuses.length > 0
                ? statuses
                : undefined,
              subjectReferenceKinds: subjectReferenceKinds.length > 0
                ? subjectReferenceKinds
                : undefined,
              subjectReferenceId: normalizeOptionalString(url.searchParams.get("subjectReferenceId")),
              linkedNodeId: normalizeOptionalString(url.searchParams.get("linkedNodeId")),
              subjectCommonNameContains: normalizeOptionalString(url.searchParams.get("subjectCommonNameContains")),
              usageAnyOf: usageAnyOf.length > 0
                ? usageAnyOf
                : undefined,
              issuedAfter: normalizeOptionalString(url.searchParams.get("issuedAfter")),
              issuedBefore: normalizeOptionalString(url.searchParams.get("issuedBefore")),
              trustStatuses: trustStatuses.length > 0
                ? trustStatuses
                : undefined,
              includeRevoked,
              asOf: normalizeOptionalString(url.searchParams.get("asOf")),
              limit,
              offset,
            });

            const apiResponse = await options.certificateOperationsBackendApi.listIssuedCertificates(listRequest);
            const statusCode = mapCertificateOperationsStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, listRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.certificateOperationsBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/security/certificates/")
        && !path.endsWith("/revoke")
        && !path.endsWith("/renew")
        && !path.endsWith("/authority/status")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context) => {
            const serialNumber = decodePathTail(path, "/api/v1/security/certificates/");
            if (!serialNumber || serialNumber.includes("/")) {
              const invalid = buildCertificateOperationsInvalidRequestResponse("serialNumber is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const apiResponse = await options.certificateOperationsBackendApi.getIssuedCertificate({
              actorUserIdentityId: context.principal.userIdentityId,
              serialNumber,
              asOf: normalizeOptionalString(resolveRequestSearchParams(request.url).get("asOf")),
            });
            const statusCode = mapCertificateOperationsStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              serialNumber,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.certificateOperationsBackendApi
        && request.method === "POST"
        && path.startsWith("/api/v1/security/certificates/")
        && path.endsWith("/revoke")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context) => {
            const serialNumber = decodePathTail(path, "/api/v1/security/certificates/", "/revoke");
            if (!serialNumber || serialNumber.includes("/")) {
              const invalid = buildCertificateOperationsInvalidRequestResponse("serialNumber is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateRequest(
              request,
              RevokeIssuedCertificateRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const revokeRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              serialNumber,
              ...parsedRequest.data,
            });
            const apiResponse = await options.certificateOperationsBackendApi.revokeIssuedCertificate(revokeRequest);
            const statusCode = mapCertificateOperationsStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, revokeRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.certificateOperationsBackendApi
        && request.method === "POST"
        && path.startsWith("/api/v1/security/certificates/")
        && path.endsWith("/renew")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context) => {
            const serialNumber = decodePathTail(path, "/api/v1/security/certificates/", "/renew");
            if (!serialNumber || serialNumber.includes("/")) {
              const invalid = buildCertificateOperationsInvalidRequestResponse("serialNumber is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateRequest(
              request,
              RenewIssuedCertificateRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const renewRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              serialNumber,
              ...parsedRequest.data,
            });
            const apiResponse = await options.certificateOperationsBackendApi.renewIssuedCertificate(renewRequest);
            const statusCode = mapCertificateOperationsStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, renewRequest, apiResponse);
          },
        );
        return;
      }

    return Object.freeze({ handled: false });
  };
}

