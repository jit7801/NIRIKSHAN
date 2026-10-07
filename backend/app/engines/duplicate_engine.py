import math
import re
from typing import Dict, Any, Tuple, List
import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.core.config import settings

ABBREVIATION_MAP = {
    r"\bcc\b": "cement concrete",
    r"\bc\.c\.\b": "cement concrete",
    r"\bbt\b": "bituminous tar",
    r"\bro\b": "reverse osmosis water",
    r"\bups\b": "upper primary school",
    r"\bghs\b": "government high school",
    r"\brd\b": "road",
    r"\bln\b": "lane",
    r"\bw\b": "ward",
    r"\bwd\b": "ward",
    r"\bno\b": "number"
}

def normalize_title(text: Any) -> str:
    """Normalizes text, strips punctuation, and expands common Indian public works abbreviations."""
    if not text or not isinstance(text, str):
        return ""
    text_clean = text.lower()
    for pattern, replacement in ABBREVIATION_MAP.items():
        text_clean = re.sub(pattern, replacement, text_clean)
    text_clean = re.sub(r"[^\w\s]", " ", text_clean)
    return " ".join(text_clean.split())

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two geographic coordinates in metres."""
    if any(coord is None or np.isnan(coord) for coord in (lat1, lon1, lat2, lon2)):
        return 999999.0
    R = 6371000.0  # Earth's radius in metres
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def clean_record_for_json(d: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures NaN / inf values in dictionary records are converted to None for JSON compliance."""
    clean = {}
    for k, v in d.items():
        if isinstance(v, (int, bool, str)):
            clean[k] = v
        elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            clean[k] = None
        elif isinstance(v, (list, tuple, dict)):
            clean[k] = v
        elif v is None:
            clean[k] = None
        else:
            try:
                if pd.isna(v):
                    clean[k] = None
                else:
                    clean[k] = v
            except Exception:
                clean[k] = v
    return clean

def compute_duplicates_and_overlaps(
    df: pd.DataFrame,
    max_dist_meters: float = None
) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Two-stage scalable duplicate and overlapping asset detection:
    1. Spatial Indexing: Uses BallTree with Haversine metric in O(N log N) to generate candidate pairs within max_dist_meters.
    2. Multi-Attribute Verification: Computes sub-word char-ngram TF-IDF text similarity, category, agency, and budget match.
    
    Governance Rule: Always labels matches as 'POSSIBLE DUPLICATE / OVERLAP — VERIFY'. Never outputs 'FRAUD CONFIRMED'.
    """
    radius_m = max_dist_meters or settings.SPATIAL_RADIUS_METERS
    per_work: Dict[str, Dict[str, Any]] = {}
    candidate_pairs: List[Dict[str, Any]] = []
    
    # Initialize default state for all works
    for _, row in df.iterrows():
        w_id = str(row["work_id"]).strip()
        per_work[w_id] = {
            "duplicate_risk_score": 0,
            "max_score": 25,
            "has_candidate": False,
            "paired_work_id": None,
            "paired_title": None,
            "distance_meters": None,
            "text_similarity": 0.0,
            "combined_score": 0.0,
            "verification_status": "NO_OVERLAP_DETECTED",
            "explanation": "No overlapping or duplicate candidate works detected in immediate vicinity."
        }
        
    records = [clean_record_for_json(r) for r in df.to_dict("records")]
    n = len(records)
    if n < 2:
        return per_work, candidate_pairs
        
    # Extract coordinates and identify valid spatial records
    valid_indices = []
    coords_rad = []
    earth_r = 6371000.0
    
    for idx, r in enumerate(records):
        try:
            lat = float(r.get("latitude"))
            lon = float(r.get("longitude"))
            if not np.isnan(lat) and not np.isnan(lon) and -90 <= lat <= 90 and -180 <= lon <= 180:
                valid_indices.append(idx)
                coords_rad.append([math.radians(lat), math.radians(lon)])
        except (ValueError, TypeError):
            continue
            
    if len(valid_indices) < 2:
        return per_work, candidate_pairs
        
    # STAGE 1: Scalable Candidate Generation via BallTree O(N log N)
    coords_arr = np.array(coords_rad)
    radius_rad = radius_m / earth_r
    tree = BallTree(coords_arr, metric="haversine")
    neighbor_indices = tree.query_radius(coords_arr, r=radius_rad)
    
    # Find candidate pairs (i < j to avoid self-pairs and duplicates)
    spatial_candidate_pairs = []
    for i_local, n_list in enumerate(neighbor_indices):
        i_global = valid_indices[i_local]
        for j_local in n_list:
            if j_local > i_local:
                j_global = valid_indices[j_local]
                spatial_candidate_pairs.append((i_global, j_global))
                
    if not spatial_candidate_pairs:
        return per_work, candidate_pairs
        
    # STAGE 2: Multi-Attribute Matching & Sub-word TF-IDF Text Similarity
    # Pre-normalize titles for candidates
    candidate_global_indices = sorted(list(set([i for i, _ in spatial_candidate_pairs] + [j for _, j in spatial_candidate_pairs])))
    idx_to_pos = {g_idx: pos for pos, g_idx in enumerate(candidate_global_indices)}
    
    candidate_titles = [normalize_title(records[g_idx].get("work_title", "")) for g_idx in candidate_global_indices]
    
    # Character n-grams (3-5) handle transliteration variations in Indian administrative names
    tfidf = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1)
    try:
        tfidf_matrix = tfidf.fit_transform(candidate_titles)
    except Exception:
        tfidf_matrix = None
        
    w_text = settings.DUP_WEIGHT_TEXT
    w_geo = settings.DUP_WEIGHT_GEO
    w_cat = settings.DUP_WEIGHT_CAT
    w_agency = settings.DUP_WEIGHT_AGENCY
    w_cost = settings.DUP_WEIGHT_COST
    
    for i_global, j_global in spatial_candidate_pairs:
        r_a = records[i_global]
        r_b = records[j_global]
        id_a = str(r_a["work_id"]).strip()
        id_b = str(r_b["work_id"]).strip()
        
        lat_a, lon_a = float(r_a["latitude"]), float(r_a["longitude"])
        lat_b, lon_b = float(r_b["latitude"]), float(r_b["longitude"])
        cost_a = float(r_a.get("sanctioned_amount", 0.0))
        cost_b = float(r_b.get("sanctioned_amount", 0.0))
        
        dist_m = haversine_distance_meters(lat_a, lon_a, lat_b, lon_b)
        if dist_m > radius_m:
            continue
            
        # Geographic proximity score (1.0 at 0m, decaying to 0.0 at radius_m)
        s_geo = max(0.0, 1.0 - (dist_m / radius_m))
        
        # Text similarity score
        s_text = 0.0
        if tfidf_matrix is not None:
            pos_a = idx_to_pos[i_global]
            pos_b = idx_to_pos[j_global]
            s_text = float(cosine_similarity(tfidf_matrix[pos_a], tfidf_matrix[pos_b])[0, 0])
            
        # Category, Agency, and Cost similarity
        s_cat = 1.0 if str(r_a.get("work_category", "")).strip().lower() == str(r_b.get("work_category", "")).strip().lower() else 0.0
        s_agency = 1.0 if str(r_a.get("implementing_agency", "")).strip().lower() == str(r_b.get("implementing_agency", "")).strip().lower() else 0.0
        s_cost = min(cost_a, cost_b) / max(cost_a, cost_b) if max(cost_a, cost_b) > 0 else 1.0
        
        # Weighted Duplicate Index (WDI)
        wdi = (w_text * s_text) + (w_geo * s_geo) + (w_cat * s_cat) + (w_agency * s_agency) + (w_cost * s_cost)
        pair_score = min(25, round(wdi * 25.0))
        
        # Signal strength classification (Governance compliant)
        if wdi >= 0.80 or pair_score >= 20:
            signal_strength = "STRONG CANDIDATE"
        elif wdi >= 0.60 or pair_score >= 15:
            signal_strength = "MODERATE CANDIDATE"
        else:
            signal_strength = "WEAK CANDIDATE"
        
        pair_record = {
            "pair_id": f"{id_a}__{id_b}",
            "work_a": r_a,
            "work_b": r_b,
            "distance_meters": round(dist_m, 1),
            "text_similarity": round(s_text * 100.0, 1),
            "combined_score": round(wdi * 100.0, 1),
            "weighted_duplicate_index": round(wdi, 3),
            "duplicate_risk_score": pair_score,
            "signal_strength": signal_strength,
            "same_category": bool(s_cat == 1.0),
            "same_agency": bool(s_agency == 1.0),
            "cost_similarity": round(s_cost, 2),
            "verification_status": "POSSIBLE DUPLICATE / OVERLAP — VERIFY",
            "explanation": (
                f"Candidate overlap co-located {dist_m:.1f}m away (threshold: {radius_m:.0f}m) [{signal_strength}]. "
                f"Text scope similarity is {s_text * 100.0:.1f}%. "
                f"{'Identical implementing agency.' if s_agency else 'Assigned to different agencies.'}"
            )
        }
        candidate_pairs.append(pair_record)
        
        # Update per-work risk scores with highest candidate
        for cur_id, other_r, other_id in [(id_a, r_b, id_b), (id_b, r_a, id_a)]:
            if pair_score > per_work[cur_id]["duplicate_risk_score"]:
                per_work[cur_id] = {
                    "duplicate_risk_score": pair_score,
                    "max_score": 25,
                    "has_candidate": True,
                    "paired_work_id": other_id,
                    "paired_title": other_r.get("work_title"),
                    "distance_meters": round(dist_m, 1),
                    "text_similarity": round(s_text * 100.0, 1),
                    "combined_score": round(wdi * 100.0, 1),
                    "weighted_duplicate_index": round(wdi, 3),
                    "signal_strength": signal_strength,
                    "verification_status": "POSSIBLE DUPLICATE / OVERLAP — VERIFY",
                    "explanation": (
                        f"Potential co-located asset {dist_m:.1f}m from {other_id} ('{other_r.get('work_title')}') "
                        f"with {s_text * 100.0:.1f}% scope similarity [{signal_strength}]. Subject to physical site verification."
                    )
                }
                
    candidate_pairs.sort(key=lambda x: x["combined_score"], reverse=True)
    return per_work, candidate_pairs
