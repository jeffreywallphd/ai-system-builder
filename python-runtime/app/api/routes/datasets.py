from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_dataset_generation_service
from app.models.requests import DatasetGenerationRequest
from app.models.responses import DatasetGenerationResponse
from app.services.dataset_generation_service import DatasetGenerationService

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/generate", response_model=DatasetGenerationResponse)
def generate_dataset_examples(
    request: DatasetGenerationRequest,
    service: DatasetGenerationService = Depends(get_dataset_generation_service),
) -> DatasetGenerationResponse:
    try:
        return service.generate(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
