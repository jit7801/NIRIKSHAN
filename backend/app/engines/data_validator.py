from datetime import datetime
from typing import Tuple, Dict, Any, List
import pandas as pd
import numpy as np

INDIA_LAT_MIN = 8.0
INDIA_LAT_MAX = 37.5
INDIA_LON_MIN = 68.0
INDIA_LON_MAX = 97.5

def parse_date_safe(val: Any) -> datetime | None:
    if not val or pd.isna(val):
        return None
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None

def to_float_safe(val: Any) -> Tuple[float | None, bool]:
    """
    Returns (parsed_float_or_None, is_valid_syntax).
    None, NaN, or empty strings are treated as missing (is_valid=True), not malformed.
    """
    if val is None:
        return None, True
    try:
        if pd.isna(val):
            return None, True
    except Exception:
        pass
    s = str(val).strip()
    if s == "" or s.lower() in ("nan", "none", "null"):
        return None, True
    try:
        return float(s), True
    except (ValueError, TypeError):
        return None, False

def validate_dataset(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Validates the dataset prior to risk engine ingestion.
    Attaches a 'data_quality_warnings' list to each record without destructively modifying source data.
    Returns the enriched DataFrame and a validation summary report.
    """
    validated_df = df.copy()
    warnings_per_row: List[List[str]] = []
    
    seen_ids = set()
    dup_ids = set()
    
    # Pre-scan for duplicate work_ids
    for w_id in validated_df["work_id"]:
        s_id = str(w_id).strip()
        if s_id in seen_ids:
            dup_ids.add(s_id)
        seen_ids.add(s_id)
        
    invalid_coord_count = 0
    negative_amt_count = 0
    date_logic_error_count = 0
    status_mismatch_count = 0
    
    for _, row in validated_df.iterrows():
        row_warnings: List[str] = []
        w_id = str(row.get("work_id", "")).strip()
        
        # 1. Work ID checks
        if not w_id or w_id.lower() in ("nan", "none"):
            row_warnings.append("Missing or empty work_id.")
        elif w_id in dup_ids:
            row_warnings.append(f"Duplicate work_id detected across multiple records: '{w_id}'.")
            
        # 2. Amounts checks
        sanct, sanct_ok = to_float_safe(row.get("sanctioned_amount"))
        if not sanct_ok:
            row_warnings.append("Malformed sanctioned_amount value.")
        elif sanct is not None and sanct < 0:
            row_warnings.append(f"Negative sanctioned amount: ₹{sanct}.")
            negative_amt_count += 1
            
        est, est_ok = to_float_safe(row.get("estimated_cost"))
        if not est_ok:
            row_warnings.append("Malformed estimated_cost value.")
        elif est is not None and est < 0:
            row_warnings.append(f"Negative estimated cost: ₹{est}.")
            negative_amt_count += 1
            
        exp, exp_ok = to_float_safe(row.get("actual_expenditure"))
        if not exp_ok:
            row_warnings.append("Malformed actual_expenditure value.")
        elif exp is not None and exp < 0:
            row_warnings.append(f"Negative actual expenditure: ₹{exp}.")
            negative_amt_count += 1
            
        # 3. Progress percentages checks
        phys, phys_ok = to_float_safe(row.get("physical_progress"))
        if not phys_ok:
            row_warnings.append("Malformed physical_progress percentage.")
        elif phys is not None and (phys < 0.0 or phys > 100.0):
            row_warnings.append(f"Physical progress out of range [0, 100]: {phys}%.")
            
        fin, fin_ok = to_float_safe(row.get("financial_progress"))
        if not fin_ok:
            row_warnings.append("Malformed financial_progress percentage.")
        elif fin is not None and (fin < 0.0 or fin > 100.0):
            row_warnings.append(f"Financial progress out of range [0, 100]: {fin}%.")
            
        # 4. Coordinate validation (India bounding box)
        lat_f, lat_ok = to_float_safe(row.get("latitude"))
        lon_f, lon_ok = to_float_safe(row.get("longitude"))
        
        if not lat_ok or not lon_ok:
            row_warnings.append("Malformed coordinate numerical values.")
            invalid_coord_count += 1
        elif lat_f is None or lon_f is None:
            row_warnings.append("Missing geospatial coordinates.")
        elif not (INDIA_LAT_MIN <= lat_f <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon_f <= INDIA_LON_MAX):
            row_warnings.append(f"Coordinates ({lat_f:.4f}, {lon_f:.4f}) fall outside India boundaries.")
            invalid_coord_count += 1
            
        # 5. Temporal chronology & date consistency
        d_rec = parse_date_safe(row.get("recommendation_date"))
        d_sanc = parse_date_safe(row.get("sanction_date"))
        d_start = parse_date_safe(row.get("start_date"))
        d_exp = parse_date_safe(row.get("expected_completion_date"))
        d_act = parse_date_safe(row.get("actual_completion_date"))
        d_upd = parse_date_safe(row.get("last_update_date"))
        
        if d_rec and d_sanc and d_sanc < d_rec:
            row_warnings.append(f"Sanction date ({d_sanc.strftime('%Y-%m-%d')}) precedes recommendation date ({d_rec.strftime('%Y-%m-%d')}).")
            date_logic_error_count += 1
            
        if d_sanc and d_start and d_start < d_sanc:
            row_warnings.append(f"Start date ({d_start.strftime('%Y-%m-%d')}) precedes sanction date ({d_sanc.strftime('%Y-%m-%d')}).")
            date_logic_error_count += 1
            
        if d_start and d_exp and d_exp < d_start:
            row_warnings.append(f"Expected completion ({d_exp.strftime('%Y-%m-%d')}) precedes project start date ({d_start.strftime('%Y-%m-%d')}).")
            date_logic_error_count += 1
            
        if d_start and d_act and d_act < d_start:
            row_warnings.append(f"Actual completion ({d_act.strftime('%Y-%m-%d')}) precedes project start date ({d_start.strftime('%Y-%m-%d')}).")
            date_logic_error_count += 1
            
        if d_start and d_upd and d_upd < d_start:
            row_warnings.append(f"Progress update ({d_upd.strftime('%Y-%m-%d')}) precedes project start date ({d_start.strftime('%Y-%m-%d')}).")
            date_logic_error_count += 1
            
        # 6. Status consistency
        status = str(row.get("status", "")).strip().upper()
        if status == "COMPLETED":
            if not d_act and not row.get("completion_certificate"):
                row_warnings.append("Project marked COMPLETED without recorded actual completion date or completion certificate.")
                status_mismatch_count += 1
        elif status in ("IN_PROGRESS", "ONGOING"):
            if d_act:
                row_warnings.append("Active ongoing project has premature actual completion date recorded.")
                status_mismatch_count += 1
                
        try:
            if float(row.get("physical_progress", 0)) >= 100.0 and status != "COMPLETED":
                row_warnings.append("Physical progress is 100% but status is not marked COMPLETED.")
        except (ValueError, TypeError):
            pass
            
        warnings_per_row.append(row_warnings)
        
    validated_df["data_quality_warnings"] = warnings_per_row
    validated_df["has_data_quality_issues"] = [len(w) > 0 for w in warnings_per_row]
    
    total_records = len(validated_df)
    records_with_warnings = sum(1 for w in warnings_per_row if len(w) > 0)
    
    summary = {
        "total_records_checked": total_records,
        "clean_records_count": total_records - records_with_warnings,
        "records_with_warnings": records_with_warnings,
        "invalid_coordinates_count": invalid_coord_count,
        "negative_amounts_count": negative_amt_count,
        "chronology_inconsistencies": date_logic_error_count,
        "status_mismatches": status_mismatch_count
    }
    
    return validated_df, summary
