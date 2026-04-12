import { describe, expect, it } from "bun:test";
import {
  parseExecutionNodeBackendAvailabilityReadRequestDto,
  parseExecutionNodeListRequestDto,
  parseExecutionNodeReadinessCheckRequestDto,
} from "@shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts";
import {
  normalizeOptionalString,
  parseOptionalBoolean,
  parseOptionalInteger,
  parseOptionalStringList,
} from "../primitives/HttpQueryPrimitives";
import {
  buildExecutionNodeBackendAvailabilityRequestPayload,
  buildExecutionNodeListRequestPayload,
  buildExecutionNodeReadinessRequestPayload,
  toExecutionNodeActorScopedApiRequest,
  toExecutionNodeGetApiRequest,
} from "../dto/ExecutionNodeManagementRouteDtoMapper";

const queryPrimitives = Object.freeze({
  parseOptionalStringList,
  parseOptionalBoolean,
  parseOptionalInteger,
  normalizeOptionalString,
});

describe("Execution node management route DTO mapper", () => {
  it("maps list query params into shared schema-compatible payloads", () => {
    const payload = buildExecutionNodeListRequestPayload(
      new URLSearchParams(
        "nodeType=compute&backendFamily=adapter.comfyui.image-manipulation&supportsRemoteScheduling=true&limit=25&offset=5",
      ),
      queryPrimitives,
    );
    const parsed = parseExecutionNodeListRequestDto(payload);
    const apiRequest = toExecutionNodeActorScopedApiRequest("user-1", parsed);

    expect(apiRequest.actorUserIdentityId).toBe("user-1");
    expect(apiRequest.nodeTypes).toEqual(["compute"]);
    expect(apiRequest.backendFamilies).toEqual(["adapter.comfyui.image-manipulation"]);
    expect(apiRequest.supportsRemoteScheduling).toBe(true);
    expect(apiRequest.limit).toBe(25);
    expect(apiRequest.offset).toBe(5);
  });

  it("maps readiness query params into shared schema-compatible payloads", () => {
    const payload = buildExecutionNodeReadinessRequestPayload(
      new URLSearchParams(
        "requiredBackendFamily=adapter.comfyui.image-manipulation&requiredNodeCapability=executor&allowDegraded=false",
      ),
      queryPrimitives,
    );
    const parsed = parseExecutionNodeReadinessCheckRequestDto(payload);
    const apiRequest = toExecutionNodeActorScopedApiRequest("user-2", parsed);

    expect(apiRequest.actorUserIdentityId).toBe("user-2");
    expect(apiRequest.requiredBackendFamilies).toEqual(["adapter.comfyui.image-manipulation"]);
    expect(apiRequest.requiredNodeCapabilities).toEqual(["executor"]);
    expect(apiRequest.allowDegraded).toBe(false);
  });

  it("maps backend availability query params and node detail reads", () => {
    const payload = buildExecutionNodeBackendAvailabilityRequestPayload(
      new URLSearchParams("backendFamily=adapter.comfyui.image-manipulation&includeUnavailable=true"),
      queryPrimitives,
    );
    const parsed = parseExecutionNodeBackendAvailabilityReadRequestDto(payload);
    const listRequest = toExecutionNodeActorScopedApiRequest("user-3", parsed);
    const getRequest = toExecutionNodeGetApiRequest("user-3", "node-1");

    expect(listRequest.actorUserIdentityId).toBe("user-3");
    expect(listRequest.backendFamilies).toEqual(["adapter.comfyui.image-manipulation"]);
    expect(listRequest.includeUnavailable).toBe(true);
    expect(getRequest).toEqual({
      actorUserIdentityId: "user-3",
      nodeId: "node-1",
    });
  });
});

