from typing import Any, Literal

from pydantic import BaseModel, Field


class DocumentConversionRequest(BaseModel):
    filename: str
    declared_content_type: str | None = None
    output_format: Literal["markdown"] = "markdown"
    base64_content: str


class DocumentConversionWarning(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class DocumentConverterDescriptor(BaseModel):
    id: str
    version: str | None = None


class DocumentConversionMetadata(BaseModel):
    strategy: Literal["pass_through", "converted"]
    duration_ms: int | None = None
    detected_content_type: str | None = None
    declared_content_type: str | None = None


class DocumentConversionResponse(BaseModel):
    success: bool = True
    filename: str
    content_type: str | None = None
    extension: str | None = None
    source_format: str
    output_format: Literal["markdown"] = "markdown"
    markdown_content: str
    converter: DocumentConverterDescriptor
    warnings: list[DocumentConversionWarning] = Field(default_factory=list)
    metadata: DocumentConversionMetadata


class DocumentConversionErrorResponse(BaseModel):
    success: bool = False
    error: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
