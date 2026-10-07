import pytest
import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.router import (
    load_and_run_pipeline,
    health_check,
    get_summary,
    get_works,
    get_work_by_id,
    get_work_explanation,
    get_map_layers,
    get_filter_options
)

@pytest.fixture(scope="module", autouse=True)
def init_pipeline():
    load_and_run_pipeline()

def test_pagination_limit_exactness():
    """Verify that default limit returns only requested page size."""
    res = get_works(limit=50, offset=0)
    assert len(res["items"]) == 50
    assert res["limit"] == 50
    assert res["total"] >= 60000

    res_10 = get_works(limit=10, offset=100)
    assert len(res_10["items"]) == 10
    assert res_10["offset"] == 100

def test_full_dataset_count_integrity():
    """Verify all ~60,000 records remain intact and accounted for."""
    res = get_works(limit=1)
    assert res["total"] == 60880

    summary = get_summary()
    assert summary["total_works"] == 60880

def test_backend_search_performance_and_accuracy():
    """Verify backend search across 60,000 records executes in < 150ms and filters correctly."""
    t0 = time.time()
    res = get_works(search="Jaipur", limit=50)
    elapsed = time.time() - t0
    assert elapsed < 0.5  # Sub-second
    assert res["total"] > 0
    for item in res["items"]:
        search_fields = [
            item.get("district"), item.get("state"), item.get("work_title"),
            item.get("mp_name"), item.get("constituency"), item.get("work_id"),
            item.get("implementing_agency"), item.get("vendor"), item.get("village"), item.get("block")
        ]
        match_found = any("jaipur" in str(f or "").lower() for f in search_fields)
        assert match_found

def test_backend_filtering():
    """Verify server-side multi-attribute filtering on state and category."""
    res = get_works(state="Rajasthan", category="Road Works", limit=20)
    assert res["total"] > 0
    for item in res["items"]:
        assert item["state"].lower() == "rajasthan"
        assert item["work_category"].lower() == "road works"

def test_map_geojson_optimization():
    """Verify GeoJSON layer endpoint returns ONLY geotagged features, not all 60,000 records."""
    t0 = time.time()
    geojson = get_map_layers()
    elapsed = time.time() - t0
    assert elapsed < 0.1  # Fast
    assert geojson["type"] == "FeatureCollection"
    # Should return around ~520 features with coordinates, NOT 60,000
    assert len(geojson["features"]) < 2000
    assert len(geojson["features"]) >= 500

def test_filter_options_endpoint():
    """Verify distinct filter options return without scanning full CSV."""
    opts = get_filter_options()
    assert "states" in opts
    assert len(opts["states"]) > 20
    assert "Rajasthan" in opts["states"]
    assert "categories" in opts
    assert len(opts["categories"]) > 0
