from flask import Blueprint, jsonify, render_template_string
from database import get_db_connection
from datetime import datetime

rectify_bp = Blueprint("rectify", __name__)

@rectify_bp.route("/rectify/<int:incident_id>", methods=["GET"])
def render_rectify_page(incident_id):
    """Phase B: The Web-Based Button for responders"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Rectify Incident #{{ incident_id }}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px 20px; background: #f4f4f5; }
            .btn { background: #22c55e; color: white; border: none; padding: 20px 40px; font-size: 24px; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; margin-top: 20px; }
            .btn:active { transform: scale(0.98); }
        </style>
    </head>
    <body>
        <h2>Incident #{{ incident_id }}</h2>
        <p>Are you done providing relief?</p>
        <button class="btn" onclick="markRectified()">Mark as Rectified</button>
        <p id="status" style="margin-top:20px; font-weight: bold;"></p>

        <script>
            async function markRectified() {
                document.getElementById('status').innerText = 'Processing...';
                try {
                    const res = await fetch('/api/incidents/{{ incident_id }}/resolve-agent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await res.json();
                    if(data.success) {
                        document.getElementById('status').innerText = '✅ Success! Incident resolved and you are now available.';
                        document.getElementById('status').style.color = 'green';
                    } else {
                        document.getElementById('status').innerText = '❌ Error: ' + data.error;
                        document.getElementById('status').style.color = 'red';
                    }
                } catch(e) {
                    document.getElementById('status').innerText = '❌ Network Error';
                    document.getElementById('status').style.color = 'red';
                }
            }
        </script>
    </body>
    </html>
    """
    return render_template_string(html, incident_id=incident_id)

@rectify_bp.route("/api/incidents/<int:incident_id>/resolve-agent", methods=["POST"])
def resolve_incident_agent(incident_id):
    """Phase C: Autonomous Resolution Database Cleanup"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    
    # 1. Resolve Incident
    cursor.execute('''
        UPDATE incidents 
        SET status = 'resolved', resolved_at = ?
        WHERE id = ?
    ''', (now, incident_id))
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"success": False, "error": "Incident not found"}), 404
        
    # 2. Release Assigned Personnel
    cursor.execute('''
        UPDATE personnel
        SET status = 'available', assigned_incident_id = NULL
        WHERE assigned_incident_id = ?
    ''', (incident_id,))
    released_count = cursor.rowcount
    
    # Optional Timeline Event
    cursor.execute('''
        INSERT INTO incident_timeline (incident_id, event_type, description, user_name)
        VALUES (?, ?, ?, ?)
    ''', (incident_id, 'incident_resolved', f'AI Agent auto-approved resolution via Responder Trigger. Released {released_count} responders.', 'AI Agent'))
    
    conn.commit()
    conn.close()
    
    # Assuming socketio is imported in app.py we'll just let the dashboard poll, or the socket emits globally when implemented if needed.
    return jsonify({"success": True, "message": "Incident marked resolved and responders freed"})
