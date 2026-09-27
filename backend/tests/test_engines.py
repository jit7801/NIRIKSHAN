import pytest
import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engines.cost_engine import compute_cost_anomalies, extract_unit_metric
from app.engines.delay_engine import compute_delay_and_stagnation
from app.engines.duplicate_engine import compute_duplicates_and_overlaps, haversine_distance_meters
from app.engines.compliance_engine import evaluate_work_compliance, compute_compliance_signals
from app.engines.risk_engine import run_full_risk_pipeline

@pytest.fixture
def sample_df():
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/mplads_works.csv"))
    if not os.path.exists(data_path):
        data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/mplads_works.csv"))
    return pd.read_csv(data_path)

def test_haversine_distance():
    # Test known distance ~35m between planted points
    d = haversine_distance_meters(26.915000, 75.790000, 26.915250, 75.790250)
    assert 30.0 < d < 45.0

def test_cost_anomaly_flagged(sample_df):
    results, cohort_stats = compute_cost_anomalies(sample_df)
    w42_cost = results["MPLAD-RJ-2024-0042"]
    assert w42_cost["financial_risk_score"] >= 20
    assert w42_cost["cost_ratio"] >= 1.5
    assert w42_cost["cohort_tier"] in ("DISTRICT", "STATE_FALLBACK", "NATIONAL_FALLBACK")

def test_cost_zero_mad_and_fallback_cohorts():
    # Benchmark cohort where all projects have identical cost (MAD = 0)
    test_data = pd.DataFrame([
        {
            "work_id": f"TEST-00{i}",
            "work_category": "Road Works",
            "district": "TestDistrict",
            "state": "TestState",
            "sanctioned_amount": 1000000.0,
            "estimated_cost": 1000000.0,
            "actual_expenditure": 500000.0,
            "physical_progress": 50.0,
            "work_title": "Test Road",
            "work_description": "Road paving"
        }
        for i in range(10)
    ])
    results, summaries = compute_cost_anomalies(test_data)
    # MAD must be handled safely without division by zero
    for _, res in results.items():
        assert not np.isnan(res["modified_z_score"])
        assert res["cost_ratio"] == 1.0

def test_extract_unit_metric():
    row_road = {"work_category": "Road Works", "work_title": "Construction of 600m CC Road", "work_description": ""}
    qty, unit = extract_unit_metric(row_road)
    assert qty == 600.0
    assert unit == "metres"
    
    row_school = {"work_category": "School Infrastructure", "work_title": "2 Additional Classrooms", "work_description": ""}
    qty_s, unit_s = extract_unit_metric(row_school)
    assert qty_s == 2.0
    assert unit_s == "classrooms"

def test_delay_stagnation_flagged(sample_df):
    results = compute_delay_and_stagnation(sample_df, eval_date_str="2024-09-15")
    w42_delay = results["MPLAD-RJ-2024-0042"]
    assert w42_delay["delay_risk_score"] >= 25
    assert w42_delay["is_stagnant"] is True
    assert w42_delay["progress_gap"] >= 35.0

def test_centralized_eval_date(sample_df):
    # Earlier evaluation date: should result in fewer or zero days overdue
    results_early = compute_delay_and_stagnation(sample_df, eval_date_str="2024-01-01")
    assert results_early["MPLAD-RJ-2024-0042"]["days_overdue"] == 0

def test_duplicate_detection_balltree(sample_df):
    per_work, candidate_pairs = compute_duplicates_and_overlaps(sample_df)
    w42_dup = per_work["MPLAD-RJ-2024-0042"]
    assert w42_dup["has_candidate"] is True
    assert w42_dup["paired_work_id"] == "MPLAD-RJ-2024-0089"
    assert w42_dup["distance_meters"] < 50.0
    assert "POSSIBLE DUPLICATE / OVERLAP" in w42_dup["verification_status"]

def test_compliance_engine_disaggregated_signals(sample_df):
    results = compute_compliance_signals(sample_df)
    assert "MPLAD-RJ-2024-0042" in results
    w42_cmp = results["MPLAD-RJ-2024-0042"]
    assert "signals" in w42_cmp
    assert "missing_completion_certificate" in w42_cmp["signals"]
    assert "missing_utilization_certificate" in w42_cmp["signals"]
    assert "missing_photo" in w42_cmp["signals"]
    assert "missing_asset_register" in w42_cmp["signals"]

def test_unified_risk_score_flagship(sample_df):
    works, summary, dup_pairs, cohort_stats = run_full_risk_pipeline(sample_df)
    works_map = {w["work_id"]: w for w in works}
    w42 = works_map["MPLAD-RJ-2024-0042"]
    assert w42["overall_risk_score"] >= 80
    assert w42["risk_level"] == "CRITICAL"
    assert len(w42["evidence_summary"]) >= 3
    # Check that recommendation contains advisory disclaimer
    assert "advisory" in w42["recommended_action"].lower()

def test_mp_allocations_and_metrics(sample_df):
    from app.api.v1.router import compute_mp_metrics
    from app.core.config import settings
    works, _, _, _ = run_full_risk_pipeline(sample_df)
    mps_path = settings.MP_DATA_PATH
    if os.path.exists(mps_path):
        mps_df = pd.read_csv(mps_path)
        mp_list, mp_map = compute_mp_metrics(mps_df, works)
        assert len(mp_list) > 500
        jaipur_mp = mp_map.get("manju sharma")
        assert jaipur_mp is not None
        assert jaipur_mp["total_works"] > 0
        assert jaipur_mp["allocated_amount"] > 0

def test_leave_one_out_peer_statistics():
    # Construct a cohort of 5 works with 10L each and 1 outlier work of 50L
    works_data = [
        {
            "work_id": f"PEER-{i}",
            "work_category": "Drinking Water & Tube Wells",
            "district": "TestDistrict",
            "state": "TestState",
            "sanctioned_amount": 1000000.0,
            "estimated_cost": 1000000.0,
            "actual_expenditure": 500000.0,
            "physical_progress": 50.0,
            "work_title": "Water Point",
            "work_description": "Drinking water"
        }
        for i in range(5)
    ]
    works_data.append({
        "work_id": "OUTLIER-1",
        "work_category": "Drinking Water & Tube Wells",
        "district": "TestDistrict",
        "state": "TestState",
        "sanctioned_amount": 5000000.0,
        "estimated_cost": 5000000.0,
        "actual_expenditure": 1000000.0,
        "physical_progress": 20.0,
        "work_title": "Water Point",
        "work_description": "Drinking water"
    })
    test_df = pd.DataFrame(works_data)
    results, summaries = compute_cost_anomalies(test_df)
    
    # Under leave-one-out, the peer median for OUTLIER-1 should be computed strictly across the other 5 works (10L), not shifted by 50L
    outlier_res = results["OUTLIER-1"]
    assert outlier_res["peer_median"] == 1000000.0
    assert outlier_res["cost_ratio"] == 5.0
    assert outlier_res["peer_count"] == 5
    assert outlier_res["financial_risk_score"] >= 20

def test_stage_aware_compliance_rules():
    # Ongoing work at 30% progress with no completion cert should NOT be penalized for missing completion cert
    ongoing_row = {
        "work_id": "TEST-ONG-01",
        "status": "IN_PROGRESS",
        "physical_progress": 30.0,
        "financial_progress": 25.0,
        "completion_certificate": False,
        "utilization_certificate": False,
        "audit_certificate": False,
        "photo_available": True,
        "asset_register_entry": False
    }
    ong_eval = evaluate_work_compliance(ongoing_row)
    assert ong_eval["project_stage"] == "ONGOING"
    assert ong_eval["signals"]["missing_completion_certificate"] is False
    assert ong_eval["signals"]["missing_audit_certificate"] is False
    assert ong_eval["compliance_risk_score"] == 0
    
    # Completed work with missing completion cert and audit cert should be penalized
    completed_row = {
        "work_id": "TEST-COMP-01",
        "status": "COMPLETED",
        "physical_progress": 100.0,
        "financial_progress": 100.0,
        "completion_certificate": False,
        "utilization_certificate": True,
        "audit_certificate": False,
        "photo_available": True,
        "asset_register_entry": True
    }
    comp_eval = evaluate_work_compliance(completed_row)
    assert comp_eval["project_stage"] == "COMPLETED"
    assert comp_eval["signals"]["missing_completion_certificate"] is True
    assert comp_eval["signals"]["missing_audit_certificate"] is True
    assert comp_eval["compliance_risk_score"] == 7

def test_duplicate_signal_strength(sample_df):
    _, candidate_pairs = compute_duplicates_and_overlaps(sample_df)
    assert len(candidate_pairs) > 0
    for pair in candidate_pairs:
        assert pair["signal_strength"] in ("STRONG CANDIDATE", "MODERATE CANDIDATE", "WEAK CANDIDATE")
        assert "POSSIBLE DUPLICATE / OVERLAP — VERIFY" in pair["verification_status"]
