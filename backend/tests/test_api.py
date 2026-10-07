import pytest
import sys
import os
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.api.v1.router import (
    load_and_run_pipeline,
    health_check,
    get_summary,
    get_works,
    get_work_by_id,
    get_work_explanation,
    get_duplicate_candidates,
    get_map_layers,
    get_mps,
    get_state_summaries,
    recalculate_risk_scores,
    RecalculateRequest
)

@pytest.fixture(scope="module", autouse=True)
def init_pipeline():
    load_and_run_pipeline()

def test_health_check_endpoint():
    res = health_check()
    assert res["status"] == "healthy"
    assert res["total_works"] > 0
    assert "evaluation_date" in res
    assert res["data_provenance"] == settings.DATA_SOURCE_LABEL

def test_summary_endpoint():
    res = get_summary()
    assert res["total_works"] > 0
    assert "critical_count" in res
    assert "flagged_amount" in res
    assert "duplicate_candidates_count" in res

    # Verify state and district filtering works without TypeError
    state_res = get_summary(state="Rajasthan")
    assert state_res["total_works"] > 0
    assert "duplicate_candidates_count" in state_res
    assert "evaluation_date" in state_res

def test_works_endpoint_and_pagination():
    res = get_works(limit=10, offset=0)
    assert res["limit"] == 10
    assert len(res["items"]) == 10
    assert res["total"] >= 10

def test_work_by_id_and_explanation():
    work_id = "MPLAD-RJ-2024-0042"
    w = get_work_by_id(work_id)
    assert w["work_id"] == work_id
    
    exp = get_work_explanation(work_id)
    assert exp["work_id"] == work_id
    assert exp["overall_risk_score"] >= 80
    assert "advisory" in exp["recommended_action"].lower()
    assert "cost_evaluation" in exp
    assert "delay_evaluation" in exp
    assert "duplicate_evaluation" in exp

def test_map_layers_coordinate_bounds():
    geojson = get_map_layers()
    assert geojson["type"] == "FeatureCollection"
    for feat in geojson["features"]:
        lon, lat = feat["geometry"]["coordinates"]
        assert 8.0 <= lat <= 37.5
        assert 68.0 <= lon <= 97.5

def test_mps_and_states_endpoints():
    mps_res = get_mps(limit=5)
    assert mps_res["total"] > 500
    assert len(mps_res["items"]) == 5
    
    states_res = get_state_summaries()
    assert states_res["total_states"] > 0
    assert len(states_res["states"]) > 0

def test_recalculate_request_validation():
    # Valid: weights sum to 100
    valid_req = RecalculateRequest(
        weight_financial=25.0,
        weight_delay=25.0,
        weight_duplicate=25.0,
        weight_compliance=25.0
    )
    res = recalculate_risk_scores(valid_req)
    assert "successfully recalculated" in res["message"]
    
    # Invalid: weights sum to 120 (must raise ValidationError)
    with pytest.raises(ValidationError) as excinfo:
        RecalculateRequest(
            weight_financial=40.0,
            weight_delay=30.0,
            weight_duplicate=25.0,
            weight_compliance=25.0
        )
    assert "Total risk weights must sum to exactly 100" in str(excinfo.value)

def test_mplads_csv_integration():
    # 1. Query works and verify combined dataset
    res = get_works(limit=2500, offset=0)
    items = res["items"]
    assert res["total"] > 520
    
    # 2. Existing benchmark records are still returned
    existing_items = [w for w in items if w.get("source") == "existing" or w["work_id"] == "MPLAD-RJ-2024-0042"]
    assert len(existing_items) > 0
    assert any(w["work_id"] == "MPLAD-RJ-2024-0042" for w in existing_items)
    
    # 3. CSV records are returned
    csv_items = [w for w in items if w.get("source") == "MPLADS.csv"]
    assert len(csv_items) > 0
    
    # 4. Check specific CSV row (Manoj Rajoria - Nadauli village) via search
    nadauli_res = get_works(search="Nadauli")
    assert nadauli_res["total"] >= 1
    target_work = nadauli_res["items"][0]
    assert target_work["source"] == "MPLADS.csv"
    assert "Manoj Rajoria" in target_work["mp_name"]
    assert target_work["state"] == "Rajasthan"
    assert target_work["constituency"] == "KARAULI-DHOLPUR(SC)"
    assert target_work["block"] == "Rajakhera"
    assert target_work["village"] == "Nadauli"
    assert target_work["sanctioned_amount"] == 100000.0
    assert target_work["status"] == "UNSANCTIONED"
    
    # 5. Work explanation for CSV work preserves API schema and metadata
    exp = get_work_explanation(target_work["work_id"])
    assert exp["work_id"] == target_work["work_id"]
    assert exp["source"] == "MPLADS.csv"
    assert exp["mp_name"] == "Manoj Rajoria"
    assert "overall_risk_score" in exp
    assert "component_breakdown" in exp
    
    # 6. Verify duplicate source records are preserved (e.g. repeated street lights in Darbhanga)
    darbhanga_res = get_works(search="Street lights", constituency="DARBHANGA")
    assert darbhanga_res["total"] >= 2

