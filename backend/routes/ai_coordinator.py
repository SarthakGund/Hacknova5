"""
AI Disaster Coordination Agent
──────────────────────────────
Routes:
  GET  /api/ai/status
  GET  /api/ai/cluster-sos          – cluster active SOS incidents by proximity
  POST /api/ai/generate-missions    – generate AI relief missions from clusters
  GET  /api/ai/missions             – list AI-generated missions (with reasoning)
  GET  /api/ai/reasoning/<id>       – full reasoning for a single mission
  POST /api/ai/assign               – AI auto-assigns best volunteer to mission
  GET  /api/ai/resource-shortage    – detect supply shortages in real time
  POST /api/ai/broadcast-alert      – generate + broadcast an AI alert message
"""

from flask import Blueprint, request, jsonify
from database import get_db_connection
from utils.geo_utils import calculate_distance
import os, json, re, math
from datetime import datetime, timezone
from google import genai

ai_coordinator_bp = Blueprint("ai_coordinator", __name__)

# ─────────────────────────────────────────────────────────────────────────────
# Gemini client (reuse existing key)
# ─────────────────────────────────────────────────────────────────────────────
_api_key = os.getenv("GOOGLE_API_KEY")
_gemini  = genai.Client(api_key=_api_key) if _api_key else None
_MODEL   = "gemini-2.0-flash"

CLUSTER_RADIUS_KM   = 1.5   # SOS signals within 1.5 km form one cluster
MIN_CLUSTER_SIZE    = 2     # minimum signals to trigger mission generation
LOW_STOCK_THRESHOLD = 0.25  # below 25 % = shortage


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _gemini_json(prompt: str) -> dict | None:
    """Call Gemini and parse the first JSON object from the response."""
    if not _gemini:
        return None
    try:
        resp = _gemini.models.generate_content(model=_MODEL, contents=prompt)
        text = resp.text or ""
        m = re.search(r"\{.*\}", text, re.DOTALL)
        return json.loads(m.group()) if m else None
    except Exception as e:
        print(f"[AI] Gemini error: {e}")
        return None


def _cluster_incidents(incidents: list) -> list[list[dict]]:
    """
    Simple greedy geographic clustering (DBSCAN-lite).
    Returns a list of clusters, each cluster is a list of incident dicts.
    """
    if not incidents:
        return []

    visited  = set()
    clusters = []

    for i, inc in enumerate(incidents):
        if i in visited:
            continue
        cluster = [inc]
        visited.add(i)
        for j, other in enumerate(incidents):
            if j in visited:
                continue
            try:
                dist = calculate_distance(
                    float(inc["latitude"]),  float(inc["longitude"]),
                    float(other["latitude"]), float(other["longitude"])
                )
                if dist <= CLUSTER_RADIUS_KM:
                    cluster.append(other)
                    visited.add(j)
            except (TypeError, ValueError):
                continue
        clusters.append(cluster)

    return clusters


def _centre(cluster: list[dict]) -> tuple[float, float]:
    """Return the geographic centroid of a cluster."""
    lats = [float(c["latitude"])  for c in cluster if c.get("latitude")]
    lngs = [float(c["longitude"]) for c in cluster if c.get("longitude")]
    return (sum(lats) / len(lats), sum(lngs) / len(lngs)) if lats else (0.0, 0.0)


def _nearest_resource(lat: float, lng: float, rtype: str | None, resources: list) -> dict | None:
    """Find closest resource matching rtype (or any if None)."""
    best, best_d = None, math.inf
    for r in resources:
        try:
            d = calculate_distance(lat, lng, float(r["latitude"]), float(r["longitude"]))
            if d < best_d and (rtype is None or rtype.lower() in r.get("name", "").lower()):
                best, best_d = r, d
        except (TypeError, ValueError):
            continue
    return best


def _nearest_volunteer(lat: float, lng: float, personnel: list) -> dict | None:
    """Find the closest available volunteer/responder."""
    best, best_d = None, math.inf
    for p in personnel:
        if p.get("status") not in ("available", "on_duty"):
            continue
        try:
            d = calculate_distance(lat, lng, float(p["latitude"]), float(p["longitude"]))
            if d < best_d:
                best, best_d = p, d
        except (TypeError, ValueError):
            continue
    return best


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@ai_coordinator_bp.route("/ai/status", methods=["GET"])
def ai_status():
    return jsonify({
        "ai_configured": _gemini is not None,
        "model": _MODEL,
        "cluster_radius_km": CLUSTER_RADIUS_KM,
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
    })


@ai_coordinator_bp.route("/ai/cluster-sos", methods=["GET"])
def cluster_sos():
    """
    Cluster active SOS-type incidents by GPS proximity.
    Returns each cluster with centroid, signal count, and top severity.
    """
    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT id, title, type, severity, latitude, longitude, status, created_at
        FROM   incidents
        WHERE  status IN ('active','pending_review')
        ORDER  BY created_at DESC
        LIMIT  200
    """)
    incidents = [dict(r) for r in cur.fetchall()]
    conn.close()

    raw_clusters = _cluster_incidents(incidents)

    result = []
    for idx, cluster in enumerate(raw_clusters):
        lat, lng = _centre(cluster)
        severities = ["low", "medium", "high", "critical"]
        top_sev    = max(cluster, key=lambda x: severities.index(x.get("severity", "low")) if x.get("severity") in severities else 0)
        result.append({
            "cluster_id": idx + 1,
            "signal_count": len(cluster),
            "centroid": {"lat": round(lat, 6), "lng": round(lng, 6)},
            "top_severity": top_sev.get("severity", "low"),
            "incident_types": list({i.get("type","unknown") for i in cluster}),
            "incidents": [i["id"] for i in cluster],
        })

    return jsonify({
        "total_active_incidents": len(incidents),
        "cluster_count": len(result),
        "clusters": result,
    })


@ai_coordinator_bp.route("/ai/generate-missions", methods=["POST"])
def generate_missions():
    """
    For each qualifying cluster, ask Gemini to generate a structured
    relief mission with full explainable reasoning.
    Missions are stored in the ai_missions table (created on first use).
    """
    conn = get_db_connection()
    cur  = conn.cursor()

    # Ensure ai_missions table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ai_missions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            cluster_id   INTEGER,
            title        TEXT,
            description  TEXT,
            location     TEXT,
            lat          REAL,
            lng          REAL,
            resource_type TEXT,
            aid_type     TEXT,
            reasoning    TEXT,
            volunteer_id INTEGER,
            status       TEXT DEFAULT 'pending',
            on_chain_id  INTEGER,
            created_at   TEXT,
            completed_at TEXT
        )
    """)
    conn.commit()

    # Fetch active incidents + resources + available personnel
    cur.execute("""
        SELECT id, title, type, severity, latitude, longitude, status, description, created_at
        FROM   incidents WHERE status IN ('active','pending_review') LIMIT 200
    """)
    incidents = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT id, name, type, latitude, longitude, quantity, status
        FROM   resources WHERE status != 'depleted' LIMIT 100
    """)
    resources = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT id, name, role, latitude, longitude, status
        FROM   personnel WHERE status IN ('available','on_duty') LIMIT 100
    """)
    personnel = [dict(r) for r in cur.fetchall()]

    raw_clusters = _cluster_incidents(incidents)
    created_missions = []

    for idx, cluster in enumerate(raw_clusters):
        if len(cluster) < MIN_CLUSTER_SIZE:
            continue

        lat, lng = _centre(cluster)
        nearest_res = _nearest_resource(lat, lng, None, resources)
        nearest_vol = _nearest_volunteer(lat, lng, personnel)

        # Build context for Gemini
        cluster_summary = {
            "signal_count":  len(cluster),
            "incident_types": list({i.get("type", "unknown") for i in cluster}),
            "severities":    [i.get("severity","low") for i in cluster],
            "descriptions":  [i.get("description","") for i in cluster[:5]],
            "centroid":      {"lat": round(lat,6), "lng": round(lng,6)},
        }
        resource_summary = {
            "name":     nearest_res.get("name")     if nearest_res else "unknown",
            "type":     nearest_res.get("type")     if nearest_res else "unknown",
            "quantity": nearest_res.get("quantity") if nearest_res else 0,
        }
        volunteer_summary = {
            "id":   nearest_vol.get("id")   if nearest_vol else None,
            "name": nearest_vol.get("name") if nearest_vol else "unassigned",
            "role": nearest_vol.get("role") if nearest_vol else "unknown",
        }

        prompt = f"""
You are ResQNet AI Coordinator. Based on the disaster signals below, generate ONE relief mission.

SOS Cluster:
{json.dumps(cluster_summary, indent=2)}

Nearest Available Resource:
{json.dumps(resource_summary, indent=2)}

Nearest Available Volunteer:
{json.dumps(volunteer_summary, indent=2)}

Respond ONLY as JSON with these exact keys:
{{
  "title": "Short mission title (≤60 chars)",
  "description": "What the volunteer must do (1-2 sentences)",
  "resource_type": "specific item to deliver e.g. insulin / water / food",
  "aid_type": "Medical | Food | Water | Shelter | Search | Evacuation",
  "location": "Human-readable location description",
  "reasoning": {{
    "sos_signals": "Why this cluster is prioritised",
    "resource_choice": "Why this resource was selected",
    "volunteer_choice": "Why this volunteer was selected",
    "route_note": "Any known route considerations"
  }}
}}
"""

        ai_result = _gemini_json(prompt)

        # Fallback if Gemini unavailable
        if not ai_result:
            severities_map = {"critical": 4, "high": 3, "medium": 2, "low": 1}
            top_sev = max(cluster, key=lambda x: severities_map.get(x.get("severity","low"), 1))
            ai_result = {
                "title":         f"Emergency Relief – Cluster {idx + 1}",
                "description":   f"Deliver aid to {len(cluster)} affected locations near centroid.",
                "resource_type": cluster[0].get("type", "supplies"),
                "aid_type":      "Other",
                "location":      f"Lat {round(lat,4)}, Lng {round(lng,4)}",
                "reasoning": {
                    "sos_signals":     f"{len(cluster)} SOS signals detected within {CLUSTER_RADIUS_KM} km",
                    "resource_choice": resource_summary["name"],
                    "volunteer_choice": volunteer_summary["name"],
                    "route_note":      "No route data – proceed with caution",
                },
            }

        reasoning_json = json.dumps(ai_result.get("reasoning", {}))

        cur.execute("""
            INSERT INTO ai_missions
              (cluster_id, title, description, location, lat, lng,
               resource_type, aid_type, reasoning, volunteer_id, status, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            idx + 1,
            ai_result.get("title",        "Relief Mission"),
            ai_result.get("description",  ""),
            ai_result.get("location",     ""),
            lat, lng,
            ai_result.get("resource_type",""),
            ai_result.get("aid_type",     "Other"),
            reasoning_json,
            nearest_vol.get("id") if nearest_vol else None,
            "pending",
            _now_iso(),
        ))
        conn.commit()
        mission_id = cur.lastrowid

        created_missions.append({
            "mission_id":    mission_id,
            "title":         ai_result.get("title"),
            "description":   ai_result.get("description"),
            "location":      ai_result.get("location"),
            "resource_type": ai_result.get("resource_type"),
            "aid_type":      ai_result.get("aid_type"),
            "reasoning":     ai_result.get("reasoning"),
            "volunteer":     volunteer_summary,
            "cluster_size":  len(cluster),
        })

    conn.close()
    return jsonify({
        "missions_created": len(created_missions),
        "missions": created_missions,
    }), 201


@ai_coordinator_bp.route("/ai/missions", methods=["GET"])
def list_ai_missions():
    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ai_missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cluster_id INTEGER, title TEXT, description TEXT,
            location TEXT, lat REAL, lng REAL,
            resource_type TEXT, aid_type TEXT, reasoning TEXT,
            volunteer_id INTEGER, status TEXT DEFAULT 'pending',
            on_chain_id INTEGER, created_at TEXT, completed_at TEXT
        )
    """)
    status_filter = request.args.get("status")
    if status_filter:
        cur.execute("SELECT * FROM ai_missions WHERE status=? ORDER BY created_at DESC", (status_filter,))
    else:
        cur.execute("SELECT * FROM ai_missions ORDER BY created_at DESC LIMIT 100")
    missions = []
    for row in cur.fetchall():
        m = dict(row)
        try:
            m["reasoning"] = json.loads(m["reasoning"] or "{}")
        except Exception:
            pass
        missions.append(m)
    conn.close()
    return jsonify({"missions": missions, "count": len(missions)})


@ai_coordinator_bp.route("/ai/reasoning/<int:mission_id>", methods=["GET"])
def mission_reasoning(mission_id: int):
    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM ai_missions WHERE id=?", (mission_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Mission not found"}), 404
    m = dict(row)
    try:
        m["reasoning"] = json.loads(m["reasoning"] or "{}")
    except Exception:
        pass
    return jsonify(m)


@ai_coordinator_bp.route("/ai/assign", methods=["POST"])
def auto_assign():
    """
    Auto-assign the best available volunteer to a pending AI mission.
    Body: { "mission_id": 3 }
    """
    data       = request.get_json(force=True) or {}
    mission_id = data.get("mission_id")
    if not mission_id:
        return jsonify({"error": "mission_id required"}), 400

    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM ai_missions WHERE id=?", (mission_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Mission not found"}), 404

    m = dict(row)
    cur.execute("""
        SELECT id, name, role, latitude, longitude, status
        FROM   personnel WHERE status='available' LIMIT 100
    """)
    personnel = [dict(r) for r in cur.fetchall()]
    nearest   = _nearest_volunteer(m["lat"], m["lng"], personnel)

    if not nearest:
        conn.close()
        return jsonify({"error": "No available volunteers"}), 409

    cur.execute(
        "UPDATE ai_missions SET volunteer_id=?, status='assigned' WHERE id=?",
        (nearest["id"], mission_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "mission_id":   mission_id,
        "assigned_to":  nearest,
        "status":       "assigned",
    })


@ai_coordinator_bp.route("/ai/resource-shortage", methods=["GET"])
def resource_shortage():
    """
    Detect resources running low (quantity < LOW_STOCK_THRESHOLD × max).
    Returns shortages with nearest unmet demand cluster.
    """
    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM resources LIMIT 200")
    resources = [dict(r) for r in cur.fetchall()]
    conn.close()

    if not resources:
        return jsonify({"shortages": [], "total_checked": 0})

    max_qty    = max((r.get("quantity") or 0) for r in resources) or 1
    threshold  = max_qty * LOW_STOCK_THRESHOLD
    shortages  = [r for r in resources if (r.get("quantity") or 0) <= threshold]

    return jsonify({
        "threshold_units": round(threshold, 2),
        "shortage_count":  len(shortages),
        "shortages":       shortages,
        "total_checked":   len(resources),
    })


@ai_coordinator_bp.route("/ai/broadcast-alert", methods=["POST"])
def broadcast_alert():
    """
    Generate an alert message with Gemini and broadcast via existing
    notification system.
    Body: { "disaster_type": "flood", "affected_area": "Sector 7", "severity": "high" }
    """
    data     = request.get_json(force=True) or {}
    dtype    = data.get("disaster_type", "unknown")
    area     = data.get("affected_area",  "unknown area")
    severity = data.get("severity",       "high")

    prompt = f"""
Generate a short, clear emergency broadcast message for a disaster management system.
Disaster type: {dtype}
Affected area: {area}
Severity: {severity}

Respond ONLY as JSON:
{{
  "title": "Short alert title (≤60 chars)",
  "message": "Clear 2-3 sentence alert for citizens and responders.",
  "instructions": ["action 1", "action 2", "action 3"],
  "urgency": "immediate | high | medium"
}}
"""
    ai_result = _gemini_json(prompt)
    if not ai_result:
        ai_result = {
            "title":        f"{dtype.capitalize()} Alert – {area}",
            "message":      f"A {severity} severity {dtype} has been detected in {area}. Please follow evacuation protocols.",
            "instructions": ["Move to higher ground", "Avoid flood zones", "Contact emergency services"],
            "urgency":      "high",
        }

    # Persist as notification via notifications table
    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO notifications (title, message, type, created_at)
            VALUES (?,?,?,?)
        """, (ai_result["title"], ai_result["message"], "broadcast", _now_iso()))
        conn.commit()
    except Exception:
        pass
    conn.close()

    return jsonify({
        "alert": ai_result,
        "broadcast": True,
        "generated_by": "ResQNet AI Coordinator",
    }), 201


@ai_coordinator_bp.route("/ai/mission/<int:mission_id>/complete", methods=["POST"])
def complete_ai_mission(mission_id: int):
    """Mark an AI mission as completed (called from mobile app or dashboard)."""
    data        = request.get_json(force=True) or {}
    on_chain_id = data.get("on_chain_id")  # optional NFT token id

    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute(
        "UPDATE ai_missions SET status='completed', completed_at=?, on_chain_id=? WHERE id=?",
        (_now_iso(), on_chain_id, mission_id)
    )
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Mission not found"}), 404
    conn.commit()
    conn.close()

    return jsonify({"mission_id": mission_id, "status": "completed", "on_chain_id": on_chain_id})
