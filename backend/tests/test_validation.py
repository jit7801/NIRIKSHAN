import pytest
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engines.data_validator import validate_dataset

def test_validator_detects_negative_amounts():
    df = pd.DataFrame([{
        "work_id": "TEST-NEG-01",
        "sanctioned_amount": -50000.0,
        "estimated_cost": 100000.0,
        "actual_expenditure": -1000.0,
        "physical_progress": 20.0,
        "financial_progress": 30.0,
        "latitude": 26.9,
        "longitude": 75.8,
        "status": "IN_PROGRESS"
    }])
    val_df, summary = validate_dataset(df)
    warnings = val_df.iloc[0]["data_quality_warnings"]
    assert any("Negative sanctioned amount" in w for w in warnings)
    assert any("Negative actual expenditure" in w for w in warnings)
    assert summary["negative_amounts_count"] >= 1

def test_validator_detects_out_of_bounds_coordinates():
    df = pd.DataFrame([{
        "work_id": "TEST-COORD-01",
        "sanctioned_amount": 500000.0,
        "physical_progress": 20.0,
        "financial_progress": 30.0,
        "latitude": 51.5074,  # London
        "longitude": -0.1278,
        "status": "IN_PROGRESS"
    }])
    val_df, summary = validate_dataset(df)
    warnings = val_df.iloc[0]["data_quality_warnings"]
    assert any("outside India boundaries" in w for w in warnings)
    assert summary["invalid_coordinates_count"] == 1

def test_validator_detects_chronology_inconsistencies():
    df = pd.DataFrame([{
        "work_id": "TEST-DATE-01",
        "sanctioned_amount": 500000.0,
        "recommendation_date": "2024-05-01",
        "sanction_date": "2024-04-01",  # Sanction before recommendation!
        "start_date": "2024-06-01",
        "expected_completion_date": "2024-03-01",  # Completion before start!
        "physical_progress": 20.0,
        "financial_progress": 30.0,
        "latitude": 26.9,
        "longitude": 75.8,
        "status": "IN_PROGRESS"
    }])
    val_df, summary = validate_dataset(df)
    warnings = val_df.iloc[0]["data_quality_warnings"]
    assert any("Sanction date" in w and "precedes recommendation" in w for w in warnings)
    assert any("Expected completion" in w and "precedes project start" in w for w in warnings)
    assert summary["chronology_inconsistencies"] >= 2

def test_validator_clean_records():
    df = pd.DataFrame([{
        "work_id": "TEST-CLEAN-01",
        "sanctioned_amount": 500000.0,
        "estimated_cost": 500000.0,
        "actual_expenditure": 250000.0,
        "recommendation_date": "2024-01-01",
        "sanction_date": "2024-02-01",
        "start_date": "2024-03-01",
        "expected_completion_date": "2024-09-01",
        "last_update_date": "2024-05-01",
        "physical_progress": 50.0,
        "financial_progress": 50.0,
        "latitude": 26.9124,
        "longitude": 75.7873,
        "status": "IN_PROGRESS"
    }])
    val_df, summary = validate_dataset(df)
    warnings = val_df.iloc[0]["data_quality_warnings"]
    assert len(warnings) == 0
    assert summary["clean_records_count"] == 1
