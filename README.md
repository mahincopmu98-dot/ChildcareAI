# Care Monitor Simulator

A **simulation-only** Python/FastAPI starter for experimenting with a virtual-zone rule. It accepts fabricated bounding boxes and abstract polygons, then returns a mock event. It does not connect to a camera, detect or track a child, identify a person, measure meters, or notify anyone. It is not a safety device and must never replace active adult supervision.

## Architecture review

The proposed RGB + LWIR, object tracking, geofencing, proximity, face recognition, and notification system is a research and safety-critical undertaking—not a set of interchangeable plug-ins. Important constraints:

- **RGB and thermal:** An LWIR sensor measures apparent surface temperature and can help in some lighting conditions, but it does not guarantee detection through occlusion or identify a person as a child. Sensor registration, emissivity, range, reflections, and ambient conditions all affect results. Fuse signals with confidence and explicit unknown/degraded states; never interpret missing detections as proof of safety.
- **Detection and tracking:** YOLO/person labels do not establish identity, age, or caregiver status. Track IDs can switch, disappear, or be assigned incorrectly. Measure performance across the real room layout, lighting, clothing, mobility aids, and crowded conditions; expose uncertainty rather than silently suppressing alerts.
- **Risk-zone geofencing:** Bottom-center is a useful approximation, not a measured foot location. Polygon edges, camera perspective, occlusion, calibration drift, and image jitter can create missed or repeated crossings. Add hysteresis/debounce, zone review tools, and event audits; define inclusive edge behavior.
- **Two-meter proximity:** A homography maps points on a calibrated plane. It is not a general 3D distance estimator and becomes unreliable away from the calibration plane or when camera geometry changes. A numeric threshold should not be presented as an accurate physical distance until independently validated in the deployment space. Adult classification/authorization is a separate uncertain task.
- **Face recognition:** Face embeddings are sensitive biometric data. False matches and misses vary with pose, light, age, and camera quality; “unknown” does not mean malicious. Avoid facial recognition for the initial prototype. If later considered, require a documented necessity assessment, guardian consent, applicable legal/privacy review, strict access and retention controls, an alternative non-biometric workflow, and human verification. Do not store raw images or embeddings by default.
- **Alerts and operations:** SMS/push delivery can be delayed, duplicated, unavailable, or misrouted; a delivered message is not proof someone saw it. Use acknowledgements, escalation and offline/local behavior only after hazard analysis, and never depend on a single channel. Protect credentials and network interfaces; do not expose a camera or alert endpoint publicly.

## Starter behavior

- `GET /health` reports API availability only, not system/sensor safety.
- `PUT /simulation/zones` stores an abstract polygon in process memory.
- `POST /simulation/events` accepts a fabricated box, calculates its bottom-center point, checks the named polygon (boundary counts as inside), and returns a mock-only event if inside.
- No child identifier, image, video, embedding, camera feed, persistent database, Twilio, or FCM integration is included. State clears when the process exits.
- API docs and responses identify simulation-only operation. Do not send real personal data to these endpoints.

## Run locally

Requires Python 3.11 or newer.

1. Create and activate a virtual environment using your preferred Python environment manager.
2. Install the project and development extras: `pip install -e ".[dev]"`.
3. Run the tests: `pytest`.
4. Start the local API: `uvicorn app.main:app --reload`.
5. Open the local `/docs` route to try requests with fabricated values only. Stop the server with Ctrl+C.

The app binds to the local machine by default. Do not expose it to a network or use real child data.

## Staged implementation roadmap

1. **Simulation MVP (this repository):** Pure geometry, schema validation, in-memory mock event sink, API tests, and clear limitations. Establish boundary semantics and request-size/rate limits before any network exposure.
2. **Requirements and hazard analysis:** Define intended use, room/layout assumptions, failure modes, false-negative/false-positive targets, caregiver workflows, consent, privacy impact, access control, retention, incident response, and applicable legal requirements. Have caregivers and qualified safety/privacy reviewers approve requirements.
3. **Offline dataset evaluation:** Use consented, appropriately governed, non-identifying test material where feasible. Evaluate sensor confidence, zone edge cases, latency, lighting, occlusion, and tracking loss. Do not make live alerts; publish failure rates and uncertainty.
4. **Instrumented lab prototype:** Integrate one camera and detector behind replaceable interfaces on local hardware; no biometrics and no external alerts. Run in a controlled, unoccupied/mock setting first, then shadow mode with explicit consent and an independent observer. Record minimal, redacted metrics and delete test material on a schedule.
5. **Proximity/sensor calibration:** Only if justified, calibrate the planar ground area and RGB/thermal transform using known reference points; document valid region and recalibration triggers. Compare estimated values against independent measurements. Treat out-of-calibration, stale, occluded, or ambiguous observations as unknown.
6. **Human-reviewed alert pilot:** Add authenticated, audited, rate-limited notifications only after security and operational review. Test delivery failures, duplicates, disconnects, power loss, and acknowledgement/escalation. Keep a local operator workflow and ensure no alert can imply that a child is safe.
7. **Deployment review and ongoing validation:** Complete privacy/security and safety sign-off, caregiver training, monitoring, incident procedures, versioned model evaluation, rollback, and periodic reassessment. Do not market or deploy as a substitute for supervision or as a certified safety system without the relevant evidence and approvals.

## Browser dashboard

Open the root URL (`http://127.0.0.1:8000/`) for the local dashboard. Draw a polygon with at least three clicks, save it, switch to “Place a test point,” click the map, and evaluate the simulated point. The activity list exists only in the browser session; zone/event state is held in server memory. Resetting the map clears the browser draft but does not remove server state; restart the server to clear it.

The dashboard is a visual demo only. Its coordinates are abstract, its marker is fabricated, and it does not connect to cameras or trigger real notifications. Do not expose the development server to a network or use actual child information.

## Development

Dependencies and test configuration are in `pyproject.toml`. Zone and alert state is deliberately process-local and test-only. Keep hardware, biometric, persistent-storage, and outbound-notification integrations out of this starter unless their necessity and safety/privacy review are explicitly approved.
