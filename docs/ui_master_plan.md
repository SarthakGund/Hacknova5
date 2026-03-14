# AXON UI Master Plan

## Goal
Build a production-grade AXON interface with a real-time command centre, map visibility, and consistent design system across all pages while preserving existing backend APIs.

---

## Phase 1 — Foundation (start now)

### 1. Information architecture
- Primary operations page: `/remote` (Action Command Centre)
- Engineering/test page: `/remote-console` (existing webhook console)
- Existing pages retained:
  - `/` Home
  - `/sensor-page`
  - `/agent-page`
  - `/video-page`

### 2. Design system alignment
- Aesthetic: Stealth Utility (black/white high contrast)
- Typography: Inter + JetBrains Mono
- Components: KPI cards, incident feed cards, terminal logs, utility buttons

### 3. Live data model
- Incident feed: `GET /remote/webhook/events`
- Agent feed: `GET /remote/webhook/agent-invocations`
- Real-time strategy: 2s polling (minimal-risk MVP)

### 4. Command centre modules
- KPI row (events, SOS, flood, agent runs)
- Live Incident Map (marker by event `payload.location.lat/lon`)
- Incident Feed (reverse chronological)
- Agent Invocation Feed
- Quick Action controls (`/remote/webhook/simulate/*`)

---

## Phase 2 — UI Unification

### 1. Shared base template
- Extract common shell (header/nav/footer)
- Use common tokenized styles for all pages

### 2. Page migration
- Sensor UI redesign
- Agent UI redesign
- Video UI redesign
- Home/dashboard alignment

### 3. API utility layer
- Shared frontend fetch wrappers
- Uniform error handling/loading states

---

## Phase 3 — Operational hardening

### 1. Unified ops feed endpoint
- Add normalized backend feed (optional): `/ops/feed`
- Aggregate events + invocations + sensor states

### 2. Push updates
- Optional SSE endpoint `/ops/stream` to reduce polling overhead

### 3. Persistence + scalability
- Move in-memory stores to persistent storage
- Add pagination + server-side filtering for feeds

---

## What was started in this iteration

1. Introduced new UI folder and page:
   - `ui/pages/command_center.html`
2. Added Action Command Centre page with:
   - live KPI cards
   - map view (Leaflet + OpenStreetMap)
   - incident feed
   - agent invocation feed
   - quick simulation actions
3. Routed `/remote` to command centre.
4. Preserved old console at `/remote-console`.

---

## Next immediate tasks

1. Add shared AXON base layout template for all pages.
2. Migrate `/agent-page` and `/video-page` visuals to AXON style.
3. Add map legend + severity color coding.
4. Add filter controls (event type / source / time window).
