🧬 Jurassic Field Terminal PWA
PROJECT PLAN — INGEN CRYO RECOVERY SYSTEM
1. PROJECT OVERVIEW

This project is an offline-first Progressive Web App (PWA) that simulates an InGen field operations terminal used for recovering dinosaur embryos.

It is designed for a real-world scavenger hunt experience using:

iPad (primary player device)
QR codes (physical world interaction)
Android phone (optional Game Master controller)
Physical props (Barbasol can embryo container)

The app must function fully offline with zero backend dependency.

2. CORE DESIGN GOALS
Primary Goals
Fully offline PWA game
QR-code driven progression system
State-driven mission and embryo tracking
Immersive InGen-style UI
Audio log + alert system
Fast, reliable real-world performance
Non-Goals (Important)
No server/backend
No accounts or authentication
No cloud sync
No real GPS usage
No complex frameworks required (prefer vanilla JS)
3. TECH STACK
Required
HTML5
CSS3
Vanilla JavaScript (ES6+)
Service Worker (offline caching)
localStorage (initial state persistence)
Optional
IndexedDB (if save system expands)
Howler.js (audio management)
GSAP (animations)
4. APPLICATION STRUCTURE
Folder Layout
/jurassic-field-terminal
  /index.html
  /styles.css
  /app.js
  /state.js
  /qr/
  /data/
      missions.json
      embryos.json
      audioLogs.json
  /audio/
  /images/
  /sw.js
  /manifest.json
  /gm/   (optional game master console)
5. CORE GAME LOOP
Event Flow
Player scans QR code
QR code contains JSON payload
App parses payload
Game state updates
UI updates immediately
Audio/event triggers fire
New mission unlocks
6. GLOBAL STATE MODEL
Single Source of Truth

Stored in memory + persisted in localStorage.

{
  "player": {
    "name": "Field Agent",
    "embryosCollected": []
  },
  "embryos": {
    "brachiosaurus": "locked",
    "trex": "locked"
  },
  "missions": {},
  "systems": {
    "trackingEnabled": false,
    "motionTrackerEnabled": false
  },
  "flags": {
    "finalEventTriggered": false
  }
}
7. QR CODE SYSTEM
QR Payload Format (STRICT)

All QR codes MUST resolve to JSON:

Embryo Example
{
  "type": "embryo",
  "id": "velociraptor",
  "name": "Velociraptor",
  "unlockMission": "mission_07",
  "audioLog": "log_07"
}
Event Example
{
  "type": "event",
  "eventId": "raptor_breach",
  "audio": "alarm.mp3"
}
QR Processing Rule

All QR interactions go through:

handleQR(payload)

which routes based on payload.type.

8. CORE SYSTEM MODULES
8.1 State Manager

Responsible for:

loading game state
saving game state
updating embryos and missions

Functions:

loadState()
saveState()
resetState()
8.2 QR Engine

Responsible for:

parsing QR payloads
validating unlock conditions
triggering game events

Function:

handleQR(payload)
8.3 Embryo System

Tracks 10 collectible embryos.

Rules:

each embryo can only be collected once
collecting updates UI + Barbasol inventory
triggers audio + mission unlock

Function:

collectEmbryo(id)
8.4 Mission System

Data-driven mission unlock system.

Each mission includes:

title
description
objective
unlock conditions
associated embryo

Function:

unlockMission(id)
8.5 Audio System

Plays immersive logs and effects.

Function:

playAudio(file)

Rules:

all audio stored locally
triggered by QR or events
8.6 Fake GPS System

Simulated tracking system (NOT real GPS).

States:

"signal lost"
"signal detected"
"target nearby"

Function:

updateSignal(level)

Triggered manually via QR or GM panel.

8.7 UI System

Single-page interface with screens:

Screens:

Boot Screen
Dashboard
Mission View
Embryo Vault (Barbasol sync)
Dinosaur Database
Tracking Console
Event Overlay (full screen alerts)
9. GAME MASTER SYSTEM (OPTIONAL)

Located at:

/gm/index.html

Used on Android device.

Capabilities:

trigger events
advance missions
simulate dinosaur activity
control pacing

Functions:

triggerRaptorBreach()
unlockEmbryo()
setGPSSignal()
10. SERVICE WORKER (OFFLINE MODE)

Must cache:

all HTML/CSS/JS
all audio files
all images
mission/embryo JSON

Requirement:

App must fully function with airplane mode enabled
11. PERFORMANCE REQUIREMENTS
Must load in < 2 seconds on iPad
Must work offline 100%
Must not require external APIs
Must persist state between reloads
12. DEVELOPMENT PHASES
Phase 1 — Core Loop (MVP)
Basic UI shell
State load/save
QR handler
1 embryo working end-to-end
Phase 2 — Full Embryo System
All 10 embryos
Barbasol inventory UI
Mission unlock chaining
Phase 3 — Immersion Layer
Audio logs
Alerts
Fake GPS system
Phase 4 — Game Master System
Android control panel
event triggering
Phase 5 — Polish
animations
sound design
UI styling (InGen terminal aesthetic)
13. DESIGN LANGUAGE
Visual Style:
InGen industrial UI
dark background
amber highlights
warning reds
scanline / terminal effects
Tone:
scientific
urgent
cinematic
“park system under stress”
14. CODING AGENT INSTRUCTIONS

If you are an AI coding assistant working in this project:

You MUST:
treat state.js as the single source of truth
never introduce backend dependencies
ensure QR payloads remain JSON-based
maintain offline-first design
preserve deterministic state updates
You SHOULD:
build modular systems
prefer simple vanilla JS patterns
avoid over-engineering frameworks
keep UI event-driven
log state transitions for debugging
You MUST NOT:
require internet APIs
introduce server logic
assume external services exist
break offline functionality
15. FIRST IMPLEMENTATION TASK (START HERE)

Build:

index.html shell
basic UI layout (Dashboard)
state.js (load/save system)
QR handler stub
one working embryo (Brachiosaurus)

End goal:

Scan QR → embryo collected → UI updates → saved persistently