import math
from typing import Dict, Any, Tuple, List
import numpy as np
import pandas as pd
from app.core.config import settings
from app.engines.data_validator import validate_dataset
from app.engines.cost_engine import compute_cost_anomalies
from app.engines.delay_engine import compute_delay_and_stagnation
from app.engines.duplicate_engine import compute_duplicates_and_overlaps
from app.engines.compliance_engine import compute_compliance_signals

def run_full_risk_pipeline(
    df: pd.DataFrame,
    weight_financial: float = 30.0,
    weight_delay: float = 30.0,
    weight_duplicate: float = 25.0,
    weight_compliance: float = 15.0,
    eval_date_str: str | None = None
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Executes the complete explainable risk intelligence pipeline:
    1. Ingestion Validation: Schema, chronology, coordinate, and status consistency checks.
    2. Analytical Engines: Cost anomalies (multi-tier cohorts), Delay & Stagnation, BallTree Duplicate detection, and Statutory Compliance.
    3. Unified Risk Synthesis: Synthesizes a 0-100 Risk Priority Score with forensic evidence and advisory recommendations.
    """
    # 1. Ingestion Validation
    validated_df, validation_summary = validate_dataset(df)
    
    # 2. Execute Analytical Engines
    cost_res, cohort_stats = compute_cost_anomalies(validated_df)
    delay_res = compute_delay_and_stagnation(validated_df, eval_date_str=eval_date_str)
    dup_res, dup_pairs = compute_duplicates_and_overlaps(validated_df)
    compliance_res = compute_compliance_signals(validated_df)
    
    combined_works = []
    
    # Weight scaling factors relative to default baselines (30, 30, 25, 15)
    w_fin_norm = weight_financial / 30.0
    w_del_norm = weight_delay / 30.0
    w_dup_norm = weight_duplicate / 25.0
    w_cmp_norm = weight_compliance / 15.0
    
    row_records = validated_df.to_dict(orient="records")
    for row in row_records:
        w_id = str(row["work_id"]).strip()
        c_eval = cost_res.get(w_id, {"financial_risk_score": 0, "explanation": ""})
        d_eval = delay_res.get(w_id, {"delay_risk_score": 0, "explanation": ""})
        u_eval = dup_res.get(w_id, {"duplicate_risk_score": 0, "explanation": ""})
        cmp_eval = compliance_res.get(w_id, {"compliance_risk_score": 0, "signals": {}, "reasons": []})
        
        # Component scaled scores
        fin_score = min(round(weight_financial), max(0, round(c_eval["financial_risk_score"] * w_fin_norm)))
        del_score = min(round(weight_delay), max(0, round(d_eval["delay_risk_score"] * w_del_norm)))
        dup_score = min(round(weight_duplicate), max(0, round(u_eval["duplicate_risk_score"] * w_dup_norm)))
        cmp_score = min(round(weight_compliance), max(0, round(cmp_eval["compliance_risk_score"] * w_cmp_norm)))
        
        total_score = min(100, max(0, fin_score + del_score + dup_score + cmp_score))
        
        # Risk Tiers
        if total_score >= 80:
            level = "CRITICAL"
        elif total_score >= 60:
            level = "HIGH"
        elif total_score >= 30:
            level = "MEDIUM"
        else:
            level = "LOW"
            
        # Compile forensic evidence bullet points
        evidence = []
        if c_eval["financial_risk_score"] >= 15:
            evidence.append(c_eval["explanation"])
        if d_eval["delay_risk_score"] >= 12:
            evidence.append(d_eval["explanation"])
        if u_eval["duplicate_risk_score"] >= 10:
            evidence.append(u_eval["explanation"])
            
        # Add compliance reasons if any deficit detected
        if cmp_eval["compliance_risk_score"] > 0:
            evidence.extend([r for r in cmp_eval["reasons"] if "fully in compliance" not in r])
            
        # Data quality warnings attached to evidence
        dq_warnings = row.get("data_quality_warnings", [])
        if dq_warnings:
            evidence.append(f"Data Quality Note: {'; '.join(dq_warnings)}")
            
        if not evidence:
            evidence.append("Work metrics and milestone progress track within expected cohort parameters.")
            
        # Determine primary risk driver
        scores_map = {
            "Cost Anomaly": fin_score,
            "Delay & Stagnation": del_score,
            "Duplicate Overlap": dup_score,
            "Compliance Deficit": cmp_score
        }
        primary_driver = max(scores_map, key=scores_map.get)
        if total_score < 30:
            primary_driver = "Routine Oversight"
            
        # Formulate strictly advisory administrative inspection recommendations (Governance Compliant)
        actions = []
        if u_eval["duplicate_risk_score"] >= 10:
            actions.append("Compare work orders, site coordinates, beneficiary area, and technical drawings for nearby assets to verify independent physical utility.")
        if d_eval["delay_risk_score"] >= 15:
            actions.append("Request updated physical progress milestone report, ground photographs, and revised completion timeline from implementing agency.")
        if c_eval["financial_risk_score"] >= 18:
            actions.append("Review project estimate, technical sanction, bill of quantities (BOQ), and applicable Schedule of Rates (SOR).")
        if cmp_eval["compliance_risk_score"] >= 5:
            actions.append("Review fund-release eligibility according to applicable rules and pending statutory documentation.")
        if not actions:
            actions.append("Maintain standard periodic administrative oversight.")
            
        rec_action = " ".join(actions) + " (All recommendations are advisory and subject to field verification by authorized administrative authorities)."

        # Clean row dictionary for strict JSON compatibility (replacing NaN/inf with None)
        clean_row = {}
        for k, v in row.items():
            if isinstance(v, (int, bool, str)):
                clean_row[k] = v
            elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean_row[k] = None
            elif isinstance(v, (list, tuple, dict)):
                clean_row[k] = v
            elif v is None:
                clean_row[k] = None
            else:
                try:
                    if pd.isna(v):
                        clean_row[k] = None
                    else:
                        clean_row[k] = v
                except Exception:
                    clean_row[k] = v

        work_record = {
            **clean_row,
            "overall_risk_score": total_score,
            "risk_level": level,
            "financial_risk": fin_score,
            "delay_risk": del_score,
            "duplicate_risk": dup_score,
            "compliance_risk": cmp_score,
            "primary_risk_factor": primary_driver,
            "evidence_summary": evidence,
            "recommended_action": rec_action,
            "cost_evaluation": c_eval,
            "delay_evaluation": d_eval,
            "duplicate_evaluation": u_eval,
            "compliance_evaluation": cmp_eval,
            "data_quality_warnings": dq_warnings,
            "data_source": str(row.get("data_source", settings.DATA_SOURCE_LABEL))
        }
        combined_works.append(work_record)
        
    # Sort works by overall risk priority descending
    combined_works.sort(key=lambda x: x["overall_risk_score"], reverse=True)
    
    # Calculate executive summary statistics
    summary = {
        "total_works": len(combined_works),
        "critical_count": sum(1 for w in combined_works if w["risk_level"] == "CRITICAL"),
        "high_count": sum(1 for w in combined_works if w["risk_level"] == "HIGH"),
        "medium_count": sum(1 for w in combined_works if w["risk_level"] == "MEDIUM"),
        "low_count": sum(1 for w in combined_works if w["risk_level"] == "LOW"),
        "total_sanctioned_amount": round(sum(float(w.get("sanctioned_amount", 0.0)) for w in combined_works), 2),
        "flagged_amount": round(sum(float(w.get("sanctioned_amount", 0.0)) for w in combined_works if w["risk_level"] in ["CRITICAL", "HIGH"]), 2),
        "cost_anomalies_count": sum(1 for w in combined_works if w["financial_risk"] >= 15),
        "stagnation_count": sum(1 for w in combined_works if w["delay_risk"] >= 14),
        "duplicate_candidates_count": len(dup_pairs),
        "missing_docs_count": sum(1 for w in combined_works if w["compliance_risk"] >= 5),
        "validation_summary": validation_summary,
        "is_demo_mode": settings.IS_DEMO_MODE,
        "data_provenance": settings.DATA_SOURCE_LABEL
    }
    
    return combined_works, summary, dup_pairs, cohort_stats
