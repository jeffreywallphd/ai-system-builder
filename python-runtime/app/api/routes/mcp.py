from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_mcp_service
from app.mcp.models import (
    ListMcpToolsResponse,
    McpConnectionStatus,
    McpServerConnectionRequest,
    McpServerConnectionResult,
    McpServerDisconnectRequest,
    McpServerSearchRequest,
    McpServerSearchResponse,
    McpToolExecutionRequest,
    McpToolExecutionResult,
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
    limit: int = Query(default=20, ge=1, le=50),
    service: McpService = Depends(get_mcp_service),
) -> McpServerSearchResponse:
    return service.search_servers(
        McpServerSearchRequest(
            query=query,
            status=status or [],
            transport=transport or [],
            limit=limit,
        )
    )


@router.post("/servers/connect", response_model=McpServerConnectionResult)
def connect_mcp_server(
    request: McpServerConnectionRequest,
    service: McpService = Depends(get_mcp_service),
) -> McpServerConnectionResult:
    try:
        return service.connect_server(request)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/servers/disconnect", response_model=McpServerConnectionResult)
def disconnect_mcp_server(
    request: McpServerDisconnectRequest,
    service: McpService = Depends(get_mcp_service),
) -> McpServerConnectionResult:
    try:
        return service.disconnect_server(request.server_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/tools", response_model=ListMcpToolsResponse)
def list_mcp_tools(service: McpService = Depends(get_mcp_service)) -> ListMcpToolsResponse:
    return service.list_tools()


@router.post("/tools/execute", response_model=McpToolExecutionResult)
def execute_mcp_tool(
    request: McpToolExecutionRequest,
    service: McpService = Depends(get_mcp_service),
) -> McpToolExecutionResult:
    return service.execute_tool(request)
