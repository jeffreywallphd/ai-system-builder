from fastapi import APIRouter, Depends

from app.api.dependencies import get_mcp_service
from app.mcp.models import ListMcpToolsResponse, McpConnectionStatus, McpToolExecutionRequest, McpToolExecutionResult
from app.mcp.service import McpService

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/status", response_model=McpConnectionStatus)
def mcp_status(service: McpService = Depends(get_mcp_service)) -> McpConnectionStatus:
    return service.get_status()


@router.get("/tools", response_model=ListMcpToolsResponse)
def list_mcp_tools(service: McpService = Depends(get_mcp_service)) -> ListMcpToolsResponse:
    return service.list_tools()


@router.post("/tools/execute", response_model=McpToolExecutionResult)
def execute_mcp_tool(
    request: McpToolExecutionRequest,
    service: McpService = Depends(get_mcp_service),
) -> McpToolExecutionResult:
    return service.execute_tool(request)
