from fastapi.testclient import TestClient

from app.main import app, alert_sink, zones

client = TestClient(app)


def setup_function() -> None:
    zones.clear()
    alert_sink._by_event.clear()


def test_health_identifies_simulation_mode() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "mode": "simulation-only"}


def test_zone_entry_returns_mock_alert_only() -> None:
    zone_response = client.put(
        "/simulation/zones",
        json={"zone_id": "demo", "polygon": [[0, 0], [10, 0], [10, 10], [0, 10]]},
    )
    assert zone_response.status_code == 200

    response = client.post(
        "/simulation/events",
        json={"event_id": "example-1", "zone_id": "demo", "bbox": [2, 1, 8, 9]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["entered_zone"] is True
    assert body["point"] == {"x": 5.0, "y": 9.0}
    assert body["mock_alert"]["channel"] == "mock-only"
    assert body["mock_alert"]["duplicate"] is False


def test_repeated_event_is_deduplicated() -> None:
    client.put(
        "/simulation/zones",
        json={"zone_id": "demo", "polygon": [[0, 0], [10, 0], [10, 10], [0, 10]]},
    )
    request = {"event_id": "repeat-me", "zone_id": "demo", "bbox": [2, 1, 8, 9]}
    client.post("/simulation/events", json=request)
    response = client.post("/simulation/events", json=request)
    assert response.json()["mock_alert"]["duplicate"] is True


def test_unknown_zone_returns_not_found() -> None:
    response = client.post(
        "/simulation/events",
        json={"event_id": "orphan", "zone_id": "missing", "bbox": [2, 1, 8, 9]},
    )
    assert response.status_code == 404
