from __future__ import annotations

import json
from typing import Any, Dict, List

from app.mcp.models import McpServerConnectionRequest, McpToolDescriptor, McpToolExecutionRequest
from app.mcp.service import McpService

from .langchain_executor import LangChainExecutor


class NodeDispatcher:
    def __init__(
        self,
        langchain_executor: LangChainExecutor | None = None,
        mcp_service: McpService | None = None,
    ) -> None:
        self._langchain_executor = langchain_executor or LangChainExecutor(mcp_service=mcp_service)
        self._mcp_service = mcp_service

    def dispatch(self, node_type: str, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        if node_type.startswith("langchain."):
            return self._langchain_executor.execute(node_type, inputs=inputs, properties=properties)

        if node_type == "mcp.server_select":
            return self._dispatch_mcp_server_select(inputs=inputs, properties=properties)

        if node_type == "mcp.tool_catalog":
            return self._dispatch_mcp_tool_catalog(inputs=inputs, properties=properties)

        if node_type == "mcp.tool_call":
            return self._dispatch_mcp_tool_call(inputs=inputs, properties=properties)

        return {"inputs": inputs, "properties": properties, "note": "default passthrough"}

    def _dispatch_mcp_server_select(self, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        service = self._require_mcp_service()
        server_id = self._resolve_server_id(
            inputs.get("selection"),
            fallback=self._normalize_string(properties.get("serverId")),
        )
        if not server_id:
            raise ValueError("MCP server selection requires a configured serverId.")

        auto_connect = self._coerce_boolean(properties.get("autoConnect"), default=True)
        allow_reconnect = self._coerce_boolean(properties.get("allowReconnect"), default=True)

        servers_response = service.list_servers()
        selected_server = next((server for server in servers_response.servers if server.id == server_id), None)
        if selected_server is None:
            raise ValueError(f"Unknown configured MCP server '{server_id}'.")

        server_status = service.get_server_status(server_id)
        if auto_connect and not server_status.connected:
            if allow_reconnect and server_status.state in {"disconnected", "error"}:
                connection = service.reconnect_server(server_id)
            else:
                connection = service.connect_server(McpServerConnectionRequest(server_id=server_id))
            selected_server = connection.server
            server_status = connection.status

        runtime_status = service.get_status()
        server_handle = {
            "kind": "mcp-server-handle",
            "serverId": selected_server.id,
            "serverName": selected_server.name,
            "transport": selected_server.transport,
            "connected": selected_server.connected,
            "status": selected_server.status,
            "capabilities": dict(selected_server.capabilities),
            "autoConnect": auto_connect,
            "allowReconnect": allow_reconnect,
            "server": selected_server.model_dump(by_alias=True),
            "serverStatus": server_status.model_dump(by_alias=True),
        }

        return {
            "serverHandle": server_handle,
            "connectionStatus": runtime_status.model_dump(by_alias=True),
        }

    def _dispatch_mcp_tool_catalog(self, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        service = self._require_mcp_service()
        server_id = self._resolve_server_id(inputs.get("serverHandle"))
        if not server_id:
            raise ValueError("MCP tool catalog requires a serverHandle input.")

        search_query = self._normalize_string(properties.get("searchQuery")) or ""
        include_hidden_tools = self._coerce_boolean(properties.get("includeHiddenTools"), default=False)
        response = service.list_tools()
        tools = [
            self._map_tool_to_capability(tool)
            for tool in response.tools
            if tool.server_id == server_id and self._matches_tool(tool, search_query, include_hidden_tools)
        ]

        return {
            "tools": tools,
        }

    def _dispatch_mcp_tool_call(self, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        service = self._require_mcp_service()
        server_handle = inputs.get("serverHandle")
        tool_value = inputs.get("tool")
        arguments = {
            **self._coerce_configured_arguments(properties),
            **self._coerce_arguments(inputs.get("arguments")),
        }
        fail_on_missing_args = self._coerce_boolean(properties.get("failOnMissingArgs"), default=True)
        stringify_result = self._coerce_boolean(properties.get("stringifyResult"), default=True)

        server_id = (
            self._resolve_server_id(server_handle)
            or self._resolve_server_id(tool_value)
            or self._normalize_string(properties.get("serverId"))
        )
        tool_name = self._tool_name_from_value(tool_value) or self._normalize_string(properties.get("toolName"))

        if not server_id:
            raise ValueError("MCP tool execution requires a serverHandle or tool descriptor with a serverId.")

        if not tool_name:
            raise ValueError("MCP tool execution requires a tool input.")

        if fail_on_missing_args:
            missing_args = self._missing_required_arguments(tool_value or properties.get("toolDescriptor"), arguments)
            if missing_args:
                raise ValueError(
                    "MCP tool execution is missing required arguments: " + ", ".join(sorted(missing_args))
                )

        result = service.execute_tool(
            McpToolExecutionRequest(
                server_id=server_id,
                tool_name=tool_name,
                arguments=arguments,
            )
        )
        structured_content = dict(result.structured_content)
        tool_result = {
            **result.model_dump(by_alias=True),
            "content": [dict(item) for item in result.content],
            "structuredContent": structured_content,
        }

        return {
            "toolResult": tool_result,
            "resultText": self._result_text(
                [dict(item) for item in result.content],
                structured_content,
                result.error_message,
                stringify_result=stringify_result,
            ),
        }

    def _require_mcp_service(self) -> McpService:
        if self._mcp_service is None:
            raise ValueError("MCP runtime service is unavailable.")

        return self._mcp_service

    def _resolve_server_id(self, value: Any, fallback: str | None = None) -> str | None:
        if isinstance(value, str):
            return self._normalize_string(value) or fallback

        if isinstance(value, list):
            for item in value:
                resolved = self._resolve_server_id(item)
                if resolved:
                    return resolved
            return fallback

        if isinstance(value, dict):
            source = value.get("source") if isinstance(value.get("source"), dict) else {}
            server = value.get("server") if isinstance(value.get("server"), dict) else {}
            server_status = value.get("serverStatus") if isinstance(value.get("serverStatus"), dict) else {}
            for candidate in (
                value.get("serverId"),
                value.get("server_id"),
                value.get("id"),
                source.get("serverId"),
                source.get("server_id"),
                server.get("id"),
                server.get("serverId"),
                server_status.get("serverId"),
                server_status.get("server_id"),
            ):
                normalized = self._normalize_string(candidate)
                if normalized:
                    return normalized

        return fallback

    def _coerce_arguments(self, value: Any) -> Dict[str, Any]:
        return value if isinstance(value, dict) else {}

    def _coerce_configured_arguments(self, properties: Dict[str, Any]) -> Dict[str, Any]:
        arguments: Dict[str, Any] = {}
        for key, value in properties.items():
            if not isinstance(key, str) or not key.startswith("arg."):
                continue
            if value is None:
                continue
            arguments[key[4:]] = value
        return arguments

    def _tool_name_from_value(self, value: Any) -> str | None:
        if isinstance(value, str):
            return self._normalize_string(value)

        if isinstance(value, list):
            for item in value:
                name = self._tool_name_from_value(item)
                if name:
                    return name
            return None

        if isinstance(value, dict):
            source = value.get("source") if isinstance(value.get("source"), dict) else {}
            return (
                self._normalize_string(source.get("toolName"))
                or self._normalize_string(source.get("tool_name"))
                or self._normalize_string(value.get("name"))
                or self._normalize_string(value.get("toolName"))
                or self._normalize_string(value.get("routingName"))
            )

        return None

    def _missing_required_arguments(self, tool_value: Any, arguments: Dict[str, Any]) -> List[str]:
        descriptor = self._coerce_tool_descriptor(tool_value)
        input_schema = descriptor.get("inputSchema") if isinstance(descriptor.get("inputSchema"), dict) else {}
        required = input_schema.get("required")
        if not isinstance(required, list):
            return []

        return [
            str(name)
            for name in required
            if isinstance(name, str) and name.strip() and arguments.get(name) in (None, "")
        ]

    def _coerce_tool_descriptor(self, value: Any) -> Dict[str, Any]:
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    return item
            return {}

        return value if isinstance(value, dict) else {}

    def _matches_tool(self, tool: McpToolDescriptor, query: str, include_hidden_tools: bool) -> bool:
        hidden = self._tool_hidden(tool)
        if hidden and not include_hidden_tools:
            return False

        if not query:
            return True

        normalized_query = query.lower()
        haystack = " ".join(
            [
                tool.id,
                tool.server_id,
                tool.name,
                tool.title or "",
                tool.description or "",
                *tool.categories,
                *tool.tags,
            ]
        ).lower()
        return normalized_query in haystack

    def _tool_hidden(self, tool: McpToolDescriptor) -> bool:
        for value in (
            tool.metadata.get("hidden"),
            tool.metadata.get("isHidden"),
            tool.annotations.get("hidden"),
            tool.annotations.get("isHidden"),
        ):
            if isinstance(value, bool):
                return value
        return False

    def _map_tool_to_capability(self, tool: McpToolDescriptor) -> Dict[str, Any]:
        category = tool.categories[0] if tool.categories else None
        return {
            "id": tool.id,
            "identity": {
                "stableId": tool.id,
                "providerScopedId": f"{tool.server_id}:{tool.name}",
            },
            "routingName": tool.name,
            "displayName": tool.title or tool.name,
            "description": tool.description,
            "provider": {
                "kind": "mcp",
                "id": "python-mcp-runtime",
                "label": "MCP Tools",
            },
            "source": {
                "kind": "mcp",
                "serverId": tool.server_id,
                "toolName": tool.name,
            },
            "publication": {
                "isPublished": False,
                "title": tool.title or tool.name,
                "description": tool.description,
                "category": category,
                "slug": tool.name,
            },
            "inputSchema": dict(tool.input_schema),
            "outputSchema": dict(tool.output_schema),
            "annotations": dict(tool.annotations),
            "metadata": {
                **dict(tool.metadata),
                "descriptorId": tool.id,
                "categoryCount": len(tool.categories),
                "tagCount": len(tool.tags),
                "originalDescriptor": tool.model_dump(by_alias=True),
            },
        }

    def _result_text(
        self,
        content: List[Dict[str, Any]],
        structured_content: Dict[str, Any],
        error_message: str | None,
        *,
        stringify_result: bool,
    ) -> str:
        if stringify_result and structured_content:
            return json.dumps(structured_content, sort_keys=True)

        text_parts = [item.get("text") for item in content if isinstance(item.get("text"), str)]
        if text_parts:
            return "\n".join(text_parts)

        return error_message or ""

    def _coerce_boolean(self, value: Any, *, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        return default

    def _normalize_string(self, value: Any) -> str | None:
        if not isinstance(value, str):
            return None

        normalized = value.strip()
        return normalized or None
