import os
import math
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
import pandas as pd
from app.core.config import settings
from app.core.db import (
    DB_PATH,
    load_metadata_from_db,
    query_works_from_db,
    get_work_by_id_from_db,
    compute_summary_from_db
)
from app.engines.risk_engine import run_full_risk_pipeline
from app.adapters.csv_adapter import load_mplads_csv_as_dataframe

logger = logging.getLogger("mplads.api")
router = APIRouter()

def sanitize_for_json(obj: Any) -> Any:
    """Recursively converts NaN, inf, and pandas NA values to None for strict JSON compliance."""
    if isinstance(obj, (int, bool, str)):
        return obj
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(item) for item in obj]
    if obj is None:
        return None
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass
    return obj

# In-memory storage for cached analysis results
_DATA_CACHE: Dict[str, Any] = {
    "use_db": False,
    "db_path": None,
    "total_works_count": 0,
    "df": None,
    "works": [],
    "works_map": {},
    "summary": {},
    "dup_pairs": [],
    "cohort_stats": {},
    "mps_df": None,
    "mps_list": [],
    "mps_map": {},
    "filter_options": {},
    "field_verifications": [],
    "processed_operations": {},
    "project_versions": {}
}

def normalize_mp_token(name: str) -> str:
    """Strips honorifics, punctuation, and whitespace for robust MP matching."""
    s = str(name).strip().lower()
    for prefix in ("shri ", "smt ", "dr. ", "dr ", "hon. ", "hon'ble "):
        if s.startswith(prefix):
            s = s[len(prefix):].strip()
    return "".join(ch for ch in s if ch.isalnum())

def compute_mp_metrics(mps_df: pd.DataFrame, works: list[dict]) -> tuple[list[dict], dict]:
    # Index works by normalized MP token and by constituency token
    works_by_mp_token: Dict[str, list[dict]] = {}
    works_by_constituency: Dict[str, list[dict]] = {}
    
    for w in works:
        mp = str(w.get("mp_name", "")).strip()
        const = str(w.get("constituency", "")).strip()
        if mp:
            tok = normalize_mp_token(mp)
            if tok:
                works_by_mp_token.setdefault(tok, []).append(w)
        if const:
            c_tok = normalize_mp_token(const)
            if c_tok:
                works_by_constituency.setdefault(c_tok, []).append(w)
            
    mp_list = []
    mp_map = {}
    
    for _, row in mps_df.iterrows():
        mp_name = str(row.get("mp_name", "")).strip()
        state = str(row.get("state", "")).strip()
        constituency = str(row.get("constituency", "")).strip()
        raw_allocated = row.get("allocated_amount", 147000000.0)
        try:
            allocated = float(raw_allocated)
        except (ValueError, TypeError):
            allocated = 147000000.0
            
        # Match by normalized MP name first, then fallback to constituency
        mp_tok = normalize_mp_token(mp_name)
        const_tok = normalize_mp_token(constituency)
        mp_works = works_by_mp_token.get(mp_tok) or works_by_constituency.get(const_tok) or []
        
        total_sanctioned = sum(float(w.get("sanctioned_amount", 0.0)) for w in mp_works)
        total_spent = sum(float(w.get("actual_expenditure", 0.0)) for w in mp_works)
        high_risk_count = sum(1 for w in mp_works if w.get("risk_level") in ["CRITICAL", "HIGH"])
        avg_risk = round(sum(float(w.get("overall_risk_score", 0.0)) for w in mp_works) / len(mp_works), 1) if mp_works else 0.0
        util_rate = round((total_sanctioned / allocated * 100.0), 2) if allocated > 0 else 0.0
        rem_balance = round(max(0.0, allocated - total_sanctioned), 2)
        
        # Safe integer parsing for sr_no
        sr_val = row.get("sr_no", 0)
        try:
            sr_no = int(float(sr_val)) if pd.notna(sr_val) and str(sr_val).strip() != "" else 0
        except (ValueError, TypeError):
            sr_no = 0
            
        entry = {
            "sr_no": sr_no,
            "state": state,
            "mp_name": mp_name,
            "constituency": constituency,
            "allocated_amount": allocated,
            "total_works": len(mp_works),
            "total_sanctioned_amount": round(total_sanctioned, 2),
            "total_expenditure": round(total_spent, 2),
            "remaining_balance": rem_balance,
            "utilization_percentage": util_rate,
            "high_risk_works_count": high_risk_count,
            "average_risk_score": avg_risk
        }
        mp_list.append(entry)
        mp_map[mp_name.lower()] = entry
        if const_tok:
            mp_map[constituency.lower()] = entry
        
    return mp_list, mp_map

def load_and_run_pipeline():
    logger.info("Loading MPLADS analytical pipeline...")

    # Fast path: Check for precomputed SQLite database
    db_file = getattr(settings, "DB_PATH", None) or DB_PATH
    if db_file and os.path.exists(db_file):
        try:
            meta = load_metadata_from_db(db_file)
            if meta and meta.get("summary") and meta["summary"].get("total_works", 0) > 0:
                logger.info(f"[FAST STARTUP] Loading precomputed pipeline data from {db_file}...")
                _DATA_CACHE["use_db"] = True
                _DATA_CACHE["db_path"] = db_file
                _DATA_CACHE["summary"] = meta["summary"]
                _DATA_CACHE["dup_pairs"] = meta.get("dup_pairs", [])
                _DATA_CACHE["cohort_stats"] = meta.get("cohort_stats", {})
                _DATA_CACHE["mps_list"] = meta.get("mps_list", [])
                _DATA_CACHE["mps_map"] = meta.get("mps_map", {})
                _DATA_CACHE["filter_options"] = meta.get("filter_options", {})
                _DATA_CACHE["total_works_count"] = meta["summary"]["total_works"]

                # Pre-load initial benchmark/top works for fast memory cache & synchronous access
                _, top_works = query_works_from_db(limit=600, db_path=db_file)
                _DATA_CACHE["works"] = top_works
                _DATA_CACHE["works_map"] = {w["work_id"]: w for w in top_works}

                # Load benchmark DF for policy verification and live recalibration
                try:
                    if settings.DATA_PATH and os.path.exists(settings.DATA_PATH):
                        _DATA_CACHE["df"] = pd.read_csv(settings.DATA_PATH)
                except Exception:
                    pass

                logger.info(f"[FAST STARTUP COMPLETED] Pipeline ready in <15ms! Total records: {meta['summary']['total_works']}.")
                return
        except Exception as e:
            logger.warning(f"Failed to load from DB ({e}), falling back to full CSV ingestion...")

    # Multi-candidate path search for benchmark works dataset
    df = None
    works_candidates = [
        settings.DATA_PATH,
        "data/mplads_works.csv",
        "../data/mplads_works.csv",
        "../../data/mplads_works.csv",
    ]
    for c in works_candidates:
        if c and os.path.exists(c):
            try:
                df = pd.read_csv(c)
                if not df.empty:
                    if "source" not in df.columns:
                        df["source"] = "existing"
                    if "data_source" not in df.columns:
                        df["data_source"] = "MPLADS_PORTAL"
                break
            except Exception:
                continue

    # Multi-candidate path search and adaptation for MPLADS.csv
    csv_candidates = [
        getattr(settings, "CSV_DATA_PATH", None),
        "data/MPLADS.csv",
        "../data/MPLADS.csv",
        "../../data/MPLADS.csv"
    ]
    csv_df = None
    for c in csv_candidates:
        if c and os.path.exists(c):
            try:
                max_rec = getattr(settings, "MAX_CSV_RECORDS", None)
                csv_df = load_mplads_csv_as_dataframe(c, max_records=max_rec)
                break
            except Exception as e:
                logger.warning(f"Could not load MPLADS.csv from {c}: {e}")
                continue

    if csv_df is not None and not csv_df.empty:
        if df is not None and not df.empty:
            logger.info(f"Combining {len(df)} benchmark records with {len(csv_df)} MPLADS.csv records.")
            df = pd.concat([df, csv_df], ignore_index=True)
        else:
            df = csv_df
    elif df is None:
        logger.error("Could not find works dataset in any standard candidate paths. Initializing empty.")
        df = pd.DataFrame()
        
    _DATA_CACHE["df"] = df
    works, summary, dup_pairs, cohort_stats = run_full_risk_pipeline(df)
    clean_works = sanitize_for_json(works)
    versions = _DATA_CACHE.setdefault("project_versions", {})
    for w in clean_works:
        w_id = w["work_id"]
        w["version"] = versions.setdefault(w_id, 1)
        if not w.get("source"):
            w["source"] = "MPLADS.csv" if "MPLADS-CSV" in str(w_id) else "existing"
        if not w.get("data_source"):
            w["data_source"] = "MPLADS.csv" if "MPLADS-CSV" in str(w_id) else "MPLADS_PORTAL"
    _DATA_CACHE["works"] = clean_works
    _DATA_CACHE["works_map"] = {w["work_id"]: w for w in clean_works}
    _DATA_CACHE["summary"] = sanitize_for_json(summary)
    _DATA_CACHE["dup_pairs"] = sanitize_for_json(dup_pairs)
    _DATA_CACHE["cohort_stats"] = sanitize_for_json(cohort_stats)
    
    # Multi-candidate path search for MP Allocations dataset
    mps_df = None
    mps_candidates = [
        settings.MP_DATA_PATH,
        "data/mp_allocations.csv",
        "../data/mp_allocations.csv",
        "../../data/mp_allocations.csv"
    ]
    for c in mps_candidates:
        if c and os.path.exists(c):
            try:
                mps_df = pd.read_csv(c)
                break
            except Exception:
                continue
                
    if mps_df is None:
        mps_df = pd.DataFrame()
            
    _DATA_CACHE["mps_df"] = mps_df
    if not mps_df.empty:
        mps_list, mps_map = compute_mp_metrics(mps_df, works)
        _DATA_CACHE["mps_list"] = mps_list
        _DATA_CACHE["mps_map"] = mps_map
        logger.info(f"[PIPELINE INITIALIZED] Loaded {len(works)} works & {len(mps_list)} MP records.")
    else:
        logger.info(f"[PIPELINE INITIALIZED] Loaded {len(works)} works.")

class RecalculateRequest(BaseModel):
    weight_financial: float = Field(30.0, ge=0.0, le=100.0, description="Financial Risk dimension weight")
    weight_delay: float = Field(30.0, ge=0.0, le=100.0, description="Delay & Stagnation dimension weight")
    weight_duplicate: float = Field(25.0, ge=0.0, le=100.0, description="Duplicate Overlap dimension weight")
    weight_compliance: float = Field(15.0, ge=0.0, le=100.0, description="Statutory Compliance dimension weight")

    @model_validator(mode="after")
    def validate_weights_sum(self):
        total = self.weight_financial + self.weight_delay + self.weight_duplicate + self.weight_compliance
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"Total risk weights must sum to exactly 100.0. Current total is {total:.1f}.")
        return self

@router.get("/health")
def health_check():
    """Service liveness & pipeline readiness health check."""
    total = _DATA_CACHE.get("total_works_count") or len(_DATA_CACHE.get("works", []))
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "total_works": total,
        "evaluation_date": settings.EVALUATION_DATE,
        "is_demo_mode": settings.IS_DEMO_MODE,
        "data_provenance": settings.DATA_SOURCE_LABEL
    }

@router.get("/summary")
def get_summary(district: Optional[str] = None, state: Optional[str] = None):
    """Returns high-level KPI metrics for executive overview with data provenance."""
    if _DATA_CACHE.get("use_db"):
        if not state and not district:
            return _DATA_CACHE.get("summary", {})
        return compute_summary_from_db(
            state=state,
            district=district,
            dup_pairs_count=len(_DATA_CACHE.get("dup_pairs", [])),
            evaluation_date=settings.EVALUATION_DATE,
            data_provenance=settings.DATA_SOURCE_LABEL,
            is_demo_mode=settings.IS_DEMO_MODE,
            db_path=_DATA_CACHE.get("db_path", DB_PATH)
        )

    works = _DATA_CACHE["works"]
    if state:
        works = [w for w in works if w["state"].lower() == state.lower()]
    if district:
        works = [w for w in works if w["district"].lower() == district.lower()]
        
    crit = sum(1 for w in works if w["risk_level"] == "CRITICAL")
    high = sum(1 for w in works if w["risk_level"] == "HIGH")
    med = sum(1 for w in works if w["risk_level"] == "MEDIUM")
    low = sum(1 for w in works if w["risk_level"] == "LOW")
    total_amt = sum(float(w.get("sanctioned_amount", 0.0)) for w in works)
    flagged_amt = sum(float(w.get("sanctioned_amount", 0.0)) for w in works if w["risk_level"] in ["CRITICAL", "HIGH"])
    
    return {
        "total_works": len(works),
        "critical_count": crit,
        "high_count": high,
        "medium_count": med,
        "low_count": low,
        "total_sanctioned_amount": round(total_amt, 2),
        "flagged_amount": round(flagged_amt, 2),
        "cost_anomalies_count": sum(1 for w in works if w["financial_risk"] >= 15),
        "stagnation_count": sum(1 for w in works if w["delay_risk"] >= 14),
        "duplicate_candidates_count": len(_DATA_CACHE["dup_pairs"]),
        "missing_docs_count": sum(1 for w in works if w["compliance_risk"] >= 5),
        "evaluation_date": settings.EVALUATION_DATE,
        "data_provenance": settings.DATA_SOURCE_LABEL,
        "is_demo_mode": settings.IS_DEMO_MODE
    }

@router.get("/works")
def get_works(
    state: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    mp_name: Optional[str] = None,
    category: Optional[str] = None,
    risk_level: Optional[str] = None,
    min_score: Optional[int] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    has_coords: Optional[bool] = None,
    has_financial_risk: Optional[bool] = None,
    has_delay_risk: Optional[bool] = None,
    sort_by: Optional[str] = "overall_risk_score",
    sort_order: Optional[str] = "desc",
    limit: Optional[int] = 50,
    offset: int = 0
):
    """Returns filtered and paginated list of works ordered by risk priority score."""
    if _DATA_CACHE.get("use_db"):
        total, items = query_works_from_db(
            state=state,
            district=district,
            constituency=constituency,
            mp_name=mp_name,
            category=category,
            risk_level=risk_level,
            min_score=min_score,
            status=status,
            search=search,
            has_coords=has_coords,
            has_financial_risk=has_financial_risk,
            has_delay_risk=has_delay_risk,
            sort_by=sort_by or "overall_risk_score",
            sort_order=sort_order or "desc",
            limit=limit,
            offset=offset,
            db_path=_DATA_CACHE.get("db_path", DB_PATH)
        )
        return {
            "total": total,
            "limit": limit if (limit is not None and limit > 0) else total,
            "offset": offset,
            "items": items
        }

    items = _DATA_CACHE["works"]
    
    if state:
        items = [w for w in items if w["state"].lower() == state.lower()]
    if district:
        items = [w for w in items if w["district"].lower() == district.lower()]
    if constituency:
        items = [w for w in items if w.get("constituency", "").lower() == constituency.lower()]
    if mp_name:
        items = [w for w in items if mp_name.lower() in w.get("mp_name", "").lower()]
    if category:
        items = [w for w in items if w["work_category"].lower() == category.lower()]
    if risk_level:
        items = [w for w in items if w["risk_level"].upper() == risk_level.upper()]
    if min_score is not None:
        items = [w for w in items if w["overall_risk_score"] >= min_score]
    if search:
        s_lower = search.lower()
        items = [
            w for w in items 
            if s_lower in str(w.get("work_title") or "").lower() 
            or s_lower in str(w.get("work_id") or "").lower() 
            or s_lower in str(w.get("district") or "").lower()
            or s_lower in str(w.get("state") or "").lower()
            or s_lower in str(w.get("constituency") or "").lower()
            or s_lower in str(w.get("mp_name") or "").lower()
            or s_lower in str(w.get("implementing_agency") or "").lower()
            or s_lower in str(w.get("vendor") or "").lower()
            or s_lower in str(w.get("village") or "").lower()
            or s_lower in str(w.get("block") or "").lower()
        ]
        
    total = len(items)
    if limit is not None and limit > 0:
        paginated = items[offset : offset + limit]
        ret_limit = limit
    else:
        paginated = items[offset:]
        ret_limit = total
    return {
        "total": total,
        "limit": ret_limit,
        "offset": offset,
        "items": paginated
    }

@router.get("/works/{work_id}")
def get_work_by_id(work_id: str):
    """Returns complete record of a single project."""
    pid = work_id.strip()
    if _DATA_CACHE.get("use_db"):
        work = get_work_by_id_from_db(pid, db_path=_DATA_CACHE.get("db_path", DB_PATH))
        if work:
            return work
    work = _DATA_CACHE["works_map"].get(pid)
    if not work:
        raise HTTPException(status_code=404, detail=f"Work ID '{work_id}' not found.")
    return work

@router.get("/works/{work_id}/explanation")
def get_work_explanation(work_id: str):
    """Returns forensic explainability dossier for a specific project."""
    pid = work_id.strip()
    work = None
    if _DATA_CACHE.get("use_db"):
        work = get_work_by_id_from_db(pid, db_path=_DATA_CACHE.get("db_path", DB_PATH))
    if not work:
        work = _DATA_CACHE["works_map"].get(pid)
    if not work:
        raise HTTPException(status_code=404, detail=f"Work ID '{work_id}' not found.")
        
    c_eval = work.get("cost_evaluation", {})
    u_eval = work.get("duplicate_evaluation", {})
    dup_match = None
    if u_eval.get("has_candidate") and u_eval.get("paired_work_id"):
        paired_id = u_eval["paired_work_id"]
        paired_work = None
        if _DATA_CACHE.get("use_db"):
            paired_work = get_work_by_id_from_db(paired_id, db_path=_DATA_CACHE.get("db_path", DB_PATH))
        if not paired_work:
            paired_work = _DATA_CACHE["works_map"].get(paired_id)
        if paired_work:
            dup_match = {
                "paired_work_id": paired_id,
                "paired_work": paired_work,
                "distance_meters": u_eval.get("distance_meters"),
                "text_similarity": u_eval.get("text_similarity"),
                "combined_score": u_eval.get("combined_score"),
                "verification_status": u_eval.get("verification_status")
            }
            
    return {
        "work_id": work["work_id"],
        "work_title": work["work_title"],
        "work_category": work["work_category"],
        "district": work["district"],
        "state": work["state"],
        "overall_risk_score": work["overall_risk_score"],
        "risk_level": work["risk_level"],
        "primary_risk_factor": work["primary_risk_factor"],
        "component_breakdown": {
            "financial_risk": {"score": work["financial_risk"], "max": 30},
            "delay_risk": {"score": work["delay_risk"], "max": 30},
            "duplicate_risk": {"score": work["duplicate_risk"], "max": 25},
            "compliance_risk": {"score": work["compliance_risk"], "max": 15}
        },
        "evidence_summary": work["evidence_summary"],
        "recommended_action": work["recommended_action"],
        "cost_evaluation": c_eval,
        "delay_evaluation": work.get("delay_evaluation", {}),
        "duplicate_evaluation": u_eval,
        "compliance_evaluation": work.get("compliance_evaluation", {}),
        "duplicate_match": dup_match,
        "data_quality_warnings": work.get("data_quality_warnings", []),
        "mp_name": work.get("mp_name"),
        "constituency": work.get("constituency"),
        "block": work.get("block"),
        "village": work.get("village"),
        "ward": work.get("ward"),
        "city": work.get("city"),
        "house": work.get("house"),
        "ida_approval": work.get("ida_approval"),
        "implementing_agency": work.get("implementing_agency"),
        "status": work.get("status"),
        "sanctioned_amount": work.get("sanctioned_amount"),
        "recommendation_date": work.get("recommendation_date"),
        "source": work.get("source", work.get("data_source", "existing")),
        "data_source": work.get("data_source", settings.DATA_SOURCE_LABEL),
        "evaluation_date": settings.EVALUATION_DATE
    }

@router.get("/anomalies/duplicates")
def get_duplicate_candidates():
    """Returns spatial and semantic overlapping asset pairs for auditor inspection."""
    pairs = _DATA_CACHE.get("dup_pairs", [])
    return {
        "total_pairs": len(pairs),
        "duplicate_pairs": pairs,
        "pairs": pairs
    }

@router.get("/map/layers")
def get_map_layers(state: Optional[str] = None, district: Optional[str] = None):
    """Returns GeoJSON FeatureCollection of all works with valid coordinates, color-coded by risk."""
    if _DATA_CACHE.get("use_db"):
        _, works = query_works_from_db(
            state=state,
            district=district,
            has_coords=True,
            limit=2000,
            db_path=_DATA_CACHE.get("db_path", DB_PATH)
        )
    else:
        works = _DATA_CACHE["works"]
        if state:
            works = [w for w in works if w["state"].lower() == state.lower()]
        if district:
            works = [w for w in works if w["district"].lower() == district.lower()]
        
    features = []
    for w in works:
        try:
            lat = float(w.get("latitude"))
            lon = float(w.get("longitude"))
            # Coordinate bounding check for India
            if 8.0 <= lat <= 37.5 and 68.0 <= lon <= 97.5:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat]
                    },
                    "properties": {
                        "work_id": w["work_id"],
                        "work_title": w["work_title"],
                        "work_category": w["work_category"],
                        "district": w["district"],
                        "state": w["state"],
                        "overall_risk_score": w["overall_risk_score"],
                        "risk_level": w["risk_level"],
                        "primary_risk_factor": w["primary_risk_factor"],
                        "sanctioned_amount": w["sanctioned_amount"],
                        "physical_progress": w["physical_progress"],
                        "financial_progress": w["financial_progress"]
                    }
                })
        except (ValueError, TypeError):
            continue
            
    return {
        "type": "FeatureCollection",
        "features": features
    }

@router.get("/filters")
def get_filter_options():
    """Returns precomputed distinct states, districts, and categories for instant filter populating."""
    if _DATA_CACHE.get("use_db"):
        return _DATA_CACHE.get("filter_options", {})
    return {
        "states": sorted(list(set(w.get("state") for w in _DATA_CACHE.get("works", []) if w.get("state")))),
        "categories": sorted(list(set(w.get("work_category") for w in _DATA_CACHE.get("works", []) if w.get("work_category")))),
        "statuses": sorted(list(set(w.get("status") for w in _DATA_CACHE.get("works", []) if w.get("status")))),
        "state_districts": {}
    }

@router.post("/policy/recalculate")
def recalculate_risk_scores(req: RecalculateRequest):
    """Dynamically re-evaluates all scores when policy sliders are adjusted. Rejects invalid weight totals."""
    df = _DATA_CACHE["df"]
    if df is None:
        raise HTTPException(status_code=500, detail="Underlying dataset not initialized.")
        
    works, summary, dup_pairs, cohort_stats = run_full_risk_pipeline(
        df,
        weight_financial=req.weight_financial,
        weight_delay=req.weight_delay,
        weight_duplicate=req.weight_duplicate,
        weight_compliance=req.weight_compliance
    )
    clean_works = sanitize_for_json(works)
    versions = _DATA_CACHE.setdefault("project_versions", {})
    for w in clean_works:
        w_id = w["work_id"]
        w["version"] = versions.setdefault(w_id, 1)
    _DATA_CACHE["works"] = clean_works
    _DATA_CACHE["works_map"] = {w["work_id"]: w for w in clean_works}
    _DATA_CACHE["summary"] = sanitize_for_json(summary)
    _DATA_CACHE["dup_pairs"] = sanitize_for_json(dup_pairs)
    _DATA_CACHE["cohort_stats"] = sanitize_for_json(cohort_stats)
    
    # Recompute MP metrics
    mps_df = _DATA_CACHE.get("mps_df")
    if mps_df is not None and not mps_df.empty:
        mps_list, mps_map = compute_mp_metrics(mps_df, works)
        _DATA_CACHE["mps_list"] = mps_list
        _DATA_CACHE["mps_map"] = mps_map
        
    return {
        "message": "Risk scores successfully recalculated with calibrated policy weights",
        "calibrated_weights": {
            "financial": req.weight_financial,
            "delay": req.weight_delay,
            "duplicate": req.weight_duplicate,
            "compliance": req.weight_compliance
        },
        "new_summary": summary
    }

@router.get("/mps")
def get_mps(
    state: Optional[str] = None,
    search: Optional[str] = None,
    has_works: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0
):
    """Returns directory of MPs with total allocations, sanctioned funds, expenditure, and risk profile."""
    items = _DATA_CACHE.get("mps_list", [])
    
    if state:
        items = [m for m in items if m["state"].lower() == state.lower()]
    if has_works is True:
        items = [m for m in items if m["total_works"] > 0]
    elif has_works is False:
        items = [m for m in items if m["total_works"] == 0]
    if search:
        s_lower = search.lower()
        items = [
            m for m in items 
            if s_lower in m["mp_name"].lower() 
            or s_lower in m["constituency"].lower() 
            or s_lower in m["state"].lower()
        ]
        
    total = len(items)
    paginated = items[offset : offset + limit]
    
    total_alloc = sum(m["allocated_amount"] for m in items)
    total_sanct = sum(m["total_sanctioned_amount"] for m in items)
    total_exp = sum(m["total_expenditure"] for m in items)
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "overview": {
            "total_mps": total,
            "total_allocated_amount": round(total_alloc, 2),
            "total_sanctioned_amount": round(total_sanct, 2),
            "total_expenditure": round(total_exp, 2),
            "overall_utilization_rate": round((total_sanct / total_alloc * 100.0), 2) if total_alloc > 0 else 0.0
        },
        "items": paginated
    }

@router.get("/mps/{mp_name}")
def get_mp_details(mp_name: str):
    """Returns full portfolio and risk dossiers of projects under a specific MP."""
    mp_key = mp_name.strip().lower()
    mp_meta = _DATA_CACHE.get("mps_map", {}).get(mp_key)
    
    if not mp_meta:
        for k, v in _DATA_CACHE.get("mps_map", {}).items():
            if mp_key in k or k in mp_key:
                mp_meta = v
                break
                
    if not mp_meta:
        raise HTTPException(status_code=404, detail=f"MP '{mp_name}' not found.")
        
    works = [w for w in _DATA_CACHE["works"] if mp_meta["mp_name"].lower() in str(w.get("mp_name", "")).lower()]
    
    return {
        "mp_profile": mp_meta,
        "total_works": len(works),
        "works": works
    }

@router.get("/states")
def get_state_summaries():
    """Returns state-wise summary of MP allocations, sanctioned projects, and risk metrics."""
    mps = _DATA_CACHE.get("mps_list", [])
    state_map: Dict[str, Dict[str, Any]] = {}
    for m in mps:
        st = m["state"]
        if st not in state_map:
            state_map[st] = {
                "state": st,
                "total_mps": 0,
                "total_allocated_amount": 0.0,
                "total_sanctioned_amount": 0.0,
                "total_expenditure": 0.0,
                "total_works": 0,
                "high_risk_works": 0
            }
        state_map[st]["total_mps"] += 1
        state_map[st]["total_allocated_amount"] += m["allocated_amount"]
        state_map[st]["total_sanctioned_amount"] += m["total_sanctioned_amount"]
        state_map[st]["total_expenditure"] += m["total_expenditure"]
        state_map[st]["total_works"] += m["total_works"]
        state_map[st]["high_risk_works"] += m["high_risk_works_count"]
        
    result = []
    for st, v in sorted(state_map.items()):
        alloc = v["total_allocated_amount"]
        sanct = v["total_sanctioned_amount"]
        v["utilization_percentage"] = round((sanct / alloc * 100.0), 2) if alloc > 0 else 0.0
        v["total_allocated_amount"] = round(alloc, 2)
        v["total_sanctioned_amount"] = round(sanct, 2)
        v["total_expenditure"] = round(v["total_expenditure"], 2)
        result.append(v)
        
    return {
        "total_states": len(result),
        "states": result
    }

class FieldVerificationRequest(BaseModel):
    operation_id: str = Field(..., description="Unique client operation ID for idempotency")
    progress: float = Field(..., ge=0.0, le=100.0, description="Verified physical progress percentage (0-100)")
    verification_status: str = Field(..., description="Verification status e.g. FULLY_VERIFIED, PARTIALLY_VERIFIED, DISCREPANCY_FOUND")
    remarks: Optional[str] = Field(None, description="Field inspection observations and notes")
    latitude: Optional[float] = Field(None, description="Field captured latitude")
    longitude: Optional[float] = Field(None, description="Field captured longitude")
    verified_at: Optional[str] = Field(None, description="ISO timestamp of field verification")
    user_id: Optional[str] = Field("FIELD_OFFICER_01", description="Authorized officer ID")
    device_id: Optional[str] = Field(None, description="Client device identifier")
    evidence_photo: Optional[str] = Field(None, description="Base64 or URL of captured photo")
    expected_version: Optional[int] = Field(None, description="Expected project version for concurrency control")

    @model_validator(mode="after")
    def validate_coordinates_if_present(self):
        if self.latitude is not None or self.longitude is not None:
            if self.latitude is None or self.longitude is None:
                raise ValueError("Both latitude and longitude must be provided together.")
            if not (8.0 <= self.latitude <= 37.5):
                raise ValueError(f"Latitude {self.latitude} outside valid India bounding box (8.0 - 37.5).")
            if not (68.0 <= self.longitude <= 97.5):
                raise ValueError(f"Longitude {self.longitude} outside valid India bounding box (68.0 - 97.5).")
        return self

@router.post("/projects/{project_id}/verification")
def record_field_verification(project_id: str, req: FieldVerificationRequest):
    """
    Submits an offline or online field verification with idempotency protection,
    optimistic concurrency conflict detection, and central AI risk recalculation.
    """
    pid = project_id.strip()

    # 1. Idempotency Check: Return previously processed result for duplicate operation_id
    processed = _DATA_CACHE.setdefault("processed_operations", {})
    if req.operation_id in processed:
        logger.info(f"Idempotent hit: operation_id '{req.operation_id}' already processed. Returning cached response.")
        return processed[req.operation_id]

    # 2. Project Existence Validation
    works_map = _DATA_CACHE.get("works_map", {})
    server_work = works_map.get(pid)
    if not server_work:
        # Check case-insensitive match
        for k, v in works_map.items():
            if k.lower() == pid.lower():
                server_work = v
                pid = k
                break
        if not server_work:
            raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")

    # 3. Optimistic Concurrency Control (Version Conflict Detection)
    versions = _DATA_CACHE.setdefault("project_versions", {})
    current_version = versions.get(pid, server_work.get("version", 1))

    if req.expected_version is not None and req.expected_version != current_version:
        logger.warning(
            f"Concurrency Conflict on '{pid}': expected_version={req.expected_version} != current_version={current_version}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Conflict detected: Project was updated after it was downloaded. Please review latest data before submitting.",
                "expected_version": req.expected_version,
                "current_version": current_version,
                "server_work": {
                    "work_id": server_work["work_id"],
                    "work_title": server_work["work_title"],
                    "district": server_work["district"],
                    "physical_progress": server_work.get("physical_progress"),
                    "financial_progress": server_work.get("financial_progress"),
                    "overall_risk_score": server_work.get("overall_risk_score"),
                    "risk_level": server_work.get("risk_level"),
                    "version": current_version
                }
            }
        )

    # 4. Record Field Verification in Audit Ledger
    all_verifications = _DATA_CACHE.setdefault("field_verifications", [])
    ver_id = f"VER-{len(all_verifications) + 1:04d}"
    
    prev_progress = float(server_work.get("physical_progress", 0.0))
    prev_score = int(server_work.get("overall_risk_score", 0))
    prev_level = str(server_work.get("risk_level", "LOW"))
    prev_delay = int(server_work.get("delay_risk", 0))

    verification_record = {
        "verification_id": ver_id,
        "operation_id": req.operation_id,
        "project_id": pid,
        "user_id": req.user_id or "FIELD_OFFICER_01",
        "device_id": req.device_id,
        "progress": req.progress,
        "verification_status": req.verification_status,
        "remarks": req.remarks or "",
        "latitude": req.latitude if req.latitude is not None else server_work.get("latitude"),
        "longitude": req.longitude if req.longitude is not None else server_work.get("longitude"),
        "location_captured": (req.latitude is not None and req.longitude is not None),
        "verified_at": req.verified_at or datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "has_photo": bool(req.evidence_photo),
        "evidence_photo": req.evidence_photo if req.evidence_photo else None,
        "previous_progress": prev_progress,
        "previous_risk_score": prev_score,
        "previous_version": current_version,
        "new_version": current_version + 1,
        "sync_status": "synced"
    }
    all_verifications.append(verification_record)

    # 5. Update Project in Underlying DataFrame
    df = _DATA_CACHE.get("df")
    if df is not None and not df.empty and "work_id" in df.columns:
        mask = df["work_id"].astype(str).str.strip() == pid
        if mask.any():
            df.loc[mask, "physical_progress"] = float(req.progress)
            if req.evidence_photo:
                df.loc[mask, "photo_available"] = True
            if req.latitude is not None and req.longitude is not None:
                df.loc[mask, "latitude"] = float(req.latitude)
                df.loc[mask, "longitude"] = float(req.longitude)
            v_date = req.verified_at.split("T")[0] if (req.verified_at and "T" in req.verified_at) else (req.verified_at or settings.EVALUATION_DATE)
            df.loc[mask, "last_update_date"] = v_date

    # 6. Increment Version
    new_version = current_version + 1
    versions[pid] = new_version

    # 7. Central AI Risk Recalculation using existing analytical pipeline
    if df is not None and not df.empty:
        works, summary, dup_pairs, cohort_stats = run_full_risk_pipeline(df)
        clean_works = sanitize_for_json(works)
        for w in clean_works:
            w_id = w["work_id"]
            w["version"] = versions.setdefault(w_id, 1)
        _DATA_CACHE["works"] = clean_works
        _DATA_CACHE["works_map"] = {w["work_id"]: w for w in clean_works}
        _DATA_CACHE["summary"] = sanitize_for_json(summary)
        _DATA_CACHE["dup_pairs"] = sanitize_for_json(dup_pairs)
        _DATA_CACHE["cohort_stats"] = sanitize_for_json(cohort_stats)

        # Recompute MP portfolio allocations
        mps_df = _DATA_CACHE.get("mps_df")
        if mps_df is not None and not mps_df.empty:
            mps_list, mps_map = compute_mp_metrics(mps_df, clean_works)
            _DATA_CACHE["mps_list"] = mps_list
            _DATA_CACHE["mps_map"] = mps_map

    updated_work = _DATA_CACHE["works_map"].get(pid, server_work)
    new_score = int(updated_work.get("overall_risk_score", prev_score))
    new_level = str(updated_work.get("risk_level", prev_level))
    new_delay = int(updated_work.get("delay_risk", prev_delay))

    # Formulate transparent XAI explanation of the risk score delta
    score_diff = new_score - prev_score
    reason_parts = [f"Physical progress updated from {prev_progress:.1f}% to {req.progress:.1f}%."]
    if score_diff < 0:
        reason_parts.append(f"Risk Priority Score decreased from {prev_score} to {new_score} (reduced delay/stagnation gap).")
    elif score_diff > 0:
        reason_parts.append(f"Risk Priority Score adjusted from {prev_score} to {new_score}.")
    else:
        reason_parts.append(f"Risk Priority Score remains stable at {new_score}.")

    if prev_delay != new_delay:
        reason_parts.append(f"Delay & Stagnation component recalculated from {prev_delay} to {new_delay}.")

    explanation_msg = " ".join(reason_parts)

    response_data = {
        "success": True,
        "project_id": pid,
        "verification_id": ver_id,
        "operation_id": req.operation_id,
        "message": "Field verification synchronized successfully",
        "version": new_version,
        "risk_update": {
            "previous_risk_score": prev_score,
            "current_risk_score": new_score,
            "previous_risk_level": prev_level,
            "current_risk_level": new_level,
            "previous_delay_risk": prev_delay,
            "current_delay_risk": new_delay,
            "explanation": explanation_msg
        },
        "updated_work": updated_work
    }

    # Store in processed operations for idempotency
    processed[req.operation_id] = response_data
    return response_data

@router.get("/projects/{project_id}/verifications")
def get_project_verifications(project_id: str):
    """Returns field verification history recorded for a specific project."""
    pid = project_id.strip().lower()
    all_v = _DATA_CACHE.get("field_verifications", [])
    records = [v for v in all_v if v["project_id"].strip().lower() == pid]
    return {
        "project_id": project_id,
        "total": len(records),
        "verifications": list(reversed(records))
    }

@router.get("/projects/offline-bundle")
def get_offline_project_bundle(
    district: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 100
):
    """
    Returns a lightweight bundle of projects tailored for offline field caching.
    Includes only essential verification attributes to conserve mobile client storage.
    """
    works = _DATA_CACHE.get("works", [])
    if state:
        works = [w for w in works if str(w.get("state", "")).lower() == state.lower()]
    if district:
        works = [w for w in works if str(w.get("district", "")).lower() == district.lower()]

    compact_projects = []
    for w in works[:limit]:
        compact_projects.append({
            "work_id": w["work_id"],
            "work_title": w["work_title"],
            "work_category": w.get("work_category", ""),
            "district": w.get("district", ""),
            "state": w.get("state", ""),
            "village": w.get("village", ""),
            "ward": w.get("ward", ""),
            "latitude": w.get("latitude"),
            "longitude": w.get("longitude"),
            "sanctioned_amount": w.get("sanctioned_amount"),
            "physical_progress": w.get("physical_progress", 0.0),
            "financial_progress": w.get("financial_progress", 0.0),
            "overall_risk_score": w.get("overall_risk_score", 0),
            "risk_level": w.get("risk_level", "LOW"),
            "primary_risk_factor": w.get("primary_risk_factor", ""),
            "implementing_agency": w.get("implementing_agency", ""),
            "status": w.get("status", "IN_PROGRESS"),
            "last_update_date": w.get("last_update_date", ""),
            "version": w.get("version", 1),
            "photo_available": w.get("photo_available", False)
        })

    return {
        "total": len(compact_projects),
        "district": district or "ALL",
        "state": state or "ALL",
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "projects": compact_projects
    }
