from __future__ import annotations

import json
import queue
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

import httpx

from app.core.mcp_config import McpServerConfig
from app.mcp.models import (
    McpPromptDescriptor,
    McpResourceDescriptor,
    McpServerDiagnosticsEntry,
    McpServerDescriptor,
    McpServerStatus,
    McpToolArgumentDescriptor,
    McpToolDescriptor,
    McpToolDescriptorSource,
    McpToolExecutionRequest,
    McpToolExecutionResult,
    McpToolInvocationTrace,
    McpValidationIssue,
    McpServerValidationResult,
    build_mcp_tool_id,
    utc_timestamp,
)

PROTOCOL_VERSION = "2024-11-05"


class McpConnectionError(RuntimeError):
    pass


@dataclass
class _JsonRpcResponse:
    id: str
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


class _JsonRpcTransport:
    def request(self, method: str, params: dict[str, Any] | None = None, expect_response: bool = True) -> dict[str, Any]:
        raise NotImplementedError

    def close(self) -> None:
        return None


class _StdioJsonRpcTransport(_JsonRpcTransport):
    def __init__(self, server: McpServerConfig, timeout_ms: int) -> None:
        command = [server.command or "", *server.args]
        env = None
        if server.env:
            env = {**server.env}
        try:
            self._process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                env=env,
            )
        except Exception as error:
            raise McpConnectionError(f"Unable to start MCP server '{server.id}': {error}") from error
        self._timeout_s = max(timeout_ms, 1000) / 1000
        self._lock = threading.Lock()

    def request(self, method: str, params: dict[str, Any] | None = None, expect_response: bool = True) -> dict[str, Any]:
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }
        if expect_response:
            payload["id"] = uuid.uuid4().hex
        raw = json.dumps(payload)
        with self._lock:
            if self._process.stdin is None or self._process.stdout is None:
                raise McpConnectionError("MCP stdio transport is unavailable.")
            self._process.stdin.write(raw + "\n")
            self._process.stdin.flush()
            if not expect_response:
                return {}
            started = time.monotonic()
            while True:
                if time.monotonic() - started > self._timeout_s:
                    raise McpConnectionError(f"MCP stdio request '{method}' timed out.")
                line = self._process.stdout.readline()
                if not line:
                    stderr = ""
                    if self._process.stderr is not None:
                        try:
                            stderr = self._process.stderr.read().strip()
                        except Exception:
                            stderr = ""
                    raise McpConnectionError(stderr or f"MCP stdio request '{method}' terminated without a response.")
                message = json.loads(line)
                if message.get("id") != payload["id"]:
                    continue
                if message.get("error"):
                    raise McpConnectionError(str(message["error"].get("message") or message["error"]))
                return message.get("result") or {}

    def close(self) -> None:
        try:
            if self._process.stdin is not None:
                self._process.stdin.close()
        except Exception:
            pass
        try:
            self._process.terminate()
            self._process.wait(timeout=1)
        except Exception:
            try:
                self._process.kill()
            except Exception:
                pass


class _HttpJsonRpcTransport(_JsonRpcTransport):
    def __init__(self, server: McpServerConfig, timeout_ms: int) -> None:
        headers = {"content-type": "application/json", **server.headers}
        self._client = httpx.Client(timeout=max(timeout_ms, 1000) / 1000, headers=headers)
        self._url = server.url or ""

    def request(self, method: str, params: dict[str, Any] | None = None, expect_response: bool = True) -> dict[str, Any]:
        payload = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        if expect_response:
            payload["id"] = uuid.uuid4().hex
        response = self._client.post(self._url, json=payload)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict) and data.get("error"):
            raise McpConnectionError(str(data["error"].get("message") or data["error"]))
        return data.get("result") if isinstance(data, dict) and "result" in data else data

    def close(self) -> None:
        self._client.close()


class _SseJsonRpcTransport(_JsonRpcTransport):
    def __init__(self, server: McpServerConfig, timeout_ms: int) -> None:
        self._stream_url = server.url or ""
        self._post_url = str(server.metadata.get("messageUrl") or self._stream_url)
        self._client = httpx.Client(timeout=max(timeout_ms, 1000) / 1000, headers={**server.headers})
        self._responses: dict[str, queue.Queue[dict[str, Any]]] = {}
        self._closed = False
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._listen, daemon=True)
        self._thread.start()

    def _listen(self) -> None:
        headers = {"accept": "text/event-stream"}
        with self._client.stream("GET", self._stream_url, headers=headers) as response:
            response.raise_for_status()
            event_data: list[str] = []
            for line in response.iter_lines():
                if self._closed:
                    return
                if line == "":
                    if not event_data:
                        continue
                    raw = "\n".join(event_data)
                    event_data = []
                    try:
                        message = json.loads(raw)
                    except Exception:
                        continue
                    message_id = str(message.get("id", "")).strip()
                    if message_id and message_id in self._responses:
                        self._responses[message_id].put(message)
                    continue
                if line.startswith("data:"):
                    event_data.append(line[5:].strip())

    def request(self, method: str, params: dict[str, Any] | None = None, expect_response: bool = True) -> dict[str, Any]:
        payload = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        response_id = uuid.uuid4().hex if expect_response else None
        if response_id:
            payload["id"] = response_id
            self._responses[response_id] = queue.Queue(maxsize=1)
        response = self._client.post(self._post_url, json=payload, headers={"content-type": "application/json"})
        response.raise_for_status()
        if not expect_response:
            return {}
        try:
            message = self._responses[response_id].get(timeout=self._client.timeout.read or 10)
        except queue.Empty as error:
            raise McpConnectionError(f"MCP SSE request '{method}' timed out.") from error
        finally:
            self._responses.pop(response_id, None)
        if message.get("error"):
            raise McpConnectionError(str(message["error"].get("message") or message["error"]))
        return message.get("result") or {}

    def close(self) -> None:
        self._closed = True
        self._client.close()


class RuntimeMcpClient:
    def __init__(
        self,
        server: McpServerConfig,
        diagnostics_callback: Optional[Callable[[McpServerDiagnosticsEntry], None]] = None,
        timeout_ms: int = 10000,
    ) -> None:
        self._server = server
        self._timeout_ms = timeout_ms
        self._transport: Optional[_JsonRpcTransport] = None
        self._connected = False
        self._last_error: str | None = None
        self._checked_at: str | None = None
        self._connected_at: str | None = None
        self._disconnected_at: str | None = None
        self._last_sync_at: str | None = None
        self._cached_tools: list[McpToolDescriptor] = []
        self._cached_resources: list[McpResourceDescriptor] = []
        self._cached_prompts: list[McpPromptDescriptor] = []
        self._diagnostics = diagnostics_callback or (lambda entry: None)
        self._invocations: list[McpToolInvocationTrace] = []
        self._validation = self.validate_definition()

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def invocation_history(self) -> list[McpToolInvocationTrace]:
        return list(self._invocations)

    def validate_definition(self) -> McpServerValidationResult:
        issues: list[McpValidationIssue] = []
        if self._server.transport == "stdio" and not self._server.command:
            issues.append(McpValidationIssue(code="missing-command", message="stdio transport requires a command.", field="command"))
        if self._server.transport in {"http", "sse"} and not self._server.url:
            issues.append(McpValidationIssue(code="missing-url", message=f"{self._server.transport} transport requires a url.", field="url"))
        return McpServerValidationResult(valid=len(issues) == 0, checked_at=utc_timestamp(), issues=issues, normalized_server=self._server.model_dump(mode="json"))

    def connect(self, force: bool = False) -> McpServerStatus:
        if force and self._transport is not None:
            self.disconnect()
        self._checked_at = utc_timestamp()
        self._validation = self.validate_definition()
        if not self._validation.valid:
            return self._fail("; ".join(issue.message for issue in self._validation.issues))
        if self._server.fail_connect:
            return self._fail(f"Unable to connect to MCP server '{self._server.id}'.")
        try:
            if self._transport is None:
                self._transport = self._create_transport()
            result = self._transport.request(
                "initialize",
                {
                    "protocolVersion": PROTOCOL_VERSION,
                    "clientInfo": {"name": "ai-loom-studio", "version": "0.1.0"},
                    "capabilities": {"tools": {}, "resources": {}, "prompts": {}},
                },
            )
            self._transport.request("notifications/initialized", {}, expect_response=False)
            self._connected = True
            self._connected_at = self._checked_at
            self._last_error = None
            self._emit("info", "handshake", "MCP handshake completed.", {"result": result})
            self.sync_capabilities()
            return self.status()
        except Exception as error:
            return self._fail(str(error))

    def disconnect(self) -> McpServerStatus:
        self._checked_at = utc_timestamp()
        self._connected = False
        self._last_error = None
        self._disconnected_at = self._checked_at
        if self._transport is not None:
            self._transport.close()
            self._transport = None
        self._emit("info", "disconnect", "MCP session disconnected.")
        return self.status()

    def status(self) -> McpServerStatus:
        return McpServerStatus(
            server_id=self._server.id,
            name=self._server.name,
            transport=self._server.transport,
            source_type=self._server.source_type,
            configured=True,
            enabled=self._server.enabled,
            state="error" if self._last_error else ("connected" if self._connected else "disconnected"),
            lifecycle_state="running" if self._connected else ("error" if self._last_error else "stopped"),
            session_state="error" if self._last_error else ("connected" if self._connected else "disconnected"),
            connected=self._connected,
            reachable=self._connected and self._last_error is None,
            config_valid=self._validation.valid,
            checked_at=self._checked_at or utc_timestamp(),
            connected_at=self._connected_at,
            disconnected_at=self._disconnected_at,
            last_sync_at=self._last_sync_at,
            tool_count=len(self._cached_tools),
            resource_count=len(self._cached_resources),
            prompt_count=len(self._cached_prompts),
            capabilities={
                "tools": bool(self._cached_tools),
                "resources": bool(self._cached_resources),
                "prompts": bool(self._cached_prompts),
                "toolExecution": bool(self._cached_tools),
            },
            error_message=self._last_error,
            metadata=self._connection_metadata(),
        )

    def describe(self) -> McpServerDescriptor:
        current_status = self.status()
        return McpServerDescriptor(
            id=self._server.id,
            name=self._server.name,
            transport=self._server.transport,
            source_type=self._server.source_type,
            enabled=self._server.enabled,
            command=self._server.command,
            args=list(self._server.args),
            url=self._server.url,
            env=dict(self._server.env),
            headers=dict(self._server.headers),
            timeout_ms=self._server.timeout_ms,
            connect_on_startup=self._server.connect_on_startup,
            status=current_status.state,
            lifecycle_state=current_status.lifecycle_state,
            session_state=current_status.session_state,
            connected=current_status.connected,
            reachable=current_status.reachable,
            config_valid=current_status.config_valid,
            checked_at=current_status.checked_at,
            connected_at=current_status.connected_at,
            disconnected_at=current_status.disconnected_at,
            last_sync_at=current_status.last_sync_at,
            tool_count=current_status.tool_count,
            resource_count=current_status.resource_count,
            prompt_count=current_status.prompt_count,
            capabilities=current_status.capabilities,
            metadata={**self._server.metadata, **current_status.metadata},
            validation=self._validation,
            error_message=current_status.error_message,
        )

    def sync_capabilities(self) -> tuple[list[McpToolDescriptor], list[McpResourceDescriptor], list[McpPromptDescriptor]]:
        if not self._connected:
            self.connect()
        if not self._connected or self._transport is None:
            raise McpConnectionError(self._last_error or "MCP client is disconnected.")
        tools_payload = self._transport.request("tools/list", {}) if self._server.metadata.get("supportsTools", True) else {"tools": []}
        resources_payload = self._transport.request("resources/list", {}) if self._server.metadata.get("supportsResources", True) else {"resources": []}
        prompts_payload = self._transport.request("prompts/list", {}) if self._server.metadata.get("supportsPrompts", True) else {"prompts": []}
        self._cached_tools = [self._build_tool_descriptor(item) for item in tools_payload.get("tools", [])]
        self._cached_resources = [self._build_resource_descriptor(item) for item in resources_payload.get("resources", [])]
        self._cached_prompts = [self._build_prompt_descriptor(item) for item in prompts_payload.get("prompts", [])]
        self._last_sync_at = utc_timestamp()
        self._emit("info", "sync", "MCP capabilities synchronized.", {
            "toolCount": len(self._cached_tools),
            "resourceCount": len(self._cached_resources),
            "promptCount": len(self._cached_prompts),
        })
        return list(self._cached_tools), list(self._cached_resources), list(self._cached_prompts)

    def list_tools(self, allow_disconnected: bool = False) -> list[McpToolDescriptor]:
        if not self._cached_tools and not allow_disconnected:
            self.sync_capabilities()
        return list(self._cached_tools)

    def list_resources(self) -> list[McpResourceDescriptor]:
        if not self._cached_resources:
            self.sync_capabilities()
        return list(self._cached_resources)

    def list_prompts(self) -> list[McpPromptDescriptor]:
        if not self._cached_prompts:
            self.sync_capabilities()
        return list(self._cached_prompts)

    def execute_tool(self, request: McpToolExecutionRequest) -> McpToolExecutionResult:
        if not self._connected:
            self.connect()
        if not self._connected or self._transport is None:
            return McpToolExecutionResult(
                execution_id=request.execution_id or f"mcp-{uuid.uuid4().hex[:10]}",
                server_id=self._server.id,
                tool_name=request.tool_name,
                status="failed",
                error_message=self._last_error or "MCP session is disconnected.",
            )
        execution_id = request.execution_id or f"mcp-{uuid.uuid4().hex[:10]}"
        trace = McpToolInvocationTrace(
            execution_id=execution_id,
            server_id=self._server.id,
            tool_name=request.tool_name,
            started_at=utc_timestamp(),
            request_arguments=dict(request.arguments),
        )
        try:
            result = self._transport.request("tools/call", {"name": request.tool_name, "arguments": dict(request.arguments)})
            trace = trace.model_copy(update={
                "finished_at": utc_timestamp(),
                "status": "completed",
                "raw_result": result if isinstance(result, dict) else {"result": result},
            })
            self._append_invocation(trace)
            self._emit("info", "tool-call", "MCP tool invocation completed.", {"toolName": request.tool_name, "executionId": execution_id})
            return McpToolExecutionResult(
                execution_id=execution_id,
                server_id=self._server.id,
                tool_name=request.tool_name,
                status="completed",
                content=list(result.get("content", [])) if isinstance(result, dict) else [],
                structured_content=dict(result.get("structuredContent", {})) if isinstance(result, dict) else {},
                metadata={"transport": self._server.transport},
                trace=trace,
            )
        except Exception as error:
            trace = trace.model_copy(update={"finished_at": utc_timestamp(), "status": "failed", "error_message": str(error)})
            self._append_invocation(trace)
            self._emit("error", "tool-call", "MCP tool invocation failed.", {"toolName": request.tool_name, "error": str(error)})
            return McpToolExecutionResult(
                execution_id=execution_id,
                server_id=self._server.id,
                tool_name=request.tool_name,
                status="failed",
                error_message=str(error),
                trace=trace,
            )

    def _append_invocation(self, trace: McpToolInvocationTrace) -> None:
        self._invocations = [*self._invocations[-49:], trace]

    def _create_transport(self) -> _JsonRpcTransport:
        timeout_ms = self._server.timeout_ms or self._timeout_ms
        if self._server.transport == "stdio":
            return _StdioJsonRpcTransport(self._server, timeout_ms)
        if self._server.transport == "http":
            return _HttpJsonRpcTransport(self._server, timeout_ms)
        if self._server.transport == "sse":
            return _SseJsonRpcTransport(self._server, timeout_ms)
        raise McpConnectionError(f"Unsupported MCP transport '{self._server.transport}'.")

    def _emit(self, severity: str, event: str, message: str, details: Optional[dict[str, Any]] = None) -> None:
        self._diagnostics(McpServerDiagnosticsEntry(timestamp=utc_timestamp(), severity=severity, event=event, message=message, details=details or {}))

    def _fail(self, message: str) -> McpServerStatus:
        self._last_error = message
        self._connected = False
        self._emit("error", "connect", message)
        return self.status()

    def _build_tool_descriptor(self, tool: dict[str, Any]) -> McpToolDescriptor:
        name = str(tool.get("name", "tool")).strip() or "tool"
        input_schema = ensure_object(tool.get("inputSchema") or tool.get("input_schema") or {"type": "object"})
        output_schema = ensure_object(tool.get("outputSchema") or tool.get("output_schema") or {})
        annotations = ensure_object(tool.get("annotations") or {})
        metadata = ensure_object(tool.get("metadata") or {})
        categories = normalize_string_list(tool.get("categories"), metadata.get("category"), metadata.get("categories"), annotations.get("category"), annotations.get("categories"))
        tags = normalize_string_list(tool.get("tags"), metadata.get("tags"), annotations.get("tags"))
        return McpToolDescriptor(
            id=build_mcp_tool_id(self._server.id, name),
            server_id=self._server.id,
            source=McpToolDescriptorSource(server_id=self._server.id),
            name=name,
            title=tool.get("title"),
            description=tool.get("description"),
            input_schema=input_schema,
            output_schema=output_schema,
            arguments=build_argument_descriptors(input_schema),
            categories=categories,
            tags=tags,
            annotations=annotations,
            metadata=metadata,
            publication_state="published-live" if self._connected else "published-stale",
            live=self._connected,
            stale=not self._connected,
        )

    def _build_resource_descriptor(self, resource: dict[str, Any]) -> McpResourceDescriptor:
        return McpResourceDescriptor(
            server_id=self._server.id,
            uri=str(resource.get("uri", resource.get("name", "resource://unknown"))),
            name=resource.get("name"),
            title=resource.get("title"),
            description=resource.get("description"),
            mime_type=resource.get("mimeType") or resource.get("mime_type"),
            metadata=resource.get("metadata", {}),
        )

    def _build_prompt_descriptor(self, prompt: dict[str, Any]) -> McpPromptDescriptor:
        return McpPromptDescriptor(
            server_id=self._server.id,
            name=str(prompt.get("name", "prompt")),
            title=prompt.get("title"),
            description=prompt.get("description"),
            arguments=build_argument_descriptors(ensure_object(prompt.get("inputSchema") or {"type": "object"})),
            metadata=ensure_object(prompt.get("metadata") or {}),
        )

    def _connection_metadata(self) -> dict[str, Any]:
        return {
            "serverKind": self._server.source_type,
            "timeoutMs": self._server.timeout_ms or self._timeout_ms,
            "validation": self._validation.model_dump(mode="json"),
        }


def ensure_object(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {"type": "object"}
    return json.loads(json.dumps(value))


def normalize_string_list(*groups: Any) -> list[str]:
    values: set[str] = set()
    for group in groups:
        iterable = group if isinstance(group, list) else [group]
        for item in iterable:
            if isinstance(item, str) and item.strip():
                values.add(item.strip())
    return sorted(values)


def build_argument_descriptors(input_schema: dict[str, Any]) -> list[McpToolArgumentDescriptor]:
    properties = input_schema.get("properties") if isinstance(input_schema.get("properties"), dict) else {}
    required = set(input_schema.get("required") or []) if isinstance(input_schema.get("required"), list) else set()
    descriptors: list[McpToolArgumentDescriptor] = []
    for name, schema in properties.items():
        schema = ensure_object(schema)
        descriptors.append(McpToolArgumentDescriptor(
            name=str(name),
            title=schema.get("title"),
            description=schema.get("description"),
            type=str(schema.get("type", "unknown")),
            required=name in required,
            default_value=schema.get("default"),
            enum_values=list(schema.get("enum", [])) if isinstance(schema.get("enum"), list) else [],
            format=schema.get("format"),
            schema=schema,
        ))
    return descriptors
