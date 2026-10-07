import pytest
import sys
import os
from pydantic import ValidationError
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.router import (
    load_and_run_pipeline,
    record_field_verification,
    get_project_verifications,
    get_offline_project_bundle,
    get_work_by_id,
    FieldVerificationRequest,
    _DATA_CACHE
)

@pytest.fixture(scope="module", autouse=True)
def setup_pipeline():
    load_and_run_pipeline()

def test_offline_bundle_endpoint():
    bundle = get_offline_project_bundle(limit=10)
    assert bundle["total"] > 0
    assert len(bundle["projects"]) <= 10
    first = bundle["projects"][0]
    assert "work_id" in first
    assert "physical_progress" in first
    assert "overall_risk_score" in first
    assert "version" in first

def test_valid_verification_and_risk_recalculation():
    # Pick a work with known progress
    works = _DATA_CACHE["works"]
    assert len(works) > 0
    target_work = works[0]
    w_id = target_work["work_id"]
    curr_version = target_work.get("version", 1)
    
    op_id = f"test-op-valid-{w_id}"
    req = FieldVerificationRequest(
        operation_id=op_id,
        progress=75.0,
        verification_status="PARTIALLY_VERIFIED",
        remarks="Ground inspection confirmed construction is 75% complete.",
        latitude=26.9124,
        longitude=75.7873,
        user_id="OFFICER_TEST_01",
        device_id="DEV_MOCK_1",
        expected_version=curr_version
    )

    res = record_field_verification(w_id, req)
    assert res["success"] is True
    assert res["project_id"] == w_id
    assert res["operation_id"] == op_id
    assert "verification_id" in res
    assert res["version"] == curr_version + 1
    assert "risk_update" in res
    assert "Physical progress updated from" in res["risk_update"]["explanation"]
    assert res["updated_work"]["physical_progress"] == 75.0

    # Verify audit history
    history = get_project_verifications(w_id)
    assert history["total"] >= 1
    assert any(v["operation_id"] == op_id for v in history["verifications"])

def test_idempotency_duplicate_submission():
    w_id = _DATA_CACHE["works"][1]["work_id"]
    curr_version = _DATA_CACHE["works"][1].get("version", 1)
    
    op_id = f"test-idempotent-{w_id}"
    req = FieldVerificationRequest(
        operation_id=op_id,
        progress=50.0,
        verification_status="FULLY_VERIFIED",
        remarks="First submission",
        expected_version=curr_version
    )

    # First attempt
    res1 = record_field_verification(w_id, req)
    ver_count_before = len(_DATA_CACHE["field_verifications"])
    version_after_first = res1["version"]

    # Second attempt with exact same operation_id
    res2 = record_field_verification(w_id, req)
    ver_count_after = len(_DATA_CACHE["field_verifications"])

    # Must return exact same response without creating a duplicate record or incrementing version again
    assert res1 == res2
    assert ver_count_after == ver_count_before
    assert res2["version"] == version_after_first

def test_concurrency_version_conflict():
    w_id = _DATA_CACHE["works"][2]["work_id"]
    current_version = _DATA_CACHE["project_versions"].get(w_id, 1)

    # Sending a stale version (e.g., expected_version=current_version - 1 or + 5)
    stale_version = current_version + 10
    req = FieldVerificationRequest(
        operation_id=f"test-conflict-{w_id}",
        progress=60.0,
        verification_status="PARTIALLY_VERIFIED",
        remarks="Stale attempt",
        expected_version=stale_version
    )

    with pytest.raises(HTTPException) as excinfo:
        record_field_verification(w_id, req)
    assert excinfo.value.status_code == 409
    assert "Conflict detected" in excinfo.value.detail["message"]

def test_invalid_progress_validation():
    # Progress > 100
    with pytest.raises(ValidationError):
        FieldVerificationRequest(
            operation_id="test-inv-prog-1",
            progress=110.0,
            verification_status="PARTIALLY_VERIFIED"
        )
    # Progress < 0
    with pytest.raises(ValidationError):
        FieldVerificationRequest(
            operation_id="test-inv-prog-2",
            progress=-5.0,
            verification_status="PARTIALLY_VERIFIED"
        )

def test_invalid_coordinates_validation():
    # Out of India bounds
    with pytest.raises(ValidationError) as excinfo:
        FieldVerificationRequest(
            operation_id="test-inv-coords",
            progress=50.0,
            verification_status="PARTIALLY_VERIFIED",
            latitude=55.0, # Latitude in Europe
            longitude=75.0
        )
    assert "outside valid India bounding box" in str(excinfo.value)

def test_nonexistent_project_404():
    req = FieldVerificationRequest(
        operation_id="test-nonexistent-op",
        progress=50.0,
        verification_status="PARTIALLY_VERIFIED"
    )
    with pytest.raises(HTTPException) as excinfo:
        record_field_verification("NON-EXISTENT-WORK-ID-9999", req)
    assert excinfo.value.status_code == 404
