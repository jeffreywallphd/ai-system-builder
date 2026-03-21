from __future__ import annotations

import os
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.models.document_ingestion import (
    DocumentConversionMetadata,
    DocumentConversionResponse,
    DocumentConverterDescriptor,
    DocumentConversionWarning,
)

PASS_THROUGH_EXTENSIONS = frozenset({".md", ".markdown", ".txt"})
PASS_THROUGH_MIME_TYPES = frozenset({"text/markdown", "text/x-markdown", "text/plain"})


@dataclass(slots=True)
class DocumentConversionServiceError(Exception):
    error: str
    message: str
    status_code: int = 400
    details: dict[str, Any] = field(default_factory=dict)


class DocumentConversionService:
    def convert_to_markdown(
        self,
        *,
        filename: str,
        content: bytes,
        declared_content_type: str | None,
        output_format: str = "markdown",
    ) -> DocumentConversionResponse:
        normalized_filename = filename.strip()
        if not normalized_filename:
            raise DocumentConversionServiceError("malformed_request", "filename is required", 422)
        if output_format != "markdown":
            raise DocumentConversionServiceError(
                "unsupported_output_format",
                "Only markdown output is currently supported.",
                422,
                {"output_format": output_format},
            )

        normalized_content_type = declared_content_type.split(";")[0].strip().lower() if declared_content_type else None
        extension = Path(normalized_filename).suffix.lower() or None
        source_format = self._detect_source_format(extension, normalized_content_type)
        warnings: list[DocumentConversionWarning] = []
        started_at = time.perf_counter()

        if not content:
            raise DocumentConversionServiceError(
                "malformed_request",
                "Uploaded content is empty.",
                422,
                {"filename": normalized_filename},
            )

        if self._is_pass_through(extension, normalized_content_type):
            markdown = self._decode_text_content(content, normalized_filename)
            if normalized_content_type is None:
                warnings.append(
                    DocumentConversionWarning(
                        code="missing_content_type",
                        message="No content type was declared; pass-through relied on the file extension.",
                    )
                )
            return DocumentConversionResponse(
                filename=normalized_filename,
                content_type=normalized_content_type,
                extension=extension,
                source_format=source_format,
                markdown_content=markdown,
                converter=DocumentConverterDescriptor(id="python-pass-through"),
                warnings=warnings,
                metadata=DocumentConversionMetadata(
                    strategy="pass_through",
                    duration_ms=int((time.perf_counter() - started_at) * 1000),
                    detected_content_type=normalized_content_type,
                    declared_content_type=normalized_content_type,
                ),
            )

        markdown, converter_id, converter_version = self._convert_with_markitdown(normalized_filename, content)
        warnings.append(
            DocumentConversionWarning(
                code="conversion_performed",
                message=f"Converted '{normalized_filename}' to markdown using {converter_id}.",
            )
        )
        return DocumentConversionResponse(
            filename=normalized_filename,
            content_type=normalized_content_type,
            extension=extension,
            source_format=source_format,
            markdown_content=markdown,
            converter=DocumentConverterDescriptor(id=converter_id, version=converter_version),
            warnings=warnings,
            metadata=DocumentConversionMetadata(
                strategy="converted",
                duration_ms=int((time.perf_counter() - started_at) * 1000),
                detected_content_type=normalized_content_type,
                declared_content_type=normalized_content_type,
            ),
        )

    def _is_pass_through(self, extension: str | None, content_type: str | None) -> bool:
        return (extension in PASS_THROUGH_EXTENSIONS) or (content_type in PASS_THROUGH_MIME_TYPES)

    def _decode_text_content(self, content: bytes, filename: str) -> str:
        try:
            return content.decode("utf-8").replace("\r\n", "\n")
        except UnicodeDecodeError as exc:
            raise DocumentConversionServiceError(
                "conversion_failed",
                f"Unable to decode '{filename}' as UTF-8 text for markdown pass-through.",
                422,
                {"filename": filename},
            ) from exc

    def _convert_with_markitdown(self, filename: str, content: bytes) -> tuple[str, str, str | None]:
        try:
            markitdown_module = _load_markitdown_module()
            converter = markitdown_module.MarkItDown()
        except Exception as exc:  # pragma: no cover - exercised through tests via monkeypatching the loader
            raise DocumentConversionServiceError(
                "runtime_unavailable",
                "MarkItDown is unavailable in the Python runtime.",
                503,
                {"filename": filename},
            ) from exc

        suffix = Path(filename).suffix or ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary_file:
            temporary_file.write(content)
            temp_path = temporary_file.name

        try:
            result = converter.convert(temp_path)
            markdown = getattr(result, "text_content", None) or getattr(result, "markdown", None) or str(result)
            return markdown, "python-markitdown", getattr(markitdown_module, "__version__", None)
        except Exception as exc:
            raise DocumentConversionServiceError(
                "conversion_failed",
                f"MarkItDown failed to convert '{filename}'.",
                422,
                {"filename": filename},
            ) from exc
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    def _detect_source_format(self, extension: str | None, content_type: str | None) -> str:
        if extension in {".md", ".markdown"} or content_type in {"text/markdown", "text/x-markdown"}:
            return "markdown"
        if extension == ".txt" or content_type == "text/plain":
            return "text"
        if extension == ".pdf":
            return "pdf"
        if extension == ".docx":
            return "docx"
        if extension == ".pptx":
            return "pptx"
        return extension.lstrip(".") if extension else (content_type or "unknown")


def _load_markitdown_module() -> Any:
    import markitdown

    return markitdown
