# MPLADS Offline-First Field Verification & Synchronization Architecture

## 1. Executive Summary & Positioning

The **Offline-First Field Verification & Synchronization Layer** enables authorized ground officials (such as Junior Engineers, Assistant Engineers, and District Nodal Auditors) to inspect MPLADS infrastructure projects in rural, remote, and low-connectivity environments across India.

### Critical Positioning:
* **Offline Sync = Field Evidence Collection Layer**: Collects empirical ground observations, physical progress percentages, geotagged GPS coordinates, and inspection photographs even without internet connectivity.
* **Backend + AI/ML = Central Intelligence Layer**: Authoritative server running explainable AI anomaly detection (MAD, Modified Z-score, BallTree spatial indexing, statutory compliance rules, and unified risk priority scoring). The machine learning models reside centrally. When verified field data is synchronized, the central AI engine recalculates project risk scores and issues updated advisory recommendations.

---

## 2. End-to-End System Workflow

```text
┌────────────────────────────────────────────────────────┐
│             CENTRAL MPLADS INFRASTRUCTURE              │
│    Central Works Database / Official MPLADS Records    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 FASTAPI BACKEND SERVER                 │
│         Base API Routes & Data Pipeline Caching         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                CENTRAL AI RISK ENGINE                  │
│   Cost Anomaly · Delay/Stagnation · Duplicate Overlap  │
│            Statutory Compliance Intelligence           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             FIELD VERIFICATION PWA CLIENT              │
│    (Service Worker Cache · IndexedDB Local Storage)    │
└───────────────────────────┬────────────────────────────┘
                            │
                  Internet Available?
                   ↙              ↘
                 YES               NO
                  │                 │
                  ▼                 ▼
          Immediate Sync API     Save Locally in IndexedDB
                  │                 │
                  ▼                 ▼
            Authoritative      Sync Queue (status = PENDING)
               Server               │
                               Connectivity Restored
                                    │
                                    ▼
                             Auto Sync via SyncManager
                                    │
                                    ▼
                           FastAPI Backend Endpoint
                   (/api/v1/projects/{id}/verification)
                                    │
                             Idempotency Key &
                        Concurrency Version Verification
                                    │
                                    ▼
                       Central AI Risk Recalculation
                                    │
                                    ▼
                         Real-Time Dashboard KPI &
                        Verification History Update
```

---

## 3. Why Offline-First is Used in MPLADS

1. **Geographic Constraints**: Public works funded by MPLADS (drinking water tube wells, rural community halls, link roads, solar lighting, cremation sheds) are often situated in remote gram panchayats with intermittent or non-existent 4G/5G mobile signals.
2. **Zero Field Data Loss**: Inspecting officers must record observations, capture real GPS coordinates, and attach photos on site without fear of losing form inputs due to dropped network packets.
3. **Optimized Bandwidth**: High-resolution downloads are avoided on cellular devices; only lightweight, compact project summaries are cached.
4. **Immediate Ground Productivity**: Officers can quickly open cached dossiers, verify physical milestones, and save determinations instantly with zero network latency.

---

## 4. What Data is Cached Locally

Only the minimum information required for spot verification is cached in local client storage:

```json
{
  "work_id": "MPLAD-RA-2024-0001",
  "work_title": "Construction of Community Welfare Center at Bus Stand",
  "district": "Jaipur",
  "state": "Rajasthan",
  "village": "Gram Gandhi Park",
  "ward": "Ward 7",
  "latitude": 26.929785,
  "longitude": 75.782461,
  "sanctioned_amount": 2587000.0,
  "physical_progress": 32.6,
  "financial_progress": 46.0,
  "overall_risk_score": 78,
  "risk_level": "HIGH",
  "primary_risk_factor": "Delay & Stagnation",
  "implementing_agency": "Public Works Department (PWD) Rural",
  "status": "IN_PROGRESS",
  "version": 1,
  "last_update_date": "2026-06-29"
}
```

Sensitive authentication secrets, administrative passwords, and extraneous analytical matrices are strictly excluded from local storage.

---

## 5. IndexedDB Architecture

The browser client uses a dedicated IndexedDB database named `mplads_offline_db` (version 1) structured into three transactional object stores:

| Store Name | Key Path | Primary Indexes | Purpose |
| :--- | :--- | :--- | :--- |
| **`projects`** | `work_id` | `by_district`, `by_risk_level` | Compact cache of assigned projects ready for offline inspection. |
| **`verification_records`** | `operation_id` | `by_project_id`, `by_created_at`, `by_sync_status` | Local immutable ledger of field determinations and photo references. |
| **`sync_queue`** | `operation_id` | `by_status`, `by_created_at`, `by_project_id` | FIFO queue of synchronization operations waiting to reach the server. |

---

## 6. Sync Queue & Operation Lifecycle

Each field verification saved while offline is wrapped in a structured queue operation:

```json
{
  "operation_id": "op-1726707000000-a7b2c9",
  "device_id": "field-device-jaipur-01",
  "user_id": "FIELD_OFFICER_01",
  "project_id": "MPLAD-RA-2024-0001",
  "operation_type": "FIELD_VERIFICATION",
  "payload": {
    "progress": 45.0,
    "verification_status": "PARTIALLY_VERIFIED",
    "remarks": "Work approximately halfway complete. Foundation and columns erected.",
    "latitude": 26.9124,
    "longitude": 75.7873,
    "verified_at": "2026-09-19T10:30:00.000Z",
    "evidence_photo": "data:image/jpeg;base64,...",
    "expected_version": 1
  },
  "created_at": "2026-09-19T10:30:00.000Z",
  "status": "pending",
  "retry_count": 0,
  "last_error": null
}
```

### Queue Item State Machine:
* `pending` ➔ Operation saved locally, awaiting network connection.
* `syncing` ➔ Currently in-flight over HTTP.
* `synced` ➔ Successfully processed by backend, risk recalculated, project updated.
* `failed` ➔ Network or server transient error; retained in queue with incremented `retry_count`.
* `conflict` ➔ Optimistic concurrency version mismatch; retained for user review.

---

## 7. Sync Manager & Auto-Synchronization

The `SyncManager` is a singleton service running on the client:
1. **Connectivity Detection**: Subscribes to `window.addEventListener('online')` and `window.addEventListener('offline')`.
2. **Heartbeat Confirmation**: Before attempting to flush the queue, pings `/api/v1/health` with a 3.5-second timeout to verify genuine internet reachability (preventing false triggers on captive portals or local WiFi without internet).
3. **In-Flight Lock**: Guards against concurrent duplicate sync executions.
4. **Tolerant Batch Processing**: If an officer submits 5 verifications offline, the sync manager iterates through each. If operation 3 encounters a temporary network timeout, operations 1, 2, 4, and 5 succeed and are marked `synced`, while operation 3 remains in queue as `failed` for automatic retry. No operations are silently dropped.
5. **Reactive Event Emission**: Emits `mplads:data_synced` custom event upon batch completion, prompting the dashboard to refresh KPI cards and table views automatically.

---

## 8. Idempotency Protection

In unstable mobile network conditions, a client request may reach the server, but the server's HTTP response may be dropped during transit. The client will inevitably retry the operation.

To guarantee that duplicate network submissions do not corrupt project data or create duplicate verification records:
* Every client submission carries a unique `operation_id`.
* The backend maintains an in-memory ledger `_DATA_CACHE["processed_operations"]`.
* When receiving a request:
  - If `operation_id` has already been executed, the backend **immediately returns the cached response** with the existing `verification_id`.
  - It does **not** recalculate risk again, does **not** increment the version number again, and does **not** duplicate the audit record.

---

## 9. Conflict Resolution Strategy (Optimistic Concurrency Control)

When an officer is working offline, another authorized authority may modify the project on the central portal.

1. **Version Tracking**: Each project carries a monotonic integer `version` field (starting at 1).
2. **Expected Version**: When the officer downloads/caches the project, `expected_version` is stored.
3. **Conflict Detection**: When the offline verification reaches the backend, the server checks:
   ```python
   if req.expected_version is not None and req.expected_version != current_version:
       raise HTTPException(
           status_code=status.HTTP_409_CONFLICT,
           detail={
               "message": "Conflict detected: Project was updated after it was downloaded.",
               "expected_version": req.expected_version,
               "current_version": current_version,
               "server_work": server_work
           }
       )
   ```
4. **User-Centric Conflict UI**:
   The client does **not** perform dangerous automatic merging. Instead, the UI displays a clear explanation:
   > *"This project was updated after it was downloaded. Your offline verification could not automatically overwrite the newer server information. Review the latest project information before submitting again."*
   The officer is provided with a safe **"Review Latest Data"** action.

---

## 10. How Field Verification Reaches the Central AI Risk Engine

When verified field data arrives at the backend:
1. `physical_progress` in the master analytical dataset is updated to the verified value.
2. `last_update_date` is updated to the verification timestamp, resetting dormancy clocks.
3. If photographic evidence was provided, `photo_available` is marked `True`, clearing statutory photographic compliance deficits.
4. The existing `run_full_risk_pipeline(df)` is executed with the existing calibrated dimension weights:
   * **Delay & Stagnation Engine**: Disparity between financial drawdown and physical completion (`financial_progress - physical_progress`) decreases, directly lowering the delay risk score.
   * **Statutory Compliance Engine**: Missing photo signal is resolved, lowering the compliance score.
   * **Unified Risk Score**: Weighted sum drops proportionally.
5. The API generates a transparent XAI delta explanation:
   ```text
   Physical progress was updated from 32.6% to 45.0%.
   Risk Priority Score decreased from 78 to 64 (reduced delay/stagnation gap).
   Delay & Stagnation component recalculated from 22 to 13.
   ```
6. The updated risk profile is broadcast to all active dashboards and priority tables.
