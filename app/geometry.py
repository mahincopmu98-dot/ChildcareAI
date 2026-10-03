"""Small, deterministic geometry helpers for simulated ground-plane zones."""

from __future__ import annotations

import math
from collections.abc import Sequence

Point = tuple[float, float]
Polygon = Sequence[Point]


def _point_on_segment(point: Point, start: Point, end: Point) -> bool:
    """Return whether point lies on the closed segment, with numeric tolerance."""
    px, py = point
    sx, sy = start
    ex, ey = end
    cross = (px - sx) * (ey - sy) - (py - sy) * (ex - sx)
    scale = max(1.0, abs(px), abs(py), abs(sx), abs(sy), abs(ex), abs(ey))
    if abs(cross) > 1e-9 * scale:
        return False
    return (
        min(sx, ex) - 1e-9 <= px <= max(sx, ex) + 1e-9
        and min(sy, ey) - 1e-9 <= py <= max(sy, ey) + 1e-9
    )


def point_in_polygon(point: Point, polygon: Polygon) -> bool:
    """Return whether a point is inside or on the boundary of a polygon.

    Coordinates are abstract 2D values. This function does not convert pixels
    to meters and makes no claim about physical distance or camera calibration.
    """
    if len(polygon) < 3:
        raise ValueError("A polygon must contain at least three vertices")
    values = (*point, *(coordinate for vertex in polygon for coordinate in vertex))
    if not all(math.isfinite(value) for value in values):
        raise ValueError("Point and polygon coordinates must be finite")

    inside = False
    x, y = point
    for index, current in enumerate(polygon):
        previous = polygon[index - 1]
        if _point_on_segment(point, previous, current):
            return True
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            crossing_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing_x:
                inside = not inside
    return inside


def bottom_center(box: tuple[float, float, float, float]) -> Point:
    """Calculate (x, y) ground-contact proxy from (x1, y1, x2, y2)."""
    x1, y1, x2, y2 = box
    if not all(math.isfinite(value) for value in box):
        raise ValueError("Bounding-box coordinates must be finite")
    if x2 <= x1 or y2 <= y1:
        raise ValueError("Bounding box must have positive width and height")
    return ((x1 + x2) / 2, y2)
