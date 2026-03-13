from flask import Blueprint, request, jsonify
from database import get_db_connection
from datetime import datetime
from utils.file_utils import save_file
from utils.notification_utils import broadcast_incident_notification

incidents_bp = Blueprint('incidents', __name__)

@incidents_bp.route('/incidents', methods=['GET'])
def get_incidents():
    """Get all incidents with optional filters"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get query parameters
    status = request.args.get('status')
    severity = request.args.get('severity')
    incident_type = request.args.get('type')
    
    query = 'SELECT * FROM incidents WHERE 1=1'
    params = []
    
    if status:
        query += ' AND status = ?'
        params.append(status)
    
    if severity:
        query += ' AND severity = ?'
        params.append(severity)
    
    if incident_type:
        query += ' AND type = ?'
        params.append(incident_type)
    
    query += ' ORDER BY created_at DESC'
    
    cursor.execute(query, params)
    incidents = [dict(row) for row in cursor.fetchall()]
    
    # Get personnel and resources for each incident
    for incident in incidents:
        # Get assigned personnel
        cursor.execute('''
            SELECT name, role, status FROM personnel
            WHERE assigned_incident_id = ?
        ''', (incident['id'],))
        incident['responders'] = [dict(row) for row in cursor.fetchall()]
        
        # Get assigned resources
        cursor.execute('''
            SELECT name, type, status FROM resources
            WHERE assigned_incident_id = ?
        ''', (incident['id'],))
        incident['resources'] = [dict(row) for row in cursor.fetchall()]
        
        # Get attachments count
        cursor.execute('''
            SELECT COUNT(*) as count FROM attachments
            WHERE incident_id = ?
        ''', (incident['id'],))
        incident['attachments_count'] = cursor.fetchone()['count']
        
        # Format location
        incident['location'] = {
            'lat': incident['lat'],
            'lng': incident['lng']
        }
    
    conn.close()
    
    return jsonify({
        'success': True,
        'incidents': incidents,
        'count': len(incidents)
    })

@incidents_bp.route('/incidents/<int:incident_id>', methods=['GET'])
def get_incident(incident_id):
    """Get detailed incident information"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM incidents WHERE id = ?', (incident_id,))
    incident = cursor.fetchone()
    
    if not incident:
        conn.close()
        return jsonify({'success': False, 'error': 'Incident not found'}), 404
    
    incident = dict(incident)
    
    # Get personnel
    cursor.execute('''
        SELECT * FROM personnel
        WHERE assigned_incident_id = ?
    ''', (incident_id,))
    incident['responders'] = [dict(row) for row in cursor.fetchall()]
    
    # Get resources
    cursor.execute('''
        SELECT * FROM resources
        WHERE assigned_incident_id = ?
    ''', (incident_id,))
    incident['resources'] = [dict(row) for row in cursor.fetchall()]
    
    # Get timeline
    cursor.execute('''
        SELECT * FROM incident_timeline
        WHERE incident_id = ?
        ORDER BY created_at DESC
    ''', (incident_id,))
    incident['timeline'] = [dict(row) for row in cursor.fetchall()]
    
    # Get attachments
    cursor.execute('''
        SELECT * FROM attachments
        WHERE incident_id = ?
        ORDER BY created_at DESC
    ''', (incident_id,))
    incident['attachments'] = [dict(row) for row in cursor.fetchall()]
    
    # Get communications
    cursor.execute('''
        SELECT * FROM communications
        WHERE incident_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ''', (incident_id,))
    incident['communications'] = [dict(row) for row in cursor.fetchall()]
    
    # Format location
    incident['location'] = {
        'lat': incident['lat'],
        'lng': incident['lng']
    }
    
    conn.close()
    
    return jsonify({
        'success': True,
        'incident': incident
    })

@incidents_bp.route('/incidents', methods=['POST'])
def create_incident():
    """Create a new incident"""
    data = request.get_json()
    
    required_fields = ['title', 'type', 'severity', 'lat', 'lng']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO incidents (
            title, description, type, severity, status,
            lat, lng, location_name, report_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['title'],
        data.get('description', ''),
        data['type'],
        data['severity'],
        data.get('status', 'active'),
        data['lat'],
        data['lng'],
        data.get('location_name', ''),
        data.get('report_source', 'web')
    ))
    
    incident_id = cursor.lastrowid
    
    # Add timeline event
    cursor.execute('''
        INSERT INTO incident_timeline (incident_id, event_type, description, user_name)
        VALUES (?, ?, ?, ?)
    ''', (incident_id, 'incident_created', f'Incident reported: {data["title"]}', 'System'))
    
    conn.commit()
    conn.close()
    
    # Broadcast notification
    notification = broadcast_incident_notification(
        incident_id,
        f"New {data['severity'].upper()} Incident",
        data['title'],
        'critical' if data['severity'] == 'critical' else 'high'
    )
    
    return jsonify({
        'success': True,
        'incident_id': incident_id,
        'notification': notification
    }), 201

@incidents_bp.route('/incidents/<int:incident_id>', methods=['PUT'])
def update_incident(incident_id):
    """Update incident details"""
    data = request.get_json()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if incident exists
    cursor.execute('SELECT * FROM incidents WHERE id = ?', (incident_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'error': 'Incident not found'}), 404
    
    # Build update query dynamically
    update_fields = []
    params = []
    
    allowed_fields = ['title', 'description', 'type', 'severity', 'status', 'lat', 'lng', 'location_name', 'victims_count']
    for field in allowed_fields:
        if field in data:
            update_fields.append(f'{field} = ?')
            params.append(data[field])
    
    if not update_fields:
        conn.close()
        return jsonify({'success': False, 'error': 'No fields to update'}), 400
    
    # Add updated_at
    update_fields.append('updated_at = ?')
    params.append(datetime.now().isoformat())
    
    # Add incident_id for WHERE clause
    params.append(incident_id)
    
    query = f"UPDATE incidents SET {', '.join(update_fields)} WHERE id = ?"
    cursor.execute(query, params)
    
    # Add timeline event
    cursor.execute('''
        INSERT INTO incident_timeline (incident_id, event_type, description, user_name)
        VALUES (?, ?, ?, ?)
    ''', (incident_id, 'incident_updated', f'Incident updated', 'System'))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'incident_id': incident_id
    })

@incidents_bp.route('/incidents/<int:incident_id>/assign', methods=['POST'])
def assign_resources(incident_id):
    """Assign personnel and resources to incident"""
    data = request.get_json()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if incident exists
    cursor.execute('SELECT * FROM incidents WHERE id = ?', (incident_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'error': 'Incident not found'}), 404
    
    assigned = {'personnel': [], 'resources': []}
    
    # Assign personnel
    if 'personnel_ids' in data:
        for personnel_id in data['personnel_ids']:
            cursor.execute('''
                UPDATE personnel
                SET assigned_incident_id = ?, status = 'en-route', updated_at = ?
                WHERE id = ?
            ''', (incident_id, datetime.now().isoformat(), personnel_id))
            assigned['personnel'].append(personnel_id)
    
    # Assign resources
    if 'resource_ids' in data:
        for resource_id in data['resource_ids']:
            cursor.execute('''
                UPDATE resources
                SET assigned_incident_id = ?, status = 'en-route', updated_at = ?
                WHERE id = ?
            ''', (incident_id, datetime.now().isoformat(), resource_id))
            assigned['resources'].append(resource_id)
    
    # Add timeline event
    cursor.execute('''
        INSERT INTO incident_timeline (incident_id, event_type, description, user_name)
        VALUES (?, ?, ?, ?)
    ''', (
        incident_id,
        'resources_assigned',
        f'Assigned {len(assigned["personnel"])} personnel and {len(assigned["resources"])} resources',
        'Dispatcher'
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'assigned': assigned
    })

@incidents_bp.route('/incidents/<int:incident_id>/upload', methods=['POST'])
def upload_attachment(incident_id):
    """Upload file attachment to incident"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    # Save file
    file_info = save_file(file, incident_id)
    
    if not file_info:
        return jsonify({'success': False, 'error': 'Invalid file or file type not allowed'}), 400
    
    # Save to database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO attachments (incident_id, filename, filepath, file_type, file_size)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        incident_id,
        file_info['filename'],
        file_info['filepath'],
        file_info['file_type'],
        file_info['file_size']
    ))
    
    attachment_id = cursor.lastrowid
    
    # Add timeline event
    cursor.execute('''
        INSERT INTO incident_timeline (incident_id, event_type, description, user_name)
        VALUES (?, ?, ?, ?)
    ''', (incident_id, 'attachment_added', f'File uploaded: {file_info["filename"]}', 'User'))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'attachment_id': attachment_id,
        'file_info': file_info
    }), 201

@incidents_bp.route('/incidents/<int:incident_id>/timeline', methods=['GET'])
def get_incident_timeline(incident_id):
    """Get incident timeline/history"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM incident_timeline
        WHERE incident_id = ?
        ORDER BY created_at DESC
    ''', (incident_id,))
    
    timeline = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({
        'success': True,
        'timeline': timeline,
        'count': len(timeline)
    })

@incidents_bp.route('/incidents/<int:incident_id>/timeline', methods=['POST'])
def add_timeline_event(incident_id):
    """Add event to incident timeline"""
    data = request.get_json()
    
    required_fields = ['event_type', 'description']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO incident_timeline (incident_id, event_type, description, user_name, metadata)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        incident_id,
        data['event_type'],
        data['description'],
        data.get('user_name', 'System'),
        data.get('metadata', '')
    ))
    
    timeline_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'timeline_id': timeline_id
    }), 201
