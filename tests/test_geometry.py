import pytest

from app.geometry import bottom_center, point_in_polygon

SQUARE = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]


def test_point_inside_polygon() -> None:
    assert point_in_polygon((5.0, 5.0), SQUARE)


def test_point_outside_polygon() -> None:
    assert not point_in_polygon((12.0, 5.0), SQUARE)


@pytest.mark.parametrize("point", [(0.0, 0.0), (5.0, 0.0), (10.0, 5.0)])
def test_polygon_boundary_counts_as_inside(point: tuple[float, float]) -> None:
    assert point_in_polygon(point, SQUARE)


def test_rejects_invalid_polygon() -> None:
    with pytest.raises(ValueError, match="three vertices"):
        point_in_polygon((0.0, 0.0), [(0.0, 0.0), (1.0, 1.0)])


def test_bottom_center_of_box() -> None:
    assert bottom_center((2.0, 1.0, 8.0, 9.0)) == (5.0, 9.0)


def test_rejects_degenerate_box() -> None:
    with pytest.raises(ValueError, match="positive width and height"):
        bottom_center((2.0, 1.0, 2.0, 9.0))
