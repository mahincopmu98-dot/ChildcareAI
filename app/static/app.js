const svg = document.querySelector("#room-svg");
const draftPath = document.querySelector("#draft-zone");
const savedPath = document.querySelector("#saved-zone");
const pointsLayer = document.querySelector("#draft-points");
const markerLayer = document.querySelector("#test-marker");
const zoneName = document.querySelector("#zone-name");
const feedback = document.querySelector("#feedback");
const saveButton = document.querySelector("#save-zone");
const evaluateButton = document.querySelector("#evaluate-point");
const activityList = document.querySelector("#activity-list");

let interactionMode = "zone";
let draftPoints = [];
let savedPolygon = null;
let testPoint = null;
let eventCount = 0;

function setFeedback(message, kind = "") {
  feedback.textContent = message;
  feedback.className = `form-feedback ${kind}`.trim();
}

function setMode(mode) {
  interactionMode = mode;
  const zoneSelected = mode === "zone";
  document.querySelector("#zone-mode").classList.toggle("selected", zoneSelected);
  document.querySelector("#zone-mode").setAttribute("aria-pressed", String(zoneSelected));
  document.querySelector("#subject-mode").classList.toggle("selected", !zoneSelected);
  document.querySelector("#subject-mode").setAttribute("aria-pressed", String(!zoneSelected));
  document.querySelector("#map-hint").textContent = zoneSelected
    ? "Click the map to add zone corners. Use at least three points."
    : savedPolygon
      ? "Click anywhere on the map to place a fabricated test point."
      : "Save a simulated zone first, then place a test point.";
  svg.style.cursor = zoneSelected ? "crosshair" : "copy";
}

function renderDraft() {
  const coords = draftPoints.map(([x, y]) => `${x},${y}`).join(" ");
  draftPath.setAttribute("d", draftPoints.length ? `M ${coords} ${draftPoints.length >= 3 ? "Z" : ""}` : "");
  pointsLayer.replaceChildren(...draftPoints.map(([x, y]) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "1.1");
    circle.setAttribute("class", "draft-point");
    return circle;
  }));
  document.querySelector("#vertex-count").textContent = `${draftPoints.length} / 3`;
  saveButton.disabled = draftPoints.length < 3;
}

function drawTestPoint(point) {
  markerLayer.replaceChildren();
  if (!point) return;
  const [x, y] = point;
  markerLayer.innerHTML = `<circle class="marker-halo" cx="${x}" cy="${y}" r="4.2"/><circle class="marker-body" cx="${x}" cy="${y}" r="2.2"/><circle class="marker-core" cx="${x}" cy="${y}" r=".55"/>`;
}

function mapPoint(event) {
  const rect = svg.getBoundingClientRect();
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const mapped = point.matrixTransform(svg.getScreenCTM().inverse());
  return [
    Math.max(0, Math.min(100, Number(mapped.x.toFixed(2)))),
    Math.max(0, Math.min(100, Number(mapped.y.toFixed(2)))),
  ];
}

svg.addEventListener("click", (event) => {
  const point = mapPoint(event);
  if (interactionMode === "zone") {
    draftPoints.push(point);
    renderDraft();
    setFeedback(draftPoints.length >= 3 ? "Zone boundary ready to save." : `Added corner ${draftPoints.length}. Add at least ${3 - draftPoints.length} more.`, draftPoints.length >= 3 ? "success" : "");
    return;
  }
  if (!savedPolygon) {
    setFeedback("Save a zone before placing a test point.", "error");
    return;
  }
  testPoint = point;
  drawTestPoint(testPoint);
  evaluateButton.disabled = false;
  document.querySelector("#step-three").classList.add("complete");
  document.querySelector("#map-hint").textContent = `Test point placed at (${point[0]}, ${point[1]}). Run the simulation to evaluate it.`;
  setFeedback("Fabricated point placed. No live sensor is connected.", "success");
});

function addActivity(outcome, zone, time) {
  if (eventCount === 0) activityList.replaceChildren();
  eventCount += 1;
  const row = document.createElement("div");
  row.className = "activity-row";
  const name = document.createElement("span");
  name.className = "event-name";
  const bullet = document.createElement("i");
  bullet.className = `event-bullet ${outcome.inside ? "" : "outside"}`;
  const nameText = document.createElement("span");
  nameText.textContent = `Test event ${String(eventCount).padStart(2, "0")}`;
  name.append(bullet, nameText);
  const zoneCell = document.createElement("span");
  zoneCell.textContent = zone;
  const chip = document.createElement("span");
  chip.className = `outcome-chip ${outcome.inside ? "" : "outside"}`;
  chip.textContent = outcome.inside ? "ZONE ENTRY · MOCK" : "OUTSIDE · MOCK";
  const timeCell = document.createElement("span");
  timeCell.className = "activity-time";
  timeCell.textContent = time;
  row.append(name, zoneCell, chip, timeCell);
  activityList.prepend(row);
  while (activityList.children.length > 5) activityList.lastElementChild.remove();
}

async function checkHealth() {
  const status = document.querySelector("#api-status");
  const orb = status.querySelector(".status-orb");
  try {
    const response = await fetch("/health", { cache: "no-store" });
    if (!response.ok) throw new Error("API unavailable");
    const body = await response.json();
    status.querySelector("strong").textContent = body.mode === "simulation-only" ? "Local API connected" : "Unexpected API mode";
    status.querySelector("small").textContent = "Simulation mode · no sensors";
    orb.className = `status-orb ${body.mode === "simulation-only" ? "online" : "offline"}`;
  } catch {
    status.querySelector("strong").textContent = "Local API unavailable";
    status.querySelector("small").textContent = "Start the local server to continue";
    orb.className = "status-orb offline";
  }
}

async function saveZone() {
  const name = zoneName.value.trim();
  if (!name || draftPoints.length < 3) return;
  saveButton.disabled = true;
  setFeedback("Saving this abstract zone in temporary memory…");
  try {
    const response = await fetch("/simulation/zones", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zone_id: name, polygon: draftPoints }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail?.[0]?.msg ?? body.detail ?? "Could not save zone.");
    savedPolygon = [...draftPoints];
    savedPath.setAttribute("d", `M ${savedPolygon.map(([x, y]) => `${x},${y}`).join(" ")} Z`);
    draftPath.setAttribute("d", "");
    pointsLayer.replaceChildren();
    document.querySelector("#step-two").classList.add("complete");
    document.querySelector("#result-zone").textContent = name.toUpperCase();
    document.querySelector("#result-state").textContent = "ZONE READY";
    document.querySelector("#map-hint").textContent = "Zone saved in temporary memory. Switch modes to place a test point.";
    setFeedback("Zone saved for this server session only.", "success");
    setMode("subject");
  } catch (error) {
    setFeedback(error.message || "Could not save zone.", "error");
    saveButton.disabled = false;
  }
}

async function evaluateTestPoint() {
  if (!savedPolygon || !testPoint) return;
  evaluateButton.disabled = true;
  const [x, y] = testPoint;
  const [x1, y1, x2] = [Math.max(0, x - 3), Math.max(0, y - 8), Math.min(100, x + 3)];
  const boxBottom = Math.max(y, y1 + 0.1);
  const eventId = `demo-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  try {
    const response = await fetch("/simulation/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, zone_id: zoneName.value.trim(), bbox: [x1, y1, x2, boxBottom] }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail ?? "Could not evaluate the simulation.");
    const entered = body.entered_zone;
    const title = document.querySelector("#result-title");
    const copy = document.querySelector("#result-copy");
    const indicator = document.querySelector("#result-indicator");
    title.textContent = entered ? "Point inside the zone" : "Point outside the zone";
    copy.textContent = entered
      ? "The simulated point crossed the drawn boundary. A mock-only event was created; no notification was sent."
      : "The simulated point is outside the drawn boundary. This result says nothing about real-world safety.";
    indicator.className = `result-indicator ${entered ? "alert" : "clear"}`;
    document.querySelector("#result-state").textContent = entered ? "MOCK EVENT" : "NO MOCK EVENT";
    addActivity({ inside: entered }, zoneName.value.trim(), new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setFeedback("Simulation complete. No real person or sensor was involved.", "success");
  } catch (error) {
    setFeedback(error.message || "Could not evaluate the simulation.", "error");
  } finally {
    evaluateButton.disabled = false;
  }
}

document.querySelector("#zone-mode").addEventListener("click", () => setMode("zone"));
document.querySelector("#subject-mode").addEventListener("click", () => setMode("subject"));
saveButton.addEventListener("click", saveZone);
evaluateButton.addEventListener("click", evaluateTestPoint);
document.querySelector("#reset-map").addEventListener("click", () => {
  draftPoints = [];
  savedPolygon = null;
  testPoint = null;
  eventCount = 0;
  draftPath.setAttribute("d", "");
  savedPath.setAttribute("d", "");
  pointsLayer.replaceChildren();
  markerLayer.replaceChildren();
  activityList.innerHTML = '<div class="empty-state"><span class="empty-icon">⌁</span><p>No simulated events yet</p><small>Run a test point to see an event here.</small></div>';
  document.querySelector("#step-two").classList.remove("complete");
  document.querySelector("#step-three").classList.remove("complete");
  document.querySelector("#result-title").textContent = "Ready when you are";
  document.querySelector("#result-copy").textContent = "Your simulation results will appear here. Nothing is monitoring a real space.";
  document.querySelector("#result-indicator").className = "result-indicator neutral";
  document.querySelector("#result-zone").textContent = "NO ZONE SAVED";
  document.querySelector("#result-state").textContent = "WAITING";
  evaluateButton.disabled = true;
  renderDraft();
  setMode("zone");
  setFeedback("Map draft cleared. A previously saved server-side zone remains only until the server restarts.");
});

checkHealth();
window.setInterval(checkHealth, 10000);
