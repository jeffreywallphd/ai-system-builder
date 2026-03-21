from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_mcp_service
from app.mcp.models import (
    ListMcpToolsResponse,
    LocalMcpServerCreateResult,
    LocalMcpToolDraft,
    McpConnectionStatus,
    McpDeleteServerResult,
    McpDuplicateServerRequest,
    McpExportResult,
    McpImportRequest,
    McpImportResult,
    McpInvocationHistoryResponse,
    McpServerConnectionRequest,
    McpServerConnectionResult,
    McpServerDiagnosticsSnapshot,
    McpServerDisconnectRequest,
    McpServerSearchRequest,
    McpServerSearchResponse,
    McpServerTestConnectionResult,
    McpServerUpsertRequest,
    McpServerDescriptor,
    McpSyncResult,
    McpToolDescriptor,
    McpToolExecutionRequest,
    McpToolExecutionResult,
    McpToolSearchRequest,
    McpToolSearchResponse,
)
from app.mcp.service import McpService

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/status", response_model=McpConnectionStatus)
def mcp_status(service: McpService = Depends(get_mcp_service)) -> McpConnectionStatus:
    return service.get_status()


@router.get("/servers", response_model=McpServerSearchResponse)
def list_mcp_servers(service: McpService = Depends(get_mcp_service)) -> McpServerSearchResponse:
    return service.list_servers()


@router.get("/servers/search", response_model=McpServerSearchResponse)
def search_mcp_servers(
    query: str = Query(default="", max_length=120),
    status: list[str] | None = Query(default=None),
    transport: list[str] | None = Query(default=None),
    source_type: list[str] | None = Query(default=None, alias="sourceType"),
    limit: int = Query(default=20, ge=1, le=50),
    service: McpService = Depends(get_mcp_service),
) -> McpServerSearchResponse:
    return service.search_servers(McpServerSearchRequest(query=query, status=status or [], transport=transport or [], source_type=source_type or [], limit=limit))


@router.post("/servers", response_model=McpServerDescriptor)
def upsert_mcp_server(request: McpServerUpsertRequest, service: McpService = Depends(get_mcp_service)):
    try:
        return service.upsert_server(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/servers/validate")
def validate_mcp_server(request: McpServerUpsertRequest, service: McpService = Depends(get_mcp_service)):
    try:
        return service.validate_server(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/servers/test", response_model=McpServerTestConnectionResult)
def test_mcp_server(request: McpServerUpsertRequest, service: McpService = Depends(get_mcp_service)) -> McpServerTestConnectionResult:
    try:
        return service.test_connection(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/servers/{server_id}", response_model=McpDeleteServerResult)
def delete_mcp_server(server_id: str, service: McpService = Depends(get_mcp_service)) -> McpDeleteServerResult:
    return service.delete_server(server_id)


@router.post("/servers/duplicate")
def duplicate_mcp_server(request: McpDuplicateServerRequest, service: McpService = Depends(get_mcp_service)):
    try:
        return service.duplicate_server(request)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/servers/import", response_model=McpImportResult)
def import_mcp_servers(request: McpImportRequest, service: McpService = Depends(get_mcp_service)) -> McpImportResult:
    return service.import_servers(request)


@router.get("/servers/export", response_model=McpExportResult)
def export_mcp_servers(service: McpService = Depends(get_mcp_service)) -> McpExportResult:
    return service.export_servers()


@router.post("/servers/connect", response_model=McpServerConnectionResult)
def connect_mcp_server(request: McpServerConnectionRequest, service: McpService = Depends(get_mcp_service)) -> McpServerConnectionResult:
    try:
        return service.connect_server(request)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/servers/disconnect", response_model=McpServerConnectionResult)
def disconnect_mcp_server(request: McpServerDisconnectRequest, service: McpService = Depends(get_mcp_service)) -> McpServerConnectionResult:
    try:
        return service.disconnect_server(request.server_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/servers/reconnect", response_model=McpServerConnectionResult)
def reconnect_mcp_server(request: McpServerDisconnectRequest, service: McpService = Depends(get_mcp_service)) -> McpServerConnectionResult:
    try:
        return service.reconnect_server(request.server_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/servers/{server_id}/sync", response_model=McpSyncResult)
def sync_mcp_server(server_id: str, service: McpService = Depends(get_mcp_service)) -> McpSyncResult:
    return service.sync_server(server_id)


@router.get("/servers/{server_id}/diagnostics", response_model=McpServerDiagnosticsSnapshot)
def get_mcp_server_diagnostics(server_id: str, service: McpService = Depends(get_mcp_service)) -> McpServerDiagnosticsSnapshot:
    return service.get_server_diagnostics(server_id)


@router.get("/servers/{server_id}/invocations", response_model=McpInvocationHistoryResponse)
def get_mcp_server_invocations(server_id: str, service: McpService = Depends(get_mcp_service)) -> McpInvocationHistoryResponse:
    return service.get_invocation_history(server_id)


@router.post("/servers/local", response_model=LocalMcpServerCreateResult)
def create_local_mcp_server(request: LocalMcpToolDraft, service: McpService = Depends(get_mcp_service)) -> LocalMcpServerCreateResult:
    try:
        return service.create_local_server(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/tools", response_model=ListMcpToolsResponse)
def list_mcp_tools(service: McpService = Depends(get_mcp_service)) -> ListMcpToolsResponse:
    return service.list_tools()


@router.get("/tools/search", response_model=McpToolSearchResponse)
def search_mcp_tools(
    query: str = Query(default="", max_length=160),
    server_id: list[str] | None = Query(default=None, alias="serverId"),
    category: list[str] | None = Query(default=None),
    tag: list[str] | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    service: McpService = Depends(get_mcp_service),
) -> McpToolSearchResponse:
    return service.search_tools(McpToolSearchRequest(query=query, server_ids=server_id or [], categories=category or [], tags=tag or [], limit=limit))


@router.get("/tools/{tool_id:path}", response_model=McpToolDescriptor)
def get_mcp_tool_descriptor(tool_id: str, service: McpService = Depends(get_mcp_service)) -> McpToolDescriptor:
    try:
        return service.get_tool_descriptor(tool_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/tools/execute", response_model=McpToolExecutionResult)
def execute_mcp_tool(request: McpToolExecutionRequest, service: McpService = Depends(get_mcp_service)) -> McpToolExecutionResult:
    return service.execute_tool(request)


@router.get("/tools/invocations", response_model=McpInvocationHistoryResponse)
def get_all_invocations(service: McpService = Depends(get_mcp_service)) -> McpInvocationHistoryResponse:
    return service.get_invocation_history(None)
