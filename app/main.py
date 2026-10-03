"""FastAPI endpoints for simulation-only zone rule demonstrations."""

from __future__ import annotations

import math
from typing import Annotated
from uuid import uuid4
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, model_validator

from app.alerts import MockAlertSink
from app.geometry import bottom_center, point_in_polygon

app = FastAPI(
    title="Care Monitor Simulator",
    version="0.1.0",
    description=(
        "SIMULATION ONLY. This prototype does not ingest camera feeds, identify people, "
        "measure physical distances, or send real alerts. It is not a safety device."
    ),
)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ZoneInput(BaseModel):
    zone_id: Annotated[str, Field(min_length=1, max_length=80)]
    # Polygon coordinates are abstract simulation coordinates, not meters.
    polygon: list[tuple[float, float]] = Field(min_length=3)

    @field_validator("polygon")
    @classmethod
    def coordinates_must_be_finite(
        cls, polygon: list[tuple[float, float]]
    ) -> list[tuple[float, float]]:
        if any(not math.isfinite(value) for point in polygon for value in point):
            raise ValueError("Polygon coordinates must be finite")
        return polygon


class SimulatedEventInput(BaseModel):
    event_id: Annotated[str, Field(default_factory=lambda: str(uuid4()), min_length=1, max_length=100)]
    zone_id: Annotated[str, Field(min_length=1, max_length=80)]
    # This is fabricated input for a local demo; no tracking identifier is stored.
    bbox: tuple[float, float, float, float]

    @model_validator(mode="after")
    def bounding_box_must_be_valid(self) -> "SimulatedEventInput":
        try:
            bottom_center(self.bbox)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc
        return self


zones: dict[str, list[tuple[float, float]]] = {}
alert_sink = MockAlertSink()


@app.get("/health")
def health() -> dict[str, str]:
    """Report API availability; does not indicate any sensor or safety status."""
    return {"status": "ok", "mode": "simulation-only"}


@app.put("/simulation/zones", summary="Create or replace a simulated risk zone")
def put_zone(zone: ZoneInput) -> dict[str, object]:
    """Register an abstract polygon in volatile process memory."""
    zones[zone.zone_id] = zone.polygon
    return {"zone_id": zone.zone_id, "vertices": len(zone.polygon), "mode": "simulation-only"}


@app.post("/simulation/events", summary="Evaluate a fabricated bounding-box event")
def simulate_event(event: SimulatedEventInput) -> dict[str, object]:
    """Evaluate the box bottom-center against a zone and create a mock alert."""
    polygon = zones.get(event.zone_id)
    if polygon is None:
        raise HTTPException(status_code=404, detail="Unknown simulated zone")

    contact_point = bottom_center(event.bbox)
    entered_zone = point_in_polygon(contact_point, polygon)
    result: dict[str, object] = {
        "event_id": event.event_id,
        "zone_id": event.zone_id,
        "point": {"x": contact_point[0], "y": contact_point[1]},
        "entered_zone": entered_zone,
        "mode": "simulation-only",
    }
    if entered_zone:
        alert, duplicate = alert_sink.emit(event.event_id, event.zone_id)
        result["mock_alert"] = {
            "alert_id": alert.alert_id,
            "channel": alert.channel,
            "duplicate": duplicate,
        }
    else:
        result["mock_alert"] = None
    return result


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    """Serve the local simulation dashboard."""
    return FileResponse(STATIC_DIR / "index.html")
