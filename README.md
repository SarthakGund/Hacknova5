# 🌐 Hackfusion: Next-Gen Crisis Management System

![Hackfusion Banner](./public/banner.png)

## 🎯 Overview
**Hackfusion** is a high-performance, real-time crisis management ecosystem designed to bridge the gap between emergency command centers and field responders. By integrating live data, geospatial intelligence, and a resilient **Dual-Layer Communication Hub (SMS & Bluetooth Mesh)**, Hackfusion ensures that help is always coordinated, even when the internet or cellular data fails.

---

## 🚀 The Four Pillars

### 1. 🏢 Crisis Command Dashboard
The brain of the operation. A premium, Next.js-powered command center for commissioners and dispatchers.
- **Live Global Map**: Real-time visualization of all incidents and personnel locations using Leaflet.
- **Personnel Tracking & Live Follow**: Track responder movement with a "Live Follow" camera mode that auto-pans to their current GPS.
- **Dynamic Incident Management**: Create, assign, and escalate incidents with a single click.
- **Advanced Analytics**: Real-time charts showing response times, resource utilization, and incident trends.

### 2. 📱 Field Responder PWA
A mobile-first, native-feeling Progressive Web App for responders on the ground.
- **Mission Center**: Stay focused with a dedicated "Mission" view providing live routing and ETA.
- **Real-time GPS Pulse**: Automatically sends location updates to the command center every 10 seconds.
- **Incident Reporting**: Submit high-fidelity reports with geolocation, photos, and high-priority severity tags.
- **One-Tap SOS**: A pulsing, high-visibility emergency button for immediate backup.

### 3. 🕸️ SOS Mesh Network
The "off-grid" life-saver. A resilient communication layer that functions when the traditional infrastructure fails.
- **Bluetooth Mesh Integration**: Connects with Android-based mesh hardware to relay SOS alerts without internet or cellular reception.
- **Offline SOS Signal**: Low-power, high-residency protocol designed for maximum reach in disaster zones.
- **Resilient Deduplication**: Intelligently merges multiple SOS signals of the same incident (500m radius) to prevent alert fatigue.

### 4. � SMS Reporting Gateway
High-accessibility emergency reporting for everyone. A no-friction gateway for citizens with zero data or legacy devices.
- **Natural Language Reporting**: Intelligent NLP parsing extracts incident types, severity, and location details from raw, conversational text messages.
- **Intelligent Geocoding**: Automatically converts text descriptions into precise map coordinates for instant dispatcher visualization.
- **Automated Two-Way Comms**: Instantly sends confirmation and reference IDs back to the reporter to provide assurance and tracking.

---

## ✨ Features Deep-Dive

### 📡 Real-Time Intelligence
- **Socket.IO Integration**: Zero-latency updates for locations, status changes, and new messages.
- **Bi-Directional Communication**: Both command and field can "push" updates instantly.

### 📍 Geospatial & Geofencing
- **Danger Zone Detection**: Define custom circular geofences. The system automatically alerts responders who enter hazardous areas.
- **Proximity Alerts**: Automatic notifications when personnel are within 5km of a high-priority incident.
- **Live Routing**: Dynamic paths from responder to incident with real-time distance calculations.

### 💬 Unified Communications
- **Incident Chat**: context-aware messaging for specific teams.
- **Global Broadcast**: Send critical alerts to every connected responder simultaneously.
- **Quick-Response Chips**: Pre-defined messages like "Arrived," "Need Backup," or "Secure" for rapid field updates.

### 🖼️ Multimedia & Evidence
- **Evidence Camera**: Responders can upload photos and videos directly from the field.
- **Unified Attachments**: Support for images, videos, and PDF reports linked to specific incidents.
- **Secure Storage**: Organized file management for post-incident analysis.

### 🔐 Security & Persistence
- **Role-Based Authentication**: Secure login system with JWT-ready architecture.
- **SQLite Reliability**: Persistent storage for all critical crisis data with automated seeding for testing.
- **Audit Logs**: Full timeline of every status change and assignment.

### 📊 Actionable Analytics
- **Efficiency Metrics**: Track average response times and personnel bandwidth.
- **Resource Tracking**: Real-time availability of ambulances, fire trucks, and specialized gear.
- **Incident Timeline**: A detailed, immutable log of every action taken during an emergency.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python, Flask, Flask-SocketIO, SQLite, Gevent |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Maps** | Leaflet.js, Leaflet Routing Machine, OpenStreetMap/Nominatim |
| **Mobile** | PWA (Progressive Web App), Service Workers, Geolocation API |
| **Messaging** | Twilio SMS API, Bluetooth Mesh Protocol |
| **Design** | Radix UI, Lucide Icons, Glassmorphism Aesthetics |

---

## 📂 Project Structure

```text
Hackfusion/
├── backend/                       # Flask API & WebSocket Server
│   ├── routes/                    # API Endpoints (SMS, Mesh, Incidents, Auth)
│   ├── utils/                     # Geocoding, Distance, Notification logic
│   ├── database.py                # SQLite Schema & Initialization
│   └── .env                       # Twilio & API Configuration
├── crisis-command-dashboard/      # Next.js Command Center UI
├── field-responder-ui/            # Next.js PWA for responders
└── public/                        # Static assets & Documentation
```

---

## ⚙️ Quick Start

### 1️⃣ Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python database.py  # Initialize & seed DB
python app.py       # Runs on port 5000
```

### 2️⃣ Dashboard Setup
```bash
cd crisis-command-dashboard
npm install
npm run dev         # Runs on port 3000
```

### 3️⃣ Responder UI Setup
```bash
cd field-responder-ui
npm install
npm run dev         # Runs on port 3001
```

---

## 🔐 Security & Reliability
- **Role-Based Access**: Specialized views for Commanders vs. Responders.
- **Atomic Operations**: Parameterized SQL queries to prevent injection.
- **Resilient Mesh**: Graceful degradation to mesh network when API is unreachable.

---

*Built for Hackfusion 2026. Empowering responders, saving lives.*
