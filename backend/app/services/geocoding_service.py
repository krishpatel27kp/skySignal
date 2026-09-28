import httpx
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

async def reverse_geocode(lat: float, lon: float) -> Tuple[Optional[str], Optional[str]]:
    """
    Calls OpenStreetMap Nominatim API to get city and state from coordinates.
    Returns (city, state). Fallbacks are used if 'city' is not directly available.
    Does not block the critical path and returns (None, None) on failure.
    """
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1"
    headers = {
        "User-Agent": "SkySignal-SIH26069-App/1.0"
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            address = data.get("address", {})
            if not address:
                return None, None
                
            # Fallback logic for city
            city = address.get("city") or address.get("town") or address.get("district") or address.get("county")
            state = address.get("state")
            
            return city, state
    except Exception as e:
        logger.warning(f"Geocoding failed for lat={lat}, lon={lon}: {str(e)}")
        return None, None
