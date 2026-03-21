import base64

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_document_conversion_service
from app.models.document_ingestion import DocumentConversionErrorResponse, DocumentConversionRequest, DocumentConversionResponse
from app.services.document_conversion_service import DocumentConversionService, DocumentConversionServiceError

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post(
    "/convert/markdown",
    response_model=DocumentConversionResponse,
    responses={400: {"model": DocumentConversionErrorResponse}, 422: {"model": DocumentConversionErrorResponse}, 503: {"model": DocumentConversionErrorResponse}},
)
def convert_document_to_markdown(
    request: DocumentConversionRequest,
    service: DocumentConversionService = Depends(get_document_conversion_service),
) -> DocumentConversionResponse:
    try:
        content = base64.b64decode(request.base64_content.encode("utf-8"), validate=True)
        return service.convert_to_markdown(
            filename=request.filename,
            content=content,
            declared_content_type=request.declared_content_type,
            output_format=request.output_format,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={
            "success": False,
            "error": "malformed_request",
            "message": "base64_content must be valid base64.",
            "details": {},
        }) from exc
    except DocumentConversionServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail={
            "success": False,
            "error": exc.error,
            "message": exc.message,
            "details": exc.details,
        }) from exc
