from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.itinerary import ItineraryRequest, ItineraryResponse
from services.itinerary_service import generate_itinerary

router = APIRouter(prefix="/api/v1/itinerary", tags=["itinerary"])


@router.post("/generate", response_model=ItineraryResponse)
def create_itinerary(body: ItineraryRequest, db: Session = Depends(get_db)):
    return generate_itinerary(db, body)
