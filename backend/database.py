import sqlite3
from datetime import datetime
from config import Config

def get_db_connection():
    """Create and return a database connection with WAL mode enabled"""
    conn = sqlite3.connect(Config.DATABASE_PATH, timeout=30)
    # Enable Write-Ahead Logging (WAL) for better concurrency
    conn.execute('PRAGMA journal_mode=WAL')
    # Extra safety for busy timeouts
    conn.execute('PRAGMA busy_timeout=30000')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with all required tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Users table for authentication
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'responder')),
            email TEXT,
            phone TEXT,
            avatar TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    
    # Incidents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            location_name TEXT,
            report_source TEXT,
            reported_by INTEGER,
            reporter_phone TEXT,
            victims_count INTEGER DEFAULT 0,
            report_count INTEGER DEFAULT 1,
            sosmesh_messages TEXT,
            is_verified BOOLEAN DEFAULT 0,
            verification_score INTEGER DEFAULT 0,
            ai_analysis TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP
        )
    ''')
    
    # Personnel table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS personnel (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'available',
            lat REAL,
            lng REAL,
            assigned_incident_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (assigned_incident_id) REFERENCES incidents(id)
        )
    ''')
    
    # Resources table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'available',
            lat REAL DEFAULT 0,
            lng REAL DEFAULT 0,
            is_public BOOLEAN DEFAULT 0,
            assigned_incident_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assigned_incident_id) REFERENCES incidents(id)
        )
    ''')
    
    # Communications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS communications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER,
            sender_id INTEGER,
            sender_name TEXT,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'text',
            read_status BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        )
    ''')
    
    # Alerts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            radius REAL NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        )
    ''')
    
    # Incident timeline/history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incident_timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            description TEXT NOT NULL,
            user_id INTEGER,
            user_name TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        )
    ''')
    
    # File attachments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER,
            uploaded_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        )
    ''')
    
    # Geofence zones table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS geofence_zones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            radius REAL NOT NULL,
            zone_type TEXT NOT NULL,
            active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        )
    ''')
    
    # Notifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            incident_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            priority TEXT NOT NULL,
            read_status BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully!")

def seed_sample_data():
    """Seed database with ONLY user accounts for authentication"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if users already exist
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] > 0:
        print("⚠️  Users already exist. Skipping seed.")
        conn.close()
        return
    
    print("🌱 Seeding user accounts...")
    
    # Sample users (3 regular users)
    # Password is 'password123' for all (in production, use proper hashing!)
    users = [
        ('user1', 'password123', 'Command Center Admin', 'user', 'admin@crisis.com', '+91-9876543210'),
        ('user2', 'password123', 'Operations Manager', 'user', 'ops@crisis.com', '+91-9876543211'),
        ('user3', 'password123', 'Dispatch Coordinator', 'user', 'dispatch@crisis.com', '+91-9876543212'),
    ]
    
    cursor.executemany('''
        INSERT INTO users (username, password, name, role, email, phone)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', users)
    
    # Sample responders (5 responders)
    responders = [
        ('responder1', 'password123', 'Firefighter John', 'responder', 'john@crisis.com', '+91-9876543220'),
        ('responder2', 'password123', 'Paramedic Sarah', 'responder', 'sarah@crisis.com', '+91-9876543221'),
        ('responder3', 'password123', 'Officer Mike', 'responder', 'mike@crisis.com', '+91-9876543222'),
        ('responder4', 'password123', 'Hazmat Specialist Lisa', 'responder', 'lisa@crisis.com', '+91-9876543223'),
        ('responder5', 'password123', 'EMT David', 'responder', 'david@crisis.com', '+91-9876543224'),
    ]
    
    cursor.executemany('''
        INSERT INTO users (username, password, name, role, email, phone)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', responders)
    
    conn.commit()
    conn.close()
    
    print(f"✅ Created {len(users)} users and {len(responders)} responders")
    print("📝 NO mock incidents, personnel, or resources were created")
    print("   All data will be created through the application")
    print("\n👥 Login Credentials:")
    print("   Users: user1-3 / password123")
    print("   Responders: responder1-5 / password123")

def get_db_connection():
    """Get a connection to the database"""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

if __name__ == '__main__':
    init_db()
    seed_sample_data()
