import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

export function createDeploymentPolicyRouteFamilyHandler(deps: Record<string, unknown>): IdentityHttpRouteFamilyHandler {
  const d = deps as any;
  const options = d.options;
  const maxBodyBytes = d.maxBodyBytes;
  const DeploymentPolicyReadTransportRoutes = d.DeploymentPolicyReadTransportRoutes;
  const DeploymentPolicyWriteTransportRoutes = d.DeploymentPolicyWriteTransportRoutes;
  const resolveCanonicalRequestPath = d.resolveCanonicalRequestPath;
  const resolveRequestSearchParams = d.resolveRequestSearchParams;
  const requireAuthenticatedWorkspaceSession = d.requireAuthenticatedWorkspaceSession;
  const buildRuntimeInvalidRequestResponse = d.buildRuntimeInvalidRequestResponse;
  const parseAndValidateDeploymentPolicyStateReadRequest = d.parseAndValidateDeploymentPolicyStateReadRequest;
  const resolveRequestCorrelationId = d.resolveRequestCorrelationId;
  const mapRunSubmissionStatusCode = d.mapRunSubmissionStatusCode;
  const writeJson = d.writeJson;
  const logResponse = d.logResponse;
  const parseAndValidateRuntimeMutationBody = d.parseAndValidateRuntimeMutationBody;
  const parseAndValidateDeploymentPolicyActiveProfileWriteRequest = d.parseAndValidateDeploymentPolicyActiveProfileWriteRequest;
  const parseAndValidateDeploymentPolicyOverrideWriteRequest = d.parseAndValidateDeploymentPolicyOverrideWriteRequest;

  return async ({ request, response, requestId, logger }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (
      options.deploymentPolicyReadBackendApi
      && request.method === "GET"
      && resolveCanonicalRequestPath(request.url) === DeploymentPolicyReadTransportRoutes.readState
    ) {
      const searchParams = resolveRequestSearchParams(request.url);
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildRuntimeInvalidRequestResponse,
        },
        async (context: any) => {
          const parsedRequest = parseAndValidateDeploymentPolicyStateReadRequest({
            workspaceId: context.workspace.workspaceId,
            actorUserIdentityId: context.actor.userIdentityId,
            searchParams,
          });
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            logResponse(logger, requestId, request, parsedRequest.statusCode, Object.freeze({
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
            }), parsedRequest.body);
            return;
          }

          const apiResponse = await options.deploymentPolicyReadBackendApi.readPolicyState(Object.freeze({
            ...parsedRequest.data,
            correlationId: resolveRequestCorrelationId(request, requestId),
          }));
          const statusCode = mapRunSubmissionStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, Object.freeze({
            workspaceId: context.workspace.workspaceId,
            actorUserIdentityId: context.actor.userIdentityId,
            query: Object.fromEntries(searchParams.entries()),
          }), apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (
      options.deploymentPolicyWriteBackendApi
      && request.method === "POST"
    ) {
      const path = resolveCanonicalRequestPath(request.url);
      if (
        path !== DeploymentPolicyWriteTransportRoutes.updateActiveProfile
        && path !== DeploymentPolicyWriteTransportRoutes.applyOverrides
      ) {
        return Object.freeze({ handled: false });
      }

      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildRuntimeInvalidRequestResponse,
        },
        async (context: any) => {
          const parsedBody = await parseAndValidateRuntimeMutationBody(request, maxBodyBytes);
          if (!parsedBody.ok) {
            writeJson(response, 400, parsedBody.body);
            logResponse(logger, requestId, request, 400, Object.freeze({
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
            }), parsedBody.body);
            return;
          }

          if (path === DeploymentPolicyWriteTransportRoutes.updateActiveProfile) {
            const parsedRequest = parseAndValidateDeploymentPolicyActiveProfileWriteRequest(parsedBody.value);
            if (!parsedRequest.ok) {
              writeJson(response, 400, parsedRequest.body);
              logResponse(logger, requestId, request, 400, Object.freeze({
                workspaceId: context.workspace.workspaceId,
                actorUserIdentityId: context.actor.userIdentityId,
              }), parsedRequest.body);
              return;
            }

            const apiResponse = await options.deploymentPolicyWriteBackendApi.updateActiveProfile(
              Object.freeze({
                actorUserIdentityId: context.actor.userIdentityId,
                workspaceId: context.workspace.workspaceId,
                correlationId: resolveRequestCorrelationId(request, requestId),
              }),
              parsedRequest.data,
            );
            const statusCode = mapRunSubmissionStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
            }), apiResponse);
            return;
          }

          const parsedRequest = parseAndValidateDeploymentPolicyOverrideWriteRequest(parsedBody.value);
          if (!parsedRequest.ok) {
            writeJson(response, 400, parsedRequest.body);
            logResponse(logger, requestId, request, 400, Object.freeze({
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
            }), parsedRequest.body);
            return;
          }

          const apiResponse = await options.deploymentPolicyWriteBackendApi.applyOverrideOperations(
            Object.freeze({
              actorUserIdentityId: context.actor.userIdentityId,
              workspaceId: context.workspace.workspaceId,
              correlationId: resolveRequestCorrelationId(request, requestId),
            }),
            parsedRequest.data,
          );
          const statusCode = mapRunSubmissionStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, Object.freeze({
            workspaceId: context.workspace.workspaceId,
            actorUserIdentityId: context.actor.userIdentityId,
          }), apiResponse);
        },
      );

      return Object.freeze({ handled: true });
    }

    return Object.freeze({ handled: false });
  };
}
