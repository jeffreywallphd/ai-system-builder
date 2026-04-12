import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

export function createSecretMetadataRouteFamilyHandler(deps: Record<string, unknown>): IdentityHttpRouteFamilyHandler {
  const d = deps as any;
  const options = d.options;
  const maxBodyBytes = d.maxBodyBytes;
  const requireAuthenticatedSession = d.requireAuthenticatedSession;
  const parseJsonBody = d.parseJsonBody;
  const buildSecretMetadataInvalidRequestResponse = d.buildSecretMetadataInvalidRequestResponse;
  const buildSecretMetadataValidationErrors = d.buildSecretMetadataValidationErrors;
  const ReEncryptSecretsCommandSchema = d.ReEncryptSecretsCommandSchema;
  const decodePathTail = d.decodePathTail;
  const normalizeOptionalString = d.normalizeOptionalString;
  const resolveRequestSearchParams = d.resolveRequestSearchParams;
  const GetSecretReEncryptionStatusQuerySchema = d.GetSecretReEncryptionStatusQuerySchema;
  const parseAndValidateSecretMetadataRequest = d.parseAndValidateSecretMetadataRequest;
  const CreateSecretMetadataCommandSchema = d.CreateSecretMetadataCommandSchema;
  const parseOptionalBoolean = d.parseOptionalBoolean;
  const parseOptionalInteger = d.parseOptionalInteger;
  const ListSecretMetadataQuerySchema = d.ListSecretMetadataQuerySchema;
  const GetSecretMetadataQuerySchema = d.GetSecretMetadataQuerySchema;
  const RotateSecretMetadataCommandSchema = d.RotateSecretMetadataCommandSchema;
  const DisableSecretMetadataCommandSchema = d.DisableSecretMetadataCommandSchema;
  const mapSecretMetadataStatusCode = d.mapSecretMetadataStatusCode;
  const writeJson = d.writeJson;
  const logResponse = d.logResponse;

  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    const searchParams = resolveRequestSearchParams(request.url);
      if (
        options.secretMetadataBackendApi
        && request.method === "GET"
        && path === "/api/v1/security/secrets/health"
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {},
          async (context) => {
            const apiResponse = await options.secretMetadataBackendApi.getSecretServiceHealth({
              actorUserIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "GET"
        && path === "/api/v1/security/secrets/diagnostics"
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
            const apiResponse = await options.secretMetadataBackendApi.getSecretServiceDiagnostics({
              actorUserIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "POST"
        && path === "/api/v1/security/secrets/maintenance/re-encryption"
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
            const parsedBody = await parseJsonBody(request, maxBodyBytes);
            if (!parsedBody.ok) {
              const invalid = buildSecretMetadataInvalidRequestResponse(parsedBody.error);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = ReEncryptSecretsCommandSchema.safeParse(parsedBody.value);
            if (!parsedRequest.success) {
              const invalid = buildSecretMetadataValidationErrors(parsedRequest.error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const reEncryptRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              operationKey: parsedRequest.data.operationKey,
              operationId: parsedRequest.data.operationId,
              maxTargetsPerInvocation: parsedRequest.data.maxTargetsPerInvocation,
              occurredAt: parsedRequest.data.occurredAt,
            });
            const apiResponse = await options.secretMetadataBackendApi.reEncryptSecrets(reEncryptRequest);
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              operationKey: reEncryptRequest.operationKey,
              operationId: reEncryptRequest.operationId,
              maxTargetsPerInvocation: reEncryptRequest.maxTargetsPerInvocation,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/security/secrets/maintenance/re-encryption/")
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
            const operationId = decodePathTail(path, "/api/v1/security/secrets/maintenance/re-encryption/");
            if (!operationId || operationId.includes("/")) {
              const invalid = buildSecretMetadataInvalidRequestResponse("operationId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const queryParsed = GetSecretReEncryptionStatusQuerySchema.safeParse({
              operationId,
              occurredAt: normalizeOptionalString(resolveRequestSearchParams(request.url).get("occurredAt")),
            });
            if (!queryParsed.success) {
              const invalid = buildSecretMetadataValidationErrors(queryParsed.error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const statusRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              operationId: queryParsed.data.operationId,
              occurredAt: queryParsed.data.occurredAt,
            });
            const apiResponse = await options.secretMetadataBackendApi.getSecretReEncryptionStatus(statusRequest);
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, statusRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "POST"
        && path === "/api/v1/security/secrets"
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
            const parsedRequest = await parseAndValidateSecretMetadataRequest(
              request,
              CreateSecretMetadataCommandSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const createRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const apiResponse = await options.secretMetadataBackendApi.createSecret(createRequest);
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              operationKey: createRequest.operationKey,
              secretId: createRequest.secretId,
              name: createRequest.name,
              owner: createRequest.owner,
              kind: createRequest.kind,
              plaintextProvided: true,
              metadataProvided: Boolean(createRequest.metadata),
              createdAt: createRequest.createdAt,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "GET"
        && path === "/api/v1/security/secrets"
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
            const scope = normalizeOptionalString(url.searchParams.get("scope"));
            const workspaceId = normalizeOptionalString(url.searchParams.get("workspaceId"));
            const userIdentityId = normalizeOptionalString(url.searchParams.get("userIdentityId"));
            const actorWorkspaceId = normalizeOptionalString(url.searchParams.get("actorWorkspaceId"));
            const kinds = url.searchParams.getAll("kind").map((kind) => kind.trim()).filter(Boolean);
            const tagAnyOf = url.searchParams.getAll("tag").map((tag) => tag.trim()).filter(Boolean);
            const includeDisabledInput = url.searchParams.get("includeDisabled");
            const includeArchivedInput = url.searchParams.get("includeArchived");
            const includeSoftDeletedInput = url.searchParams.get("includeSoftDeleted");
            const includeDisabled = parseOptionalBoolean(includeDisabledInput);
            const includeArchived = parseOptionalBoolean(includeArchivedInput);
            const includeSoftDeleted = parseOptionalBoolean(includeSoftDeletedInput);
            const limitInput = url.searchParams.get("limit");
            const offsetInput = url.searchParams.get("offset");
            const limit = parseOptionalInteger(limitInput);
            const offset = parseOptionalInteger(offsetInput);
            if (includeDisabledInput !== null && includeDisabled === undefined) {
              const invalid = buildSecretMetadataInvalidRequestResponse("includeDisabled must be 'true' or 'false'.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (includeArchivedInput !== null && includeArchived === undefined) {
              const invalid = buildSecretMetadataInvalidRequestResponse("includeArchived must be 'true' or 'false'.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (includeSoftDeletedInput !== null && includeSoftDeleted === undefined) {
              const invalid = buildSecretMetadataInvalidRequestResponse("includeSoftDeleted must be 'true' or 'false'.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (limitInput !== null && limit === undefined) {
              const invalid = buildSecretMetadataInvalidRequestResponse("limit must be an integer >= 1.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            if (offsetInput !== null && offset === undefined) {
              const invalid = buildSecretMetadataInvalidRequestResponse("offset must be an integer >= 0.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedQuery = ListSecretMetadataQuerySchema.safeParse({
              owner: {
                scope,
                workspaceId,
                userIdentityId,
              },
              actorWorkspaceId,
              kinds: kinds.length > 0 ? kinds : undefined,
              tagAnyOf: tagAnyOf.length > 0 ? tagAnyOf : undefined,
              includeDisabled: includeDisabledInput === null ? undefined : includeDisabled,
              includeArchived: includeArchivedInput === null ? undefined : includeArchived,
              includeSoftDeleted: includeSoftDeletedInput === null ? undefined : includeSoftDeleted,
              limit: limitInput === null ? undefined : limit,
              offset: offsetInput === null ? undefined : offset,
            });
            if (!parsedQuery.success) {
              const invalid = buildSecretMetadataValidationErrors(parsedQuery.error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const listRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              actorWorkspaceId: parsedQuery.data.actorWorkspaceId,
              owner: parsedQuery.data.owner,
              kinds: parsedQuery.data.kinds,
              tagAnyOf: parsedQuery.data.tagAnyOf,
              includeDisabled: parsedQuery.data.includeDisabled,
              includeArchived: parsedQuery.data.includeArchived,
              includeSoftDeleted: parsedQuery.data.includeSoftDeleted,
              limit: parsedQuery.data.limit,
              offset: parsedQuery.data.offset,
            });

            const apiResponse = await options.secretMetadataBackendApi.listSecrets(listRequest);
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, listRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/security/secrets/")
        && !path.endsWith("/disable")
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
            const secretId = decodePathTail(path, "/api/v1/security/secrets/");
            if (!secretId || secretId.includes("/")) {
              const invalid = buildSecretMetadataInvalidRequestResponse("secretId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedQuery = GetSecretMetadataQuerySchema.safeParse({
              secretId,
              actorWorkspaceId: normalizeOptionalString(resolveRequestSearchParams(request.url).get("actorWorkspaceId")),
              occurredAt: normalizeOptionalString(resolveRequestSearchParams(request.url).get("occurredAt")),
            });
            if (!parsedQuery.success) {
              const invalid = buildSecretMetadataValidationErrors(parsedQuery.error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const getRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              actorWorkspaceId: parsedQuery.data.actorWorkspaceId,
              secretId: parsedQuery.data.secretId,
              occurredAt: parsedQuery.data.occurredAt,
            });
            const apiResponse = await options.secretMetadataBackendApi.getSecret(getRequest);
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, getRequest, apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "POST"
        && path.startsWith("/api/v1/security/secrets/")
        && path.endsWith("/rotate")
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
            const secretId = decodePathTail(path, "/api/v1/security/secrets/", "/rotate");
            if (!secretId || secretId.includes("/")) {
              const invalid = buildSecretMetadataInvalidRequestResponse("secretId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedBody = await parseJsonBody(request, maxBodyBytes);
            if (!parsedBody.ok) {
              const invalid = buildSecretMetadataInvalidRequestResponse(parsedBody.error);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = RotateSecretMetadataCommandSchema.safeParse({
              ...(parsedBody.value as Record<string, unknown>),
              secretId,
            });
            if (!parsedRequest.success) {
              const invalid = buildSecretMetadataValidationErrors(parsedRequest.error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const rotateRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              secretId: parsedRequest.data.secretId,
              plaintext: parsedRequest.data.plaintext,
              operationKey: parsedRequest.data.operationKey,
              expectedCurrentVersionId: parsedRequest.data.expectedCurrentVersionId,
              rotatedAt: parsedRequest.data.rotatedAt,
              actorWorkspaceId: parsedRequest.data.actorWorkspaceId,
            });
            const apiResponse = await options.secretMetadataBackendApi.rotateSecret(rotateRequest);
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              secretId: rotateRequest.secretId,
              operationKey: rotateRequest.operationKey,
              expectedCurrentVersionId: rotateRequest.expectedCurrentVersionId,
              rotatedAt: rotateRequest.rotatedAt,
              actorWorkspaceId: rotateRequest.actorWorkspaceId,
              plaintextProvided: true,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.secretMetadataBackendApi
        && request.method === "POST"
        && path.startsWith("/api/v1/security/secrets/")
        && path.endsWith("/disable")
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
            const secretId = decodePathTail(path, "/api/v1/security/secrets/", "/disable");
            if (!secretId || secretId.includes("/")) {
              const invalid = buildSecretMetadataInvalidRequestResponse("secretId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedBody = await parseJsonBody(request, maxBodyBytes);
            if (!parsedBody.ok) {
              const invalid = buildSecretMetadataInvalidRequestResponse(parsedBody.error);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = DisableSecretMetadataCommandSchema.safeParse({
              ...(parsedBody.value as Record<string, unknown>),
              secretId,
            });
            if (!parsedRequest.success) {
              const invalid = buildSecretMetadataValidationErrors(parsedRequest.error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const disableRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              secretId: parsedRequest.data.secretId,
              operationKey: parsedRequest.data.operationKey,
              disabledAt: parsedRequest.data.disabledAt,
              actorWorkspaceId: parsedRequest.data.actorWorkspaceId,
            });
            const apiResponse = await options.secretMetadataBackendApi.disableSecret(disableRequest);
            const statusCode = mapSecretMetadataStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, disableRequest, apiResponse);
          },
        );
        return;
      }
    return Object.freeze({ handled: false });
  };
}

