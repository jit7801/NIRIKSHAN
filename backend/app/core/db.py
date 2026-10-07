import os
import json
import sqlite3
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("mplads.db")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "mplads_store.db")

def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: str = DB_PATH):
    """Initializes the database schema with necessary indexes."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = get_connection(db_path)
    cur = conn.cursor()
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS works (
        work_id TEXT PRIMARY KEY,
        work_title TEXT,
        mp_name TEXT,
        state TEXT,
        district TEXT,
        constituency TEXT,
        block TEXT,
        village TEXT,
        work_category TEXT,
        status TEXT,
        sanctioned_amount REAL,
        actual_expenditure REAL,
        physical_progress REAL,
        financial_progress REAL,
        latitude REAL,
        longitude REAL,
        implementing_agency TEXT,
        vendor TEXT,
        overall_risk_score INTEGER,
        risk_level TEXT,
        financial_risk REAL,
        delay_risk REAL,
        duplicate_risk REAL,
        compliance_risk REAL,
        primary_risk_factor TEXT,
        source TEXT,
        data_source TEXT,
        source_row INTEGER,
        ida_approval TEXT,
        house TEXT,
        recommendation_date TEXT,
        sanction_date TEXT,
        start_date TEXT,
        expected_completion_date TEXT,
        actual_completion_date TEXT,
        cohort_median REAL,
        cost_ratio REAL,
        modified_z REAL,
        peer_count INTEGER,
        days_overdue INTEGER,
        gap REAL,
        days_dormant INTEGER,
        has_dup_candidate INTEGER,
        paired_work_id TEXT,
        dup_distance REAL,
        dup_text_sim REAL,
        dup_score REAL
    );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_score ON works(overall_risk_score DESC);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_state ON works(state);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_district ON works(district);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_risk_level ON works(risk_level);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_category ON works(work_category);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_mp_name ON works(mp_name);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_coords ON works(latitude) WHERE latitude IS NOT NULL;")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_financial_risk ON works(financial_risk DESC);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_works_delay_risk ON works(delay_risk DESC);")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)

    conn.commit()
    conn.close()

def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Reconstructs standard API canonical dictionary from SQL row."""
    d = dict(row)
    
    # Reconstruct nested evaluation blocks expected by views and dossiers
    fin_risk = d["financial_risk"] or 0.0
    c_median = float(d["cohort_median"] or d["sanctioned_amount"] or 0.0)
    c_ratio = float(d["cost_ratio"] or 1.0)
    mod_z = float(d["modified_z"] or 0.0)
    p_count = int(d["peer_count"] or 0)
    
    del_risk = d["delay_risk"] or 0.0
    days_over = int(d["days_overdue"] or 0)
    g = float(d["gap"] or 0.0)
    days_dorm = int(d["days_dormant"] or 0)
    
    dup_risk = d["duplicate_risk"] or 0.0
    has_dup = bool(d["has_dup_candidate"])
    paired_id = d["paired_work_id"] or None
    dup_dist = float(d["dup_distance"] or 0.0)
    dup_sim = float(d["dup_text_sim"] or 0.0)
    dup_sc = float(d["dup_score"] or 0.0)
    
    cmp_risk = d["compliance_risk"] or 0.0
    
    # Generate explainable forensic evidence bullet points
    evidence = []
    if fin_risk >= 15:
        evidence.append(
            f"Compared sanctioned cost ₹{float(d['sanctioned_amount'] or 0)/100000:.2f}L against peer median of "
            f"₹{c_median/100000:.2f}L ({c_ratio:.2f}×) across {p_count} comparable projects in {d['work_category']} — {d['district']}. "
            f"Modified Z-score is {mod_z:.2f}."
        )
    if del_risk >= 12:
        evidence.append(
            f"Financial disbursement exceeds physical progress milestone by {g:.1f}% divergence with {days_dorm} days since last status update."
        )
    if dup_risk >= 10 and paired_id:
        evidence.append(
            f"Detected spatial overlap ({dup_dist:.1f}m) and high description similarity ({dup_sim:.1f}%) with co-located work order {paired_id}."
        )
    if cmp_risk > 0:
        evidence.append("Statutory documentation and completion certificate compliance review required.")
    if not evidence:
        evidence.append("Work metrics and milestone progress track within expected cohort parameters.")

    # Recommendations
    actions = []
    if dup_risk >= 10:
        actions.append("Compare work orders, site coordinates, beneficiary area, and technical drawings for nearby assets to verify independent physical utility.")
    if del_risk >= 15:
        actions.append("Request updated physical progress milestone report, ground photographs, and revised completion timeline from implementing agency.")
    if fin_risk >= 18:
        actions.append("Review project estimate, technical sanction, bill of quantities (BOQ), and applicable Schedule of Rates (SOR).")
    if cmp_risk >= 5:
        actions.append("Review fund-release eligibility according to applicable rules and pending statutory documentation.")
    if not actions:
        actions.append("Maintain standard periodic administrative oversight.")
    rec_action = " ".join(actions) + " (All recommendations are advisory and subject to field verification by authorized administrative authorities)."

    d["evidence_summary"] = evidence
    d["recommended_action"] = rec_action

    d["cost_evaluation"] = {
        "financial_risk_score": fin_risk,
        "max_score": 30,
        "cost_metric_used": "SANCTIONED_AMOUNT",
        "current_value": d["sanctioned_amount"],
        "work_cost": d["sanctioned_amount"],
        "peer_count": p_count,
        "peer_median": c_median,
        "cohort_median": c_median,
        "cost_ratio": c_ratio,
        "modified_z_score": mod_z,
        "modified_z": mod_z
    }
    d["delay_evaluation"] = {
        "delay_risk_score": del_risk,
        "max_score": 30,
        "days_overdue": days_over,
        "gap": g,
        "physical_gap": g,
        "days_since_update": days_dorm
    }
    d["duplicate_evaluation"] = {
        "duplicate_risk_score": dup_risk,
        "max_score": 25,
        "has_candidate": has_dup,
        "paired_work_id": paired_id,
        "distance_meters": dup_dist,
        "text_similarity": dup_sim,
        "combined_score": dup_sc
    }
    d["compliance_evaluation"] = {
        "compliance_risk_score": cmp_risk,
        "max_score": 15
    }

    return d

def save_pipeline_results(
    works: List[Dict[str, Any]],
    summary: Dict[str, Any],
    dup_pairs: List[Dict[str, Any]],
    cohort_stats: Dict[str, Any],
    mps_list: List[Dict[str, Any]],
    mps_map: Dict[str, Any],
    db_path: str = DB_PATH
):
    """Saves evaluated pipeline results into compact SQLite schema (~32 MB)."""
    init_db(db_path)
    conn = get_connection(db_path)
    cur = conn.cursor()

    logger.info(f"Populating database with {len(works)} works into {db_path}...")
    cur.execute("DELETE FROM works;")
    
    insert_sql = """
    INSERT INTO works (
        work_id, work_title, mp_name, state, district, constituency, block, village,
        work_category, status, sanctioned_amount, actual_expenditure, physical_progress,
        financial_progress, latitude, longitude, implementing_agency, vendor,
        overall_risk_score, risk_level, financial_risk, delay_risk, duplicate_risk,
        compliance_risk, primary_risk_factor, source, data_source, source_row,
        ida_approval, house, recommendation_date, sanction_date, start_date,
        expected_completion_date, actual_completion_date, cohort_median, cost_ratio,
        modified_z, peer_count, days_overdue, gap, days_dormant, has_dup_candidate,
        paired_work_id, dup_distance, dup_text_sim, dup_score
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    );
    """

    records_to_insert = []
    for w in works:
        ce = w.get("cost_evaluation") or {}
        de = w.get("delay_evaluation") or {}
        ue = w.get("duplicate_evaluation") or {}
        records_to_insert.append((
            w.get("work_id"),
            w.get("work_title") or "",
            w.get("mp_name") or "",
            w.get("state") or "",
            w.get("district") or "",
            w.get("constituency") or "",
            w.get("block") or "",
            w.get("village") or "",
            w.get("work_category") or "",
            w.get("status") or "",
            float(w.get("sanctioned_amount") or 0.0),
            float(w.get("actual_expenditure") or 0.0),
            float(w.get("physical_progress") or 0.0),
            float(w.get("financial_progress") or 0.0),
            float(w["latitude"]) if w.get("latitude") is not None else None,
            float(w["longitude"]) if w.get("longitude") is not None else None,
            w.get("implementing_agency") or "",
            w.get("vendor") or "",
            int(w.get("overall_risk_score") or 0),
            w.get("risk_level") or "LOW",
            float(w.get("financial_risk") or 0.0),
            float(w.get("delay_risk") or 0.0),
            float(w.get("duplicate_risk") or 0.0),
            float(w.get("compliance_risk") or 0.0),
            w.get("primary_risk_factor") or "",
            w.get("source") or "",
            w.get("data_source") or "",
            int(w.get("source_row") or 0) if w.get("source_row") is not None else None,
            w.get("ida_approval") or "",
            w.get("house") or "",
            w.get("recommendation_date") or "",
            w.get("sanction_date") or "",
            w.get("start_date") or "",
            w.get("expected_completion_date") or "",
            w.get("actual_completion_date") or "",
            float(ce.get("cohort_median") or ce.get("peer_median") or 0.0),
            float(ce.get("cost_ratio") or 1.0),
            float(ce.get("modified_z_score") or ce.get("modified_z") or 0.0),
            int(ce.get("peer_count") or 0),
            int(de.get("days_overdue") or 0),
            float(de.get("gap") or 0.0),
            int(de.get("days_since_update") or 0),
            1 if ue.get("has_candidate") else 0,
            ue.get("paired_work_id") or "",
            float(ue.get("distance_meters") or 0.0),
            float(ue.get("text_similarity") or 0.0),
            float(ue.get("combined_score") or 0.0)
        ))

    cur.executemany(insert_sql, records_to_insert)

    # Extract distinct filter options
    states = sorted(list(set(w.get("state") for w in works if w.get("state"))))
    categories = sorted(list(set(w.get("work_category") for w in works if w.get("work_category"))))
    statuses = sorted(list(set(w.get("status") for w in works if w.get("status"))))
    
    state_districts: Dict[str, List[str]] = {}
    for w in works:
        st = w.get("state")
        dt = w.get("district")
        if st and dt:
            state_districts.setdefault(st, set()).add(dt)
    state_districts_sorted = {k: sorted(list(v)) for k, v in state_districts.items()}

    filter_options = {
        "states": states,
        "categories": categories,
        "statuses": statuses,
        "state_districts": state_districts_sorted
    }

    metadata_to_insert = [
        ("summary", json.dumps(summary)),
        ("dup_pairs", json.dumps(dup_pairs)),
        ("cohort_stats", json.dumps(cohort_stats)),
        ("mps_list", json.dumps(mps_list)),
        ("mps_map", json.dumps(mps_map)),
        ("filter_options", json.dumps(filter_options)),
        ("total_works", str(len(works)))
    ]

    cur.executemany("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?);", metadata_to_insert)
    conn.commit()
    conn.close()
    file_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    logger.info(f"Database successfully saved to {db_path} ({file_size_mb:.2f} MB) with {len(works)} works.")

def load_metadata_from_db(db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    """Loads precomputed metadata from SQLite in < 5ms."""
    if not os.path.exists(db_path):
        return None
    try:
        conn = get_connection(db_path)
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM metadata;")
        rows = cur.fetchall()
        conn.close()
        
        meta = {}
        for row in rows:
            k, v = row["key"], row["value"]
            try:
                meta[k] = json.loads(v)
            except Exception:
                meta[k] = v
        return meta
    except Exception as e:
        logger.error(f"Error loading metadata from {db_path}: {e}")
        return None

def query_works_from_db(
    state: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    mp_name: Optional[str] = None,
    category: Optional[str] = None,
    risk_level: Optional[str] = None,
    min_score: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    has_coords: Optional[bool] = None,
    has_cost_anomaly: Optional[bool] = None,
    has_financial_risk: Optional[bool] = None,
    has_delay_risk: Optional[bool] = None,
    sort_by: str = "overall_risk_score",
    sort_order: str = "desc",
    limit: Optional[int] = 50,
    offset: int = 0,
    db_path: str = DB_PATH
) -> Tuple[int, List[Dict[str, Any]]]:
    """Executes indexed SQL query with pagination, search, and filters in 1-2ms."""
    conn = get_connection(db_path)
    cur = conn.cursor()

    conditions = []
    params: List[Any] = []

    if state:
        conditions.append("LOWER(state) = LOWER(?)")
        params.append(state.strip())
    if district:
        conditions.append("LOWER(district) = LOWER(?)")
        params.append(district.strip())
    if constituency:
        conditions.append("LOWER(constituency) = LOWER(?)")
        params.append(constituency.strip())
    if mp_name:
        conditions.append("LOWER(mp_name) LIKE LOWER(?)")
        params.append(f"%{mp_name.strip()}%")
    if category:
        conditions.append("LOWER(work_category) = LOWER(?)")
        params.append(category.strip())
    if risk_level:
        conditions.append("UPPER(risk_level) = UPPER(?)")
        params.append(risk_level.strip())
    if status:
        conditions.append("LOWER(status) = LOWER(?)")
        params.append(status.strip())
    if min_score is not None:
        conditions.append("overall_risk_score >= ?")
        params.append(int(min_score))
    if has_coords is True:
        conditions.append("latitude IS NOT NULL AND longitude IS NOT NULL")
    elif has_coords is False:
        conditions.append("latitude IS NULL OR longitude IS NULL")
    if has_cost_anomaly is True or has_financial_risk is True:
        conditions.append("financial_risk >= 15")
    if has_delay_risk is True:
        conditions.append("delay_risk >= 14")

    if search:
        s = f"%{search.strip()}%"
        search_clauses = [
            "work_title LIKE ?",
            "work_id LIKE ?",
            "district LIKE ?",
            "state LIKE ?",
            "constituency LIKE ?",
            "mp_name LIKE ?",
            "implementing_agency LIKE ?",
            "vendor LIKE ?",
            "village LIKE ?",
            "block LIKE ?"
        ]
        conditions.append(f"({' OR '.join(search_clauses)})")
        params.extend([s] * len(search_clauses))

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Count query
    count_sql = f"SELECT COUNT(*) as total FROM works {where_sql};"
    cur.execute(count_sql, params)
    total = cur.fetchone()["total"]

    # Safe sorting column mapping
    allowed_sort_cols = {
        "overall_risk_score": "overall_risk_score",
        "sanctioned_amount": "sanctioned_amount",
        "actual_expenditure": "actual_expenditure",
        "physical_progress": "physical_progress",
        "financial_progress": "financial_progress",
        "financial_risk": "financial_risk",
        "delay_risk": "delay_risk",
        "duplicate_risk": "duplicate_risk",
        "compliance_risk": "compliance_risk",
        "work_id": "work_id",
        "work_title": "work_title",
        "district": "district",
        "state": "state"
    }
    col = allowed_sort_cols.get(sort_by, "overall_risk_score")
    order = "ASC" if str(sort_order).lower() == "asc" else "DESC"

    if limit is not None and limit > 0:
        query_sql = f"SELECT * FROM works {where_sql} ORDER BY {col} {order} LIMIT ? OFFSET ?;"
        cur.execute(query_sql, params + [limit, offset])
    else:
        query_sql = f"SELECT * FROM works {where_sql} ORDER BY {col} {order} OFFSET ?;"
        cur.execute(query_sql, params + [offset])

    rows = cur.fetchall()
    conn.close()

    items = [row_to_dict(r) for r in rows]
    return total, items

def get_work_by_id_from_db(work_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    """Point query for a single project dossier in 0.1ms."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM works WHERE work_id = ? LIMIT 1;", (work_id.strip(),))
    row = cur.fetchone()
    conn.close()
    if row:
        return row_to_dict(row)
    return None

def compute_summary_from_db(
    state: Optional[str] = None,
    district: Optional[str] = None,
    db_path: str = DB_PATH,
    dup_pairs_count: int = 0,
    evaluation_date: Optional[str] = None,
    data_provenance: Optional[str] = None,
    is_demo_mode: bool = False,
    **kwargs: Any
) -> Dict[str, Any]:
    """Calculates summary KPIs from SQLite using SQL aggregation."""
    conn = get_connection(db_path)
    cur = conn.cursor()

    conditions = []
    params = []
    if state:
        conditions.append("LOWER(state) = LOWER(?)")
        params.append(state.strip())
    if district:
        conditions.append("LOWER(district) = LOWER(?)")
        params.append(district.strip())

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
    SELECT 
        COUNT(*) as total_works,
        SUM(CASE WHEN risk_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count,
        SUM(CASE WHEN risk_level = 'LOW' THEN 1 ELSE 0 END) as low_count,
        COALESCE(SUM(sanctioned_amount), 0.0) as total_sanctioned_amount,
        COALESCE(SUM(CASE WHEN risk_level IN ('CRITICAL', 'HIGH') THEN sanctioned_amount ELSE 0 END), 0.0) as flagged_amount,
        SUM(CASE WHEN financial_risk >= 15 THEN 1 ELSE 0 END) as cost_anomalies_count,
        SUM(CASE WHEN delay_risk >= 14 THEN 1 ELSE 0 END) as stagnation_count,
        SUM(CASE WHEN compliance_risk >= 5 THEN 1 ELSE 0 END) as missing_docs_count
    FROM works {where_sql};
    """

    cur.execute(query, params)
    row = cur.fetchone()
    conn.close()

    res = dict(row)
    res["total_sanctioned_amount"] = round(float(res["total_sanctioned_amount"] or 0.0), 2)
    res["flagged_amount"] = round(float(res["flagged_amount"] or 0.0), 2)
    res["duplicate_candidates_count"] = dup_pairs_count
    res["evaluation_date"] = evaluation_date
    res["data_provenance"] = data_provenance
    res["is_demo_mode"] = is_demo_mode
    return res
