import os
import sys
import time
import logging
import pandas as pd

# Add backend to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("mplads.seed")

from app.core.config import settings
from app.adapters.csv_adapter import load_mplads_csv_as_dataframe
from app.engines.risk_engine import run_full_risk_pipeline
from app.api.v1.router import sanitize_for_json, compute_mp_metrics
from app.core.db import save_pipeline_results, DB_PATH, load_metadata_from_db, query_works_from_db

def seed():
    start_time = time.time()
    logger.info("Starting database precomputation and seeding...")
    
    # 1. Load benchmark works
    df = None
    works_candidates = [
        os.path.join(backend_dir, "data", "mplads_works.csv"),
        "data/mplads_works.csv",
        "../data/mplads_works.csv",
    ]
    for c in works_candidates:
        if os.path.exists(c):
            df = pd.read_csv(c)
            if "source" not in df.columns:
                df["source"] = "existing"
            if "data_source" not in df.columns:
                df["data_source"] = "OFFICIAL_ESAKSHI_DATA"
            break
            
    # 2. Load MPLADS.csv
    csv_candidates = [
        os.path.join(backend_dir, "data", "MPLADS.csv"),
        "data/MPLADS.csv",
        "../data/MPLADS.csv"
    ]
    csv_df = None
    for c in csv_candidates:
        if os.path.exists(c):
            logger.info(f"Loading MPLADS.csv from {c}...")
            csv_df = load_mplads_csv_as_dataframe(c)
            break
            
    if csv_df is not None and not csv_df.empty:
        if df is not None and not df.empty:
            logger.info(f"Combining {len(df)} benchmark works with {len(csv_df)} MPLADS.csv records...")
            df = pd.concat([df, csv_df], ignore_index=True)
        else:
            df = csv_df
            
    total_records = len(df)
    logger.info(f"Total dataset records to evaluate: {total_records}")
    
    # 3. Run full risk pipeline (exact unchanged logic)
    works, summary, dup_pairs, cohort_stats = run_full_risk_pipeline(df)
    clean_works = sanitize_for_json(works)
    
    for w in clean_works:
        w_id = w["work_id"]
        w["version"] = 1
        if not w.get("source"):
            w["source"] = "MPLADS.csv" if "MPLADS-CSV" in str(w_id) else "existing"
        if not w.get("data_source"):
            w["data_source"] = "MPLADS.csv" if "MPLADS-CSV" in str(w_id) else "OFFICIAL_ESAKSHI_DATA"

    # 4. Load MP allocations
    mps_candidates = [
        os.path.join(backend_dir, "data", "mp_allocations.csv"),
        "data/mp_allocations.csv"
    ]
    mps_df = None
    for c in mps_candidates:
        if os.path.exists(c):
            mps_df = pd.read_csv(c)
            break
            
    if mps_df is not None and not mps_df.empty:
        mps_list, mps_map = compute_mp_metrics(mps_df, works)
    else:
        mps_list, mps_map = [], {}

    # 5. Save everything to SQLite database
    db_file = os.path.join(backend_dir, "data", "mplads_store.db")
    logger.info(f"Saving evaluated records and metadata to {db_file}...")
    save_pipeline_results(
        works=clean_works,
        summary=sanitize_for_json(summary),
        dup_pairs=sanitize_for_json(dup_pairs),
        cohort_stats=sanitize_for_json(cohort_stats),
        mps_list=mps_list,
        mps_map=mps_map,
        db_path=db_file
    )

    elapsed = time.time() - start_time
    file_size_mb = os.path.getsize(db_file) / (1024 * 1024)
    logger.info(f"[SUCCESS] Database seeded in {elapsed:.2f}s! DB file size: {file_size_mb:.2f} MB")
    
    # Verification query
    t_count, sample_items = query_works_from_db(limit=5, db_path=db_file)
    logger.info(f"[VERIFIED] SQLite holds {t_count} records. Sample item 0: {sample_items[0]['work_id']}")
    
if __name__ == "__main__":
    seed()
