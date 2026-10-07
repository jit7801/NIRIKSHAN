import os
import logging
from pathlib import Path
from typing import Optional
import pandas as pd
import numpy as np

logger = logging.getLogger("mplads.adapter")

def load_mplads_csv_as_dataframe(csv_path: str, max_records: Optional[int] = None) -> pd.DataFrame:
    """
    Ingests and normalizes the semicolon-separated MPLADS.csv dataset into the
    canonical schema expected by the analytical pipeline and frontend without
    modifying any AI models, anomaly detection algorithms, or UI logic.
    
    Field Mapping (as per specifications):
    - MP NAME            -> mp_name
    - WORK               -> work_title & work_description
    - CATEGORY           -> work_category
    - STATE              -> state
    - CONSTITUENCY       -> constituency & district
    - IDA                -> implementing_agency
    - CITY               -> city
    - WARD               -> ward
    - BLOCK              -> block & beneficiary_area
    - VILLAGE            -> village
    - RECOMMENDED DATE   -> recommendation_date & last_update_date
    - ALLOCATION AMOUNT  -> sanctioned_amount & estimated_cost
    - IDA APPROVAL       -> ida_approval
    - STATUS             -> status
    - HOUSE              -> house
    
    Preservation Rules:
    - All duplicate records/rows are strictly preserved for duplicate/overlap detection.
    - Missing coordinates, progress, and audit certificates are left as NaN / None / False.
    - Retains traceable source metadata (data_source='MPLADS.csv', source_row=idx+1).
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"MPLADS CSV file not found at: {csv_path}")

    logger.info(f"Reading MPLADS dataset from: {csv_path} (delimiter=';')")
    df_raw = pd.read_csv(csv_path, sep=";")
    
    if max_records is not None and max_records > 0:
        df_raw = df_raw.iloc[:max_records]

    records = []
    for idx, r in enumerate(df_raw.itertuples(index=False)):
        # Column indices:
        # 0: MP NAME, 1: WORK, 2: CATEGORY, 3: STATE, 4: CONSTITUENCY,
        # 5: IDA, 6: CITY, 7: WARD, 8: BLOCK, 9: VILLAGE,
        # 10: RECOMMENDED DATE, 11: ALLOCATION AMOUNT, 12: IDA APPROVAL,
        # 13: STATUS, 14: HOUSE
        mp_name = str(r[0]).strip() if pd.notna(r[0]) else ""
        work = str(r[1]).strip() if pd.notna(r[1]) else ""
        cat = str(r[2]).strip() if pd.notna(r[2]) else "Normal/Others"
        state = str(r[3]).strip() if pd.notna(r[3]) else ""
        const = str(r[4]).strip() if pd.notna(r[4]) else ""
        ida = str(r[5]).strip() if pd.notna(r[5]) else ""
        city = str(r[6]).strip() if pd.notna(r[6]) else ""
        ward = str(r[7]).strip() if pd.notna(r[7]) else ""
        block = str(r[8]).strip() if pd.notna(r[8]) else ""
        village = str(r[9]).strip() if pd.notna(r[9]) else ""
        rec_date = str(r[10]).strip() if pd.notna(r[10]) else ""
        
        raw_amt = r[11]
        try:
            amt = float(raw_amt) if pd.notna(raw_amt) else 0.0
        except (ValueError, TypeError):
            amt = 0.0
            
        ida_appr = str(r[12]).strip() if pd.notna(r[12]) else ""
        raw_status = str(r[13]).strip().upper() if pd.notna(r[13]) else "UNSANCTIONED"
        house = str(r[14]).strip() if pd.notna(r[14]) else ""

        records.append({
            "work_id": f"MPLADS-CSV-{idx+1:06d}",
            "mp_name": mp_name,
            "state": state,
            "district": const if const else state,
            "constituency": const,
            "work_title": work,
            "work_category": cat,
            "work_description": work,
            "recommendation_date": rec_date,
            "sanction_date": None,
            "start_date": None,
            "expected_completion_date": None,
            "actual_completion_date": None,
            "status": raw_status,
            "sanctioned_amount": amt,
            "estimated_cost": amt,
            "actual_expenditure": 0.0,
            "physical_progress": 0.0,
            "financial_progress": 0.0,
            "latitude": np.nan,
            "longitude": np.nan,
            "village": village if village else None,
            "ward": ward if ward else None,
            "beneficiary_area": block if block else None,
            "implementing_agency": ida if ida else None,
            "vendor": None,
            "last_update_date": rec_date if rec_date else None,
            "completion_certificate": False,
            "utilization_certificate": False,
            "audit_certificate": False,
            "photo_available": False,
            "asset_register_entry": False,
            "data_source": "MPLADS.csv",
            "source": "MPLADS.csv",
            "source_row": idx + 1,
            "ida_approval": ida_appr if ida_appr else None,
            "house": house if house else None,
            "city": city if city else None,
            "block": block if block else None
        })

    logger.info(f"Successfully adapted {len(records)} records from MPLADS.csv into pipeline schema.")
    return pd.DataFrame(records)

def load_and_adapt_dataset(path: str, max_records: Optional[int] = None) -> pd.DataFrame:
    """
    Auto-detects file format. If path is a semicolon-delimited MPLADS.csv (or contains
    the characteristic 'MP NAME' / 'IDA' columns), processes through the adapter.
    Otherwise reads directly via standard pd.read_csv.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset path does not exist: {path}")

    # Check header signature by reading first line
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        first_line = f.readline()

    if ";" in first_line and ("MP NAME" in first_line or "WORK" in first_line):
        return load_mplads_csv_as_dataframe(path, max_records=max_records)
    
    # Otherwise standard CSV
    return pd.read_csv(path)

