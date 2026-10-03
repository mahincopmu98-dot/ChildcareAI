"""In-memory alert sink for demonstrations; never sends notifications."""

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4


@dataclass(frozen=True)
class MockAlert:
    alert_id: str
    event_id: str
    zone_id: str
    created_at: datetime
    channel: str = "mock-only"


class MockAlertSink:
    """Deduplicating, process-local sink. Alerts disappear when the process exits."""

    def __init__(self) -> None:
        self._by_event: dict[str, MockAlert] = {}

    def emit(self, event_id: str, zone_id: str) -> tuple[MockAlert, bool]:
        existing = self._by_event.get(event_id)
        if existing is not None:
            return existing, True
        alert = MockAlert(
            alert_id=str(uuid4()),
            event_id=event_id,
            zone_id=zone_id,
            created_at=datetime.now(timezone.utc),
        )
        self._by_event[event_id] = alert
        return alert, False
