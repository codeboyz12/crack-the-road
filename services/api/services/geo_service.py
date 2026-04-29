import httpx


async def reverse_geocode(lat: float, lng: float) -> dict:
    """Nominatim reverse geocode — returns province/district/road_name."""
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"lat": lat, "lon": lng, "format": "json", "accept-language": "th"}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url, params=params, headers={"User-Agent": "RoadCrackMonitor/1.0"})
            data = r.json()
            addr = data.get("address", {})
            return {
                "address": data.get("display_name"),
                "province": addr.get("state") or addr.get("province"),
                "district": addr.get("county") or addr.get("city_district"),
                "road_name": addr.get("road"),
            }
    except Exception:
        return {"address": None, "province": None, "district": None, "road_name": None}
