# External Runtime SDK (Reference, Minimal)

This module provides a minimal TypeScript reference SDK that is thin over the existing external runtime API.

## Public contract

Use `PublicExternalRuntimeSdkContract.ts` for transport-friendly request/response/error DTOs:

- `RuntimeSdkStartExecutionRequest` / `RuntimeSdkStartExecutionResponse`
- `RuntimeSdkExecutionStatusRequest` / `RuntimeSdkExecutionStatusResponse`
- `RuntimeSdkExecutionResultRequest` / `RuntimeSdkExecutionResultResponse`
- `RuntimeSdkExecutionTraceRequest` / `RuntimeSdkExecutionTraceResponse`
- `RuntimeSdkResponse<T>` and `RuntimeSdkError`

## Reference client

`RuntimeClient` composes a `RuntimeSdkTransport` and adds optional default authentication/caller context.

The in-repo reference transport is `ExternalInterfaceRuntimeSdkTransport`, which adapts to `ExternalSystemRuntimeInterface` without adding runtime business logic.

## Usage

```ts
const transport = new ExternalInterfaceRuntimeSdkTransport(externalRuntimeInterface);
const client = new RuntimeClient({
  transport,
  authentication: { bearerToken: "token-user-1" },
  accessContext: { callerKind: "user", callerId: "user-1", tenantId: "tenant-a" },
});

const started = await client.startExecution({
  systemId: "system:demo",
  versionId: "system:demo:v1",
  async: true,
  inputPayload: { request: "hello" },
  tenantId: "tenant-a",
});
```
