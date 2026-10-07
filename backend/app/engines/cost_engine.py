import re
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from app.core.config import settings

def extract_unit_metric(row: pd.Series | dict) -> Tuple[float | None, str | None]:
    """
    Attempts to extract physical quantity and unit from project title and description
    for category-specific unit cost normalization.
    Returns (quantity_value, unit_name) or (None, None) if not available.
    """
    title = str(row.get("work_title", ""))
    desc = str(row.get("work_description", ""))
    cat = str(row.get("work_category", "")).lower()
    full_text = f"{title} {desc}".lower()
    
    # 1. Road works: metres / kilometres
    if "road" in cat or "lane" in cat or "pavement" in cat:
        m_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m|metre|meter)s?\b", full_text)
        if m_match:
            try:
                meters = float(m_match.group(1))
                if meters > 10.0:
                    return meters, "metres"
            except ValueError:
                pass
        km_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:km|kilometre|kilometer)s?\b", full_text)
        if km_match:
            try:
                meters = float(km_match.group(1)) * 1000.0
                if meters > 10.0:
                    return meters, "metres"
            except ValueError:
                pass

    # 2. School classrooms: classroom count
    if "school" in cat or "classroom" in cat:
        cr_match = re.search(r"(\d+)\s*(?:additional\s*)?classroom", full_text)
        if cr_match:
            try:
                count = float(cr_match.group(1))
                if count > 0:
                    return count, "classrooms"
            except ValueError:
                pass
                
    # 3. Community hall: capacity
    if "community" in cat or "hall" in cat:
        cap_match = re.search(r"(\d+)\s*(?:seater|capacity|persons)", full_text)
        if cap_match:
            try:
                cap = float(cap_match.group(1))
                if cap > 20:
                    return cap, "capacity"
            except ValueError:
                pass

    return None, None

def compute_cost_anomalies(df: pd.DataFrame) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Any]]:
    """
    Evaluates cost outliers with multi-tier cohort fallback (District -> State -> National -> Insufficient),
    category-specific unit cost normalization where applicable, robust Modified Z-scores (MAD),
    and unsupervised Isolation Forest multivariate anomaly detection.
    """
    min_peer_size = settings.MIN_PEER_SIZE
    results = {}
    cohort_summaries = {}
    
    df_eval = df.copy()
    
    # Precompute cohorts at 3 hierarchical tiers using sanctioned_amount
    t1_groups = {k: v for k, v in df_eval.groupby(["work_category", "district"])}
    t2_groups = {k: v for k, v in df_eval.groupby(["work_category", "state"])}
    t3_groups = {k: v for k, v in df_eval.groupby("work_category")}

    t1_arrays = {k: (v.dropna(subset=["sanctioned_amount"])["work_id"].values, v.dropna(subset=["sanctioned_amount"])["sanctioned_amount"].values) for k, v in t1_groups.items()}
    t2_arrays = {k: (v.dropna(subset=["sanctioned_amount"])["work_id"].values, v.dropna(subset=["sanctioned_amount"])["sanctioned_amount"].values) for k, v in t2_groups.items()}
    t3_arrays = {k: (v.dropna(subset=["sanctioned_amount"])["work_id"].values, v.dropna(subset=["sanctioned_amount"])["sanctioned_amount"].values) for k, v in t3_groups.items()}

    large_cohort_cache = {}
    for g_dict in (t1_arrays, t2_arrays, t3_arrays):
        for k, (_, amounts) in g_dict.items():
            if len(amounts) >= 30:
                c_clean = amounts[~np.isnan(amounts)]
                if len(c_clean) > 0:
                    c_med = float(np.median(c_clean))
                    c_mad = float(np.median(np.abs(c_clean - c_med)))
                    large_cohort_cache[k] = (c_med, c_mad)
    
    def summarize_series(arr: np.ndarray, name: str, cat: str, region: str) -> Dict[str, Any]:
        arr_clean = arr[~np.isnan(arr)]
        if len(arr_clean) == 0:
            return {}
        med = float(np.median(arr_clean))
        mad = float(np.median(np.abs(arr_clean - med)))
        return {
            "cohort_name": name,
            "category": cat,
            "region": region,
            "sample_size": len(arr_clean),
            "min": round(float(np.min(arr_clean)), 2),
            "q25": round(float(np.percentile(arr_clean, 25)), 2),
            "median": round(med, 2),
            "q75": round(float(np.percentile(arr_clean, 75)), 2),
            "max": round(float(np.max(arr_clean)), 2),
            "mad": round(mad, 2)
        }

    # Fit unsupervised Isolation Forest on continuous financial features across the dataset
    n_total = len(df_eval)
    iso_preds = np.ones(n_total)
    try:
        if n_total >= 10:
            fin_features = np.column_stack([
                df_eval["sanctioned_amount"].fillna(0).values,
                df_eval["estimated_cost"].fillna(0).values,
                df_eval["actual_expenditure"].fillna(0).values,
                np.nan_to_num(df_eval["actual_expenditure"].values / np.maximum(df_eval["physical_progress"].values, 1.0), nan=0.0, posinf=0.0)
            ])
            if not np.all(fin_features == fin_features[0, :]):
                iso = IsolationForest(contamination=0.10, random_state=42)
                iso.fit(fin_features)
                iso_preds = iso.predict(fin_features)
    except Exception:
        iso_preds = np.ones(n_total)
        
    for idx, (_, row) in enumerate(df_eval.iterrows()):
        w_id = str(row["work_id"]).strip()
        cat = str(row.get("work_category", "")).strip()
        dist = str(row.get("district", "")).strip()
        state = str(row.get("state", "")).strip()
        sanct_cost = float(row.get("sanctioned_amount", 0.0))
        is_iso_anomaly = bool(iso_preds[idx] == -1)
        
        qty, unit = extract_unit_metric(row)
        unit_cost = None
        if qty and qty > 0 and unit:
            unit_cost = round(sanct_cost / qty, 2)
            norm_method = f"UNIT_COST_NORMALIZED (₹{unit_cost:,.2f} per {unit[:-1] if unit.endswith('s') else unit})"
        else:
            norm_method = "TOTAL_COST_BASELINE"
            
        # 1. Leave-One-Out Multi-tier Cohort Selection
        # Excludes current work so it does not influence its own peer statistics
        g1 = t1_arrays.get((cat, dist))
        g2 = t2_arrays.get((cat, state))
        g3 = t3_arrays.get(cat)

        t1_len = (len(g1[1]) - (1 if w_id in g1[0] else 0)) if g1 is not None else 0
        t2_len = (len(g2[1]) - (1 if w_id in g2[0] else 0)) if g2 is not None else 0
        t3_len = (len(g3[1]) - (1 if w_id in g3[0] else 0)) if g3 is not None else 0

        if t1_len >= min_peer_size:
            cohort_tier = "DISTRICT"
            cohort_name = f"{cat} — {dist}"
            active_key = (cat, dist)
            active_group = g1
        elif t2_len >= min_peer_size:
            cohort_tier = "STATE_FALLBACK"
            cohort_name = f"{cat} — {state} (State Peer Cohort)"
            active_key = (cat, state)
            active_group = g2
        elif t3_len >= min_peer_size:
            cohort_tier = "NATIONAL_FALLBACK"
            cohort_name = f"{cat} (National Baseline)"
            active_key = cat
            active_group = g3
        else:
            cohort_tier = "INSUFFICIENT_PEER_DATA"
            cohort_name = f"{cat} (Insufficient Peer Samples < {min_peer_size})"
            active_key = None
            active_group = g3
            
        if active_group is not None:
            peer_costs = active_group[1][active_group[0] != w_id]
        else:
            peer_costs = np.array([], dtype=float)
            
        if cohort_name not in cohort_summaries and cohort_tier != "INSUFFICIENT_PEER_DATA":
            cohort_summaries[cohort_name] = summarize_series(peer_costs, cohort_name, cat, dist if cohort_tier == "DISTRICT" else state)
            
        # 2. Compute Robust Statistical Metrics (Leave-One-Out)
        cost_metric_used = "SANCTIONED_AMOUNT"
        if cohort_tier == "INSUFFICIENT_PEER_DATA":
            peer_count = len(peer_costs)
            peer_median = sanct_cost
            mad = 0.0
            ratio = 1.0
            mod_z = 0.0
            score = 4
            anomaly_reason = "STANDARD_BASELINE_INSUFFICIENT_PEERS"
            explanation = (
                f"Compared sanctioned cost ₹{sanct_cost/100000:.2f}L against baseline. "
                f"Insufficient other comparable peer projects in '{cat}' (other peers N={peer_count} < {min_peer_size}) "
                f"to establish an empirical distribution."
            )
        else:
            if active_key in large_cohort_cache:
                peer_count = len(active_group[1]) - 1
                peer_median, mad = large_cohort_cache[active_key]
            else:
                peer_count = len(peer_costs)
                peer_median = float(np.median(peer_costs)) if peer_count > 0 else 0.0
                mad = float(np.median(np.abs(peer_costs - peer_median))) if peer_count > 0 else 0.0
            
            # Safe zero-MAD handling via documented relative deviation
            if mad > 0.0:
                mod_z = 0.6745 * (sanct_cost - peer_median) / mad
            else:
                mod_z = 0.0
                
            ratio = (sanct_cost / peer_median) if peer_median > 0.0 else (1.0 if sanct_cost == 0.0 else 2.0)
            
            # 3. Transparent Scoring
            score = 0
            reasons = []
            anomaly_reason = "NORMAL_COHORT_RANGE"
            
            unit_desc = f" ({unit_cost:,.2f}/{unit[:-1] if unit and unit.endswith('s') else unit})" if unit_cost else ""
            
            if ratio >= settings.COST_EXTREME_RATIO or (mad > 0 and mod_z >= 2.5):
                score = 26
                anomaly_reason = "EXTREME_COST_OUTLIER"
                reasons.append(
                    f"Compared sanctioned cost ₹{sanct_cost/100000:.2f}L{unit_desc} against a peer median of ₹{peer_median/100000:.2f}L "
                    f"({ratio:.2f}×) across {peer_count} other comparable projects in {cohort_name}. Modified Z-score is {mod_z:.2f}."
                )
            elif ratio >= settings.COST_HIGH_RATIO or (mad > 0 and mod_z >= 1.8):
                score = 18
                anomaly_reason = "HIGH_COST_OUTLIER"
                reasons.append(
                    f"Compared sanctioned cost ₹{sanct_cost/100000:.2f}L against a peer median of ₹{peer_median/100000:.2f}L "
                    f"({ratio:.2f}×) across {peer_count} other comparable projects in {cohort_name}."
                )
            elif ratio >= settings.COST_ELEVATED_RATIO or (mad > 0 and mod_z >= 1.2):
                score = 11
                anomaly_reason = "ELEVATED_COST"
                reasons.append(
                    f"Cost is moderately above peer median ({ratio:.2f}× against ₹{peer_median/100000:.2f}L in {cohort_name})."
                )
            else:
                score = 4
                anomaly_reason = "WITHIN_EXPECTED_PEER_RANGE"
                reasons.append(
                    f"Compared sanctioned cost ₹{sanct_cost/100000:.2f}L against a peer median of ₹{peer_median/100000:.2f}L "
                    f"({ratio:.2f}×) across {peer_count} other projects in {cohort_name}."
                )
                
            if mad == 0.0:
                reasons.append("Low intra-cohort variance detected (MAD = 0); evaluated via relative percentage deviation.")
                
            # Budget overshoot check
            actual_exp = float(row.get("actual_expenditure", 0.0))
            if sanct_cost > 0 and actual_exp > 1.15 * sanct_cost:
                overshoot_pct = ((actual_exp / sanct_cost) - 1.0) * 100.0
                score = min(30, score + 4)
                reasons.append(f"Recorded actual expenditure (₹{actual_exp/100000:.2f}L) exceeds sanctioned budget by {overshoot_pct:.1f}%.")
                
            if is_iso_anomaly:
                reasons.append("Flagged by secondary multivariate Isolation Forest model as an expenditure distribution outlier.")
                
            explanation = " ".join(reasons)
            
        results[w_id] = {
            "financial_risk_score": min(score, 30),
            "max_score": 30,
            "cost_metric_used": cost_metric_used,
            "current_value": round(sanct_cost, 2),
            "work_cost": round(sanct_cost, 2),
            "peer_count": peer_count,
            "peer_median": round(peer_median, 2),
            "mad": round(mad, 2),
            "cost_ratio": round(ratio, 2),
            "modified_z_score": round(mod_z, 2),
            "modified_z": round(mod_z, 2),
            "anomaly_reason": anomaly_reason,
            "cohort_name": cohort_name,
            "cohort_tier": cohort_tier,
            "unit_quantity": qty,
            "unit_type": unit,
            "unit_cost": unit_cost,
            "normalization_method": norm_method,
            "isolation_forest_anomaly": is_iso_anomaly,
            "cohort_stats": cohort_summaries.get(cohort_name),
            "explanation": explanation
        }
        
    return results, cohort_summaries
