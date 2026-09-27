# MPLADS Risk Intelligence Platform

> **Explainable Risk Intelligence & Decision Support Layer for MPLADS Scheme**  
> Empirical anomaly detection, geospatial duplicate indexing, statutory compliance scoring, offline-first field verification, and explainable decision support for Members of Parliament and District Authorities to monitor public development works, track fund utilization, and prioritize cases for human verification.

---

## 📌 Core Mission & Governance Principles

The **MPLADS Risk Intelligence Platform** operates on ten foundational government-technology principles:

1. **Detects Risk, Not Guilt**: The system identifies risk signals and statistical anomalies; it does **not** claim to automatically prove fraud or wrongdoing.
2. **Explainable AI (XAI)**: Every risk alert provides empirical, transparent justifications (peer medians, Modified Z-scores, distance metres, progress gaps, missing certificates) rather than black-box outputs.
3. **Advisory Decisions**: All generated action directives are advisory. Final authority and administrative decisions remain exclusively with authorized human officers.
4. **Data Coverage & Integrity**: Operates on official MPLADS records combined with structured benchmark cohorts, ensuring accurate evaluation of real-world reporting delays, cost variations, and contractor concentration.
5. **Calibrated Statistical Methods**: Uses robust statistics (MAD, Modified Z-score, Haversine spatial trees, sub-word TF-IDF) with unsupervised machine learning (Isolation Forest) as a secondary analytical indicator.
6. **Strict Policy Governance**: Rejection of unnormalized risk weights ($\sum = 100$) and removal of arbitrary punitive actions (e.g. replaced "Freeze funds" with *"Review fund-release eligibility according to applicable rules"*).
7. **Two-Stage Candidate Pruning**: Scalable $O(N \log N)$ spatial indexing (`BallTree`) to prune candidate pairs before computing expensive string similarities.
8. **Multi-Tier Cohort Fallbacks**: Prevents misleading scores on small sample sizes by cascading from district to state to national cohorts.
9. **Role Scoping & Privacy**: Distinct views for District Magistrates, State Nodal Officers, MPs, Central Ministry, and Citizens (with citizen views strictly scoped to public asset data).
10. **Offline-First Field Verification**: Enables ground verification in low-connectivity areas with client-side PWA/IndexedDB storage and central server synchronization with conflict resolution.

---

## 🚀 Key Modules & AI Engines

```
MPLADS / Authorized Data
          ↓
[ 1. Ingestion Data Validator ]
   - Work ID uniqueness & format checks
   - Non-negative expenditure & budget bounds
   - India coordinate bounding box (Lat: 8–37.5°N, Lon: 68–97.5°E)
   - Temporal chronology (Sanction ≥ Rec, Start ≥ Sanction, Completion ≥ Start)
   - Status consistency checks (Completed vs Ongoing)
          ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ 2. Cost Engine  │ 3. Delay Engine │ 4. Duplicate    │ 5. Compliance   │
│                 │                 │    Engine       │    Engine       │
│ • District/     │ • Centralized   │ • O(N log N)    │ • Disaggregated │
│   State/National│   Eval Date     │   BallTree      │   statutory     │
│   cohort tiers  │ • Fiscal vs     │   Spatial Index │   signals       │
│   (Leave-one-out│   physical gap  │ • Sub-word      │ • Completion UC,│
│   statistics)   │ • Dormancy &    │   TF-IDF        │   Asset Reg,    │
│ • Unit cost     │   overdue       │   char-ngrams   │   Geo photo     │
│   normalization │   clocks        │ • Possible      │ • 0–15 score    │
│ • Robust MAD &  │ • 0–30 delay    │   Overlap       │   breakdown     │
│   Modified Z    │   score         │   Candidate     │                 │
│ • Isolation     │                 │ • 0–25 score    │                 │
│   Forest (XAI)  │                 │                 │                 │
│ • 0–30 score    │                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
          ↓
[ 6. Unified Risk Engine ]
   - 0–100 Risk Priority Score (Low: 0–29, Medium: 30–59, High: 60–79, Critical: 80–100)
   - Forensic Evidence Checklist
   - Advisory Administrative Recommendations
          ↓
┌───────────────────────────────────┬───────────────────────────────────┐
│ 7. Priority Queue & Decision UI   │ 8. Offline Field Verification PWA │
│   - Field Inspection Directives   │   - Offline inspection package    │
│   - Lok Sabha 543 MP Allocation   │   - Geotagged photo & GPS capture │
│   - Interactive GIS Leaflet Map   │   - IndexedDB queue & auto-sync   │
│   - Candidate Duplicate Diff Modal│   - Version conflict resolution   │
└───────────────────────────────────┴───────────────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12+, FastAPI, Uvicorn, Pandas, NumPy, Scikit-learn (`BallTree`, `TfidfVectorizer`, `IsolationForest`), Pytest
- **Frontend**: React 19, Vite 8, TailwindCSS, Lucide Icons, Leaflet / React-Leaflet, Recharts, Service Workers & IndexedDB (Offline PWA)
- **Data Architecture**: In-memory analytical cache with isolated repository abstractions ready for PostGIS / PostgreSQL migration.

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run full automated test suite (38 tests)
python3 -m pytest tests -v

# Start FastAPI server (runs on http://localhost:8001)
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```
API Documentation:
- Swagger UI: [http://localhost:8001/docs](http://localhost:8001/docs)
- ReDoc: [http://localhost:8001/redoc](http://localhost:8001/redoc)

### 3. Frontend Setup
```bash
# From workspace root or inside frontend/
npm run dev

# Or for production bundle build:
npm run build
```
Access the dashboard at [http://localhost:5173](http://localhost:5173).

---

## 🧪 Verification & Test Suite

Run the full automated test suite covering all modules and offline sync endpoints:
```bash
python3 -m pytest backend/tests -v
```

### Coverage Summary (38 / 38 Passed):
- `test_validation.py` (4 tests): Negative amounts detection, India coordinate bounding checks, temporal chronology consistency, clean record pass-through.
- `test_engines.py` (13 tests): Haversine distance, leave-one-out multi-tier cohort statistics, zero-MAD safe relative deviation fallback, zero peer median handling, unit cost extraction, delay stagnation, centralized deterministic evaluation date configuration, BallTree duplicate indexing with candidate signal strengths, stage-aware compliance signal disaggregation, unified risk scoring, duplicate signal strength, and 543 MP allocation calculations.
- `test_api.py` (8 tests): REST endpoint contracts (`/health`, `/summary`, `/works`, `/explanation`, `/map/layers`, `/mps`, `/states`, `/recalculate`), coordinate bounds in GeoJSON, and strict Pydantic model weight validation ($\sum = 100$).
- `test_verification.py` (7 tests): Offline verification sync endpoints (`/verification/bundle`, `/verification/submit`), idempotency duplicate submission handling, concurrency version conflict detection, invalid progress & coordinate validation, and non-existent project error handling.
- `test_performance.py` (6 tests): Pagination exactness, full dataset count integrity, backend search performance and accuracy, filtering logic, map GeoJSON optimization, and filter options endpoints.

---

## 📱 Offline-First Field Verification Architecture

For a detailed technical architecture on ground inspection data capture, client-side caching (Service Worker & IndexedDB), sync queues, and central server AI recalculation, see [OFFLINE_SYNC_ARCHITECTURE.md](file:///Users/jiteshvishnoi/Desktop/NIRIKSHAN/OFFLINE_SYNC_ARCHITECTURE.md).

---

## ⚖️ Governance & Ethical Safeguards

- **No Guilt Inferences**: Outputs indicate **Risk Priority Score**, never "Fraud Probability".
- **No Automatic Punitive Actions**: Directives use *"Review fund-release eligibility according to applicable rules"*, never "Freeze funds".
- **Human in the Loop**: AI ranks and prioritizes; authorized officers inspect, verify, and decide.
- **Audit Trail & Verification Logs**: Every inspection notice generates a verifiable order draft with ground verification officer assignment and timestamped field sync history.

---

## 📄 License & Attribution
Developed for explainable risk intelligence and decision support for public MPLADS development works.

