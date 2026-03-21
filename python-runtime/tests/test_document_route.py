import base64

from fastapi.testclient import TestClient

from app.main import app
from app.services.document_conversion_service import DocumentConversionService


class _FakeResult:
    def __init__(self, text_content: str) -> None:
        self.text_content = text_content


class _FakeMarkItDown:
    def convert(self, path: str) -> _FakeResult:
        return _FakeResult(f"# Converted from {path.split('/')[-1]}")


class _FakeModule:
    __version__ = "0.1.5"
    MarkItDown = _FakeMarkItDown


def test_document_route_passes_through_markdown() -> None:
    client = TestClient(app)
    response = client.post(
        "/documents/convert/markdown",
        json={
            "filename": "notes.md",
            "declared_content_type": "text/markdown",
            "output_format": "markdown",
            "base64_content": base64.b64encode(b"# Title\n\nBody").decode("utf-8"),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["strategy"] == "pass_through"
    assert payload["markdown_content"] == "# Title\n\nBody"
    assert payload["source_format"] == "markdown"


def test_document_route_converts_binary_document(monkeypatch) -> None:
    monkeypatch.setattr("app.services.document_conversion_service._load_markitdown_module", lambda: _FakeModule)
    client = TestClient(app)
    response = client.post(
        "/documents/convert/markdown",
        json={
            "filename": "slides.pdf",
            "declared_content_type": "application/pdf",
            "output_format": "markdown",
            "base64_content": base64.b64encode(b"%PDF-1.4").decode("utf-8"),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["strategy"] == "converted"
    assert payload["converter"]["id"] == "python-markitdown"
    assert payload["output_format"] == "markdown"
    assert payload["source_format"] == "pdf"


def test_document_route_surfaces_runtime_unavailability(monkeypatch) -> None:
    def _broken_loader():
        raise RuntimeError("missing dependency")

    monkeypatch.setattr("app.services.document_conversion_service._load_markitdown_module", _broken_loader)
    client = TestClient(app)
    response = client.post(
        "/documents/convert/markdown",
        json={
            "filename": "slides.pdf",
            "declared_content_type": "application/pdf",
            "output_format": "markdown",
            "base64_content": base64.b64encode(b"%PDF-1.4").decode("utf-8"),
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "runtime_unavailable"


def test_document_conversion_service_rejects_empty_upload() -> None:
    service = DocumentConversionService()

    try:
        service.convert_to_markdown(filename="empty.txt", content=b"", declared_content_type="text/plain")
    except Exception as exc:  # noqa: BLE001
        assert getattr(exc, "error", None) == "malformed_request"
    else:
        raise AssertionError("Expected a malformed_request error for empty uploads")
