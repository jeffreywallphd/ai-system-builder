from __future__ import annotations

import json
import socketserver
import sys
import threading
from http.server import BaseHTTPRequestHandler
from pathlib import Path

from app.core.mcp_config import McpRuntimeConfig
from app.mcp.persistence import McpDefinitionRepository
from app.mcp.provisioning import LocalMcpServerProvisioner
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.mcp.models import LocalMcpToolDraft, McpServerUpsertRequest, McpToolExecutionRequest


def build_service(tmp_path: Path) -> McpService:
    config = McpRuntimeConfig(enabled=True, timeout_ms=5000, connect_on_startup=False, servers_json="[]", workspace_root=str(tmp_path))
    repository = McpDefinitionRepository(tmp_path)
    registry = McpRegistry(config, repository=repository)
    sessions = McpSessionManager(registry)
    provisioner = LocalMcpServerProvisioner(workspace_root=tmp_path, python_executable=sys.executable)
    return McpService(registry=registry, repository=repository, sessions=sessions, provisioner=provisioner)


def test_workspace_local_stdio_server_roundtrip(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    created = service.create_local_server(
        LocalMcpToolDraft(
            server_id="workspace-echo",
            server_name="Workspace Echo",
            tool_name="echo_payload",
            tool_description="Echo payload through workspace-local stdio MCP.",
            input_schema={"type": "object", "properties": {"message": {"type": "string"}}},
            output_schema={"type": "object"},
            code='return {"message": payload.get("message", "")}',
            connect_on_startup=True,
        )
    )
    assert created.server.source_type == "workspace-local"
    sync = service.sync_server("workspace-echo")
    assert sync.success is True, sync.error_message
    assert sync.snapshot is not None
    assert sync.snapshot.tools[0].name == "echo_payload"
    result = service.execute_tool(McpToolExecutionRequest(server_id="workspace-echo", tool_name="echo_payload", arguments={"message": "hello"}))
    assert result.status == "completed"
    assert result.structured_content["message"] == "hello"
    diagnostics = service.get_server_diagnostics("workspace-echo")
    assert diagnostics.retained_entry_count > 0


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        method = payload.get("method")
        request_id = payload.get("id")
        if method == "initialize":
            result = {"protocolVersion": "2024-11-05", "serverInfo": {"name": "remote"}, "capabilities": {"tools": {}, "resources": {}, "prompts": {}}}
        elif method == "tools/list":
            result = {"tools": [{"name": "echo", "inputSchema": {"type": "object", "properties": {"message": {"type": "string"}}}}]}
        elif method == "resources/list":
            result = {"resources": []}
        elif method == "prompts/list":
            result = {"prompts": []}
        elif method == "tools/call":
            args = (payload.get("params") or {}).get("arguments") or {}
            result = {"content": [{"type": "json", "json": args}], "structuredContent": {"echo": args}}
        else:
            result = {}
        raw = json.dumps({"jsonrpc": "2.0", "id": request_id, "result": result}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format, *args):
        return


def test_remote_http_server_roundtrip(tmp_path: Path) -> None:
    with socketserver.TCPServer(("127.0.0.1", 0), _Handler) as httpd:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{httpd.server_address[1]}/mcp"
        service = build_service(tmp_path)
        request = McpServerUpsertRequest(id="remote-http", name="Remote HTTP", transport="http", source_type="external-remote", url=url)
        service.upsert_server(request)
        test_result = service.test_connection(request)
        assert test_result.success is True, test_result.error_message
        result = service.execute_tool(McpToolExecutionRequest(server_id="remote-http", tool_name="echo", arguments={"message": "remote"}))
        assert result.status == "completed"
        assert result.structured_content["echo"]["message"] == "remote"
        httpd.shutdown()
