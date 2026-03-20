import uuid
from typing import Any

from app.core.mcp_config import McpServerConfig
from app.mcp.models import (
    McpResourceDescriptor,
    McpServerDescriptor,
    McpServerStatus,
    McpToolArgumentDescriptor,
    McpToolDescriptor,
    McpToolDescriptorSource,
    McpToolExecutionRequest,
    McpToolExecutionResult,
    build_mcp_tool_id,
    utc_timestamp,
)


class McpConnectionError(RuntimeError):
    pass


class BoundedMcpClient:
    def __init__(self, server: McpServerConfig) -> None:
        self._server = server
        self._connected = False
        self._last_error: str | None = None
        self._checked_at: str | None = None
        self._connected_at: str | None = None
        self._disconnected_at: str | None = None

    @property
    def is_connected(self) -> bool:
        return self._connected

    def connect(self, force: bool = False) -> McpServerStatus:
        if force and self._connected:
            self.disconnect()

        self._checked_at = utc_timestamp()
        self._last_error = None

        if self._server.fail_connect:
            return self._fail(f"Unable to connect to MCP server '{self._server.id}'.")
        if self._server.transport == "stdio" and not self._server.command:
            return self._fail(f"Configured stdio MCP server '{self._server.id}' is missing a command.")
        if self._server.transport in {"http", "sse"} and not self._server.url:
            return self._fail(f"Configured {self._server.transport} MCP server '{self._server.id}' is missing a url.")

        self._connected = True
        self._connected_at = self._checked_at
        self._last_error = None
        return self.status()

    def disconnect(self) -> McpServerStatus:
        self._checked_at = utc_timestamp()
        self._connected = False
        self._last_error = None
        self._disconnected_at = self._checked_at
        return self.status()

    def status(self) -> McpServerStatus:
        tools = self.list_tools(allow_disconnected=True)
        resources = list(self._server.mock_resources)
        return McpServerStatus(
            server_id=self._server.id,
            name=self._server.name,
            transport=self._server.transport,
            configured=True,
            enabled=self._server.enabled,
            state="error" if self._last_error else ("connected" if self._connected else "disconnected"),
            connected=self._connected,
            checked_at=self._checked_at or utc_timestamp(),
            connected_at=self._connected_at,
            disconnected_at=self._disconnected_at,
            tool_count=len(tools),
            resource_count=len(resources),
            capabilities={
                "tools": bool(tools),
                "resources": bool(resources),
                "toolExecution": bool(tools),
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
            enabled=self._server.enabled,
            command=self._server.command,
            args=list(self._server.args),
            url=self._server.url,
            env=dict(self._server.env),
            timeout_ms=self._server.timeout_ms,
            connect_on_startup=self._server.connect_on_startup,
            status=current_status.state,
            connected=current_status.connected,
            checked_at=current_status.checked_at,
            connected_at=current_status.connected_at,
            disconnected_at=current_status.disconnected_at,
            tool_count=current_status.tool_count,
            resource_count=current_status.resource_count,
            capabilities=current_status.capabilities,
            metadata={**self._server.metadata, **current_status.metadata},
            error_message=current_status.error_message,
        )

    def list_tools(self, allow_disconnected: bool = False) -> list[McpToolDescriptor]:
        if not allow_disconnected and not self._connected:
            self.connect()

        descriptors: list[McpToolDescriptor] = []
        for tool in self._server.mock_tools:
            descriptors.append(self._build_tool_descriptor(tool))
        return descriptors

    def list_resources(self) -> list[McpResourceDescriptor]:
        if not self._connected:
            self.connect()

        descriptors: list[McpResourceDescriptor] = []
        for resource in self._server.mock_resources:
            descriptors.append(
                McpResourceDescriptor(
                    server_id=self._server.id,
                    uri=str(resource.get("uri", resource.get("name", "resource://unknown"))),
                    name=resource.get("name"),
                    title=resource.get("title"),
                    description=resource.get("description"),
                    mime_type=resource.get("mimeType") or resource.get("mime_type"),
                    metadata=resource.get("metadata", {}),
                )
            )
        return descriptors

    def execute_tool(self, request: McpToolExecutionRequest) -> McpToolExecutionResult:
        if not self._connected:
            self.connect()

        tool_name = request.tool_name.strip()
        args = dict(request.arguments)
        execution_id = request.execution_id or f"mcp-{uuid.uuid4().hex[:10]}"

        if tool_name == "echo":
            return McpToolExecutionResult(
                execution_id=execution_id,
                server_id=self._server.id,
                tool_name=tool_name,
                status="completed",
                content=[{"type": "json", "json": args}],
                structured_content={"echo": args},
                metadata={"transport": self._server.transport},
            )

        if tool_name == "sum_numbers":
            numbers = args.get("numbers", [])
            if not isinstance(numbers, list) or not all(isinstance(value, (int, float)) for value in numbers):
                return McpToolExecutionResult(
                    execution_id=execution_id,
                    server_id=self._server.id,
                    tool_name=tool_name,
                    status="failed",
                    content=[],
                    structured_content={},
                    error_message="sum_numbers requires a numeric 'numbers' array.",
                )

            total = sum(numbers)
            return McpToolExecutionResult(
                execution_id=execution_id,
                server_id=self._server.id,
                tool_name=tool_name,
                status="completed",
                content=[{"type": "text", "text": str(total)}],
                structured_content={"total": total},
                metadata={"count": len(numbers)},
            )

        if tool_name == "calculate":
            operation = str(args.get("operation", "")).strip().lower()
            left = args.get("left")
            right = args.get("right")
            if operation not in {"add", "subtract", "multiply", "divide"}:
                return McpToolExecutionResult(
                    execution_id=execution_id,
                    server_id=self._server.id,
                    tool_name=tool_name,
                    status="failed",
                    content=[],
                    structured_content={},
                    error_message="calculate requires an operation of add, subtract, multiply, or divide.",
                )
            if not isinstance(left, (int, float)) or not isinstance(right, (int, float)):
                return McpToolExecutionResult(
                    execution_id=execution_id,
                    server_id=self._server.id,
                    tool_name=tool_name,
                    status="failed",
                    content=[],
                    structured_content={},
                    error_message="calculate requires numeric left and right operands.",
                )
            if operation == "divide" and right == 0:
                return McpToolExecutionResult(
                    execution_id=execution_id,
                    server_id=self._server.id,
                    tool_name=tool_name,
                    status="failed",
                    content=[],
                    structured_content={},
                    error_message="Division by zero is not supported.",
                )

            result_value = {
                "add": left + right,
                "subtract": left - right,
                "multiply": left * right,
                "divide": left / right,
            }[operation]
            return McpToolExecutionResult(
                execution_id=execution_id,
                server_id=self._server.id,
                tool_name=tool_name,
                status="completed",
                content=[{"type": "text", "text": str(result_value)}],
                structured_content={
                    "operation": operation,
                    "left": left,
                    "right": right,
                    "result": result_value,
                },
                metadata={"serverKind": self._server.metadata.get("serverKind")},
            )

        available = {tool.name for tool in self.list_tools(allow_disconnected=True)}
        if tool_name not in available:
            raise ValueError(f"Unknown MCP tool '{tool_name}' for server '{self._server.id}'.")

        return McpToolExecutionResult(
            execution_id=execution_id,
            server_id=self._server.id,
            tool_name=tool_name,
            status="completed",
            content=[{"type": "json", "json": args}],
            structured_content={"arguments": args},
        )

    def _build_tool_descriptor(self, tool: dict[str, Any]) -> McpToolDescriptor:
        name = str(tool.get("name", "tool")).strip() or "tool"
        input_schema = ensure_object(tool.get("inputSchema") or tool.get("input_schema") or {"type": "object"})
        output_schema = ensure_object(tool.get("outputSchema") or tool.get("output_schema") or {})
        annotations = ensure_object(tool.get("annotations") or {})
        metadata = ensure_object(tool.get("metadata") or {})
        categories = normalize_string_list(
            tool.get("categories"),
            metadata.get("category"),
            metadata.get("categories"),
            annotations.get("category"),
            annotations.get("categories"),
        )
        tags = normalize_string_list(tool.get("tags"), metadata.get("tags"), annotations.get("tags"))

        return McpToolDescriptor(
            id=build_mcp_tool_id(self._server.id, name),
            server_id=self._server.id,
            source=McpToolDescriptorSource(server_id=self._server.id),
            name=name,
            title=normalize_optional_string(tool.get("title")),
            description=normalize_optional_string(tool.get("description")),
            input_schema=input_schema,
            output_schema=output_schema,
            arguments=build_argument_descriptors(input_schema, tool.get("arguments")),
            categories=categories,
            tags=tags,
            annotations=annotations,
            metadata=metadata,
        )

    def _fail(self, message: str) -> McpServerStatus:
        self._connected = False
        self._last_error = message
        self._disconnected_at = self._checked_at
        raise McpConnectionError(message)

    def _connection_metadata(self) -> dict[str, Any]:
        metadata: dict[str, Any] = {**self._server.metadata, "connectionMode": "bounded-runtime"}
        if self._server.transport == "stdio":
            metadata["startupMode"] = "bounded-stdio"
        elif self._server.transport in {"http", "sse"}:
            metadata["connectionMode"] = "bounded-remote"
        return metadata


def build_argument_descriptors(input_schema: dict[str, Any], explicit_arguments: Any) -> list[McpToolArgumentDescriptor]:
    if isinstance(explicit_arguments, list) and explicit_arguments:
        descriptors: list[McpToolArgumentDescriptor] = []
        for argument in explicit_arguments:
            if not isinstance(argument, dict):
                continue
            schema = ensure_object(argument.get("schema") or {})
            descriptors.append(
                McpToolArgumentDescriptor(
                    name=str(argument.get("name", "")).strip(),
                    title=normalize_optional_string(argument.get("title")),
                    description=normalize_optional_string(argument.get("description")),
                    type=normalize_type(argument.get("type") or schema.get("type")),
                    required=bool(argument.get("required", False)),
                    default_value=argument.get("defaultValue", schema.get("default")),
                    enum_values=normalize_enum_values(argument.get("enumValues") or schema.get("enum")),
                    format=normalize_optional_string(argument.get("format") or schema.get("format")),
                    schema_data=schema,
                )
            )
        return sorted(descriptors, key=lambda argument: argument.name)

    properties = ensure_plain_object(input_schema.get("properties"))
    required = {
        value.strip()
        for value in input_schema.get("required", [])
        if isinstance(value, str) and value.strip()
    }

    descriptors = [
        McpToolArgumentDescriptor(
            name=name,
            title=normalize_optional_string(schema.get("title")),
            description=normalize_optional_string(schema.get("description")),
            type=normalize_type(schema.get("type")),
            required=name in required,
            default_value=schema.get("default"),
            enum_values=normalize_enum_values(schema.get("enum")),
            format=normalize_optional_string(schema.get("format")),
            schema_data=schema,
        )
        for name, schema in sorted(properties.items())
    ]
    return descriptors


def ensure_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {"type": "object"}


def ensure_plain_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def normalize_optional_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def normalize_type(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, list):
        parts = [part.strip() for part in value if isinstance(part, str) and part.strip()]
        return " | ".join(parts) or "unknown"
    return "unknown"


def normalize_enum_values(value: Any) -> list[Any]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, (str, int, float, bool)) or item is None]


def normalize_string_list(*groups: Any) -> list[str]:
    values: set[str] = set()
    for group in groups:
        items = group if isinstance(group, list) else [group]
        for item in items:
            if not isinstance(item, str):
                continue
            normalized = item.strip()
            if normalized:
                values.add(normalized)
    return sorted(values)
