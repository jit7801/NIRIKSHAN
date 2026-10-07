from datetime import datetime
from typing import Dict, Any, Optional
import pandas as pd
from app.core.config import settings

def parse_date(date_val: Any) -> Optional[datetime]:
    if not date_val or pd.isna(date_val):
        return None
    s = str(date_val).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None

def compute_delay_and_stagnation(df: pd.DataFrame, eval_date_str: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
    """
    Evaluates milestone progress drift, dormancy clocks, and progress disparity
    (financial expenditure outpacing verified physical completion).
    Uses centralized evaluation date and configurable threshold parameters.
    """
    results = {}
    
    # 1. Centralized Evaluation Date
    target_date_str = eval_date_str or settings.EVALUATION_DATE
    try:
        eval_date = datetime.strptime(target_date_str, "%Y-%m-%d")
    except Exception:
        eval_date = datetime.strptime("2024-09-15", "%Y-%m-%d")
        
    gap_crit = settings.PROGRESS_GAP_CRITICAL
    gap_warn = settings.PROGRESS_GAP_WARNING
    dorm_crit = settings.DORMANCY_CRITICAL_DAYS
    dorm_warn = settings.DORMANCY_WARNING_DAYS
    over_crit = settings.OVERDUE_CRITICAL_DAYS
    over_warn = settings.OVERDUE_WARNING_DAYS
    
    for _, row in df.iterrows():
        w_id = str(row["work_id"]).strip()
        status = str(row.get("status", "IN_PROGRESS")).strip().upper()
        
        try:
            phys_prog = float(row.get("physical_progress", 0.0))
        except (ValueError, TypeError):
            phys_prog = 0.0
            
        try:
            fin_prog = float(row.get("financial_progress", 0.0))
        except (ValueError, TypeError):
            fin_prog = 0.0
            
        # Physical vs Financial Progress Gap
        progress_gap = round(fin_prog - phys_prog, 2)
        
        # Calculate Dormancy (Inactivity Days)
        last_update_date = parse_date(row.get("last_update_date"))
        days_dormant = 0
        if last_update_date and status != "COMPLETED":
            days_dormant = max(0, (eval_date - last_update_date).days)
            
        # Calculate Overdue (Scheduled Target Delay)
        exp_comp_date = parse_date(row.get("expected_completion_date"))
        days_overdue = 0
        if exp_comp_date and status != "COMPLETED":
            days_overdue = max(0, (eval_date - exp_comp_date).days)
            
        score = 0
        reasons = []
        is_stagnant = False
        
        # Factor 1: Financial vs Physical Mismatch (Max 14 pts)
        if progress_gap >= gap_crit:
            score += 14
            is_stagnant = True
            reasons.append(
                f"Financial disbursement ({fin_prog:.1f}%) is {progress_gap:.1f} percentage points ahead of verified physical completion ({phys_prog:.1f}%)."
            )
        elif progress_gap >= gap_warn:
            score += 9
            reasons.append(
                f"Moderate progress divergence: financial expenditure ({fin_prog:.1f}%) outpaces physical progress ({phys_prog:.1f}%) by {progress_gap:.1f}%."
            )
        elif progress_gap >= 8.0:
            score += 4
            reasons.append(
                f"Minor progress variance ({progress_gap:.1f}% gap between expenditure and physical completion)."
            )
        else:
            if status == "COMPLETED":
                reasons.append("Milestone progress fully verified and project marked completed.")
            else:
                reasons.append("Financial drawdown tracks proportionally with reported physical work.")
                
        # Factor 2: Inactivity / Dormancy Clock (Max 8 pts)
        if days_dormant >= dorm_crit and status != "COMPLETED":
            score += 8
            is_stagnant = True
            reasons.append(f"Project dormant with no milestone inspection recorded for {days_dormant} days (threshold: {dorm_crit}d).")
        elif days_dormant >= dorm_warn and status != "COMPLETED":
            score += 4
            reasons.append(f"No milestone updates recorded for {days_dormant} days.")
            
        # Factor 3: Schedule Deadline Overrun (Max 8 pts)
        if days_overdue >= over_crit and status != "COMPLETED":
            score += 8
            reasons.append(f"Scheduled target completion deadline exceeded by {days_overdue} days (threshold: {over_crit}d).")
        elif days_overdue >= over_warn and status != "COMPLETED":
            score += 4
            reasons.append(f"Project is currently {days_overdue} days behind scheduled completion deadline.")
            
        final_score = min(score, 30)
        
        results[w_id] = {
            "delay_risk_score": final_score,
            "max_score": 30,
            "physical_progress": phys_prog,
            "financial_progress": fin_prog,
            "progress_gap": progress_gap,
            "days_dormant": days_dormant,
            "days_overdue": days_overdue,
            "is_stagnant": is_stagnant,
            "evaluation_date": target_date_str,
            "explanation": " ".join(reasons)
        }
        
    return results
