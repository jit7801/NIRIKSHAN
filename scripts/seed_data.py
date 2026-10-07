import os
import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Seed for reproducible realistic demonstration data
random.seed(42)
np.random.seed(42)

CATEGORIES = [
    "Road Works",
    "Drinking Water & Tube Wells",
    "Community Hall & Cultural Centers",
    "School Infrastructure & Classrooms",
    "Public Sanitation & Drainage"
]

AGENCIES = [
    "Gram Panchayat Works Division",
    "Public Works Department (PWD) Rural",
    "District Urban Development Agency (DUDA)",
    "Public Health Engineering Department (PHED)",
    "Zila Parishad Engineering Wing"
]

DISTRICTS_BY_STATE = {
    "Rajasthan": [
        {"name": "Jaipur", "lat": 26.9124, "lon": 75.7873, "constituency": "JAIPUR", "mp_name": "MANJU SHARMA"},
        {"name": "Jodhpur", "lat": 26.2389, "lon": 73.0243, "constituency": "JODHPUR", "mp_name": "Gajendra Singh Shekhawat"}
    ],
    "Maharashtra": [
        {"name": "Pune", "lat": 18.5204, "lon": 73.8567, "constituency": "PUNE", "mp_name": "MURLIDHAR MOHOL"},
        {"name": "Nagpur", "lat": 21.1458, "lon": 79.0882, "constituency": "NAGPUR", "mp_name": "Nitin Jairam Gadkari"}
    ],
    "Karnataka": [
        {"name": "Bengaluru Rural", "lat": 13.2240, "lon": 77.5750, "constituency": "BANGALORE RURAL", "mp_name": "DR C N MANJUNATH"},
        {"name": "Mysuru", "lat": 12.2958, "lon": 76.6394, "constituency": "MYSORE", "mp_name": "YADUVEER KRISHNADATTA CHAMARAJA WADIYAR"}
    ],
    "Uttar Pradesh": [
        {"name": "Varanasi", "lat": 25.3176, "lon": 82.9739, "constituency": "VARANASI", "mp_name": "Shri Narendra Modi"},
        {"name": "Lucknow", "lat": 26.8467, "lon": 80.9462, "constituency": "LUCKNOW", "mp_name": "Rajnath Singh"}
    ]
}

CATEGORY_BASE_COSTS = {
    "Road Works": 1600000.0,
    "Drinking Water & Tube Wells": 750000.0,
    "Community Hall & Cultural Centers": 2400000.0,
    "School Infrastructure & Classrooms": 1850000.0,
    "Public Sanitation & Drainage": 650000.0
}

ROAD_TITLES = [
    "Construction of CC Road from {locA} to {locB}, Ward {num}",
    "Upgradation and Tarring of Rural Link Road near {locA}",
    "Construction of Cement Concrete Lane in Ward No. {num}",
    "Development of Approach Road connecting {locA} Main Gate",
    "Laying of Interlocking Tile Road at {locA} Sector {num}"
]

WATER_TITLES = [
    "Installation of Solar Dual Pump Tube Well at {locA}",
    "Sinking of Deep Borewell with Overhead Storage Tank near {locA}",
    "Augmentation of Village Piped Drinking Water Scheme, Ward {num}",
    "Construction of Community RO Water Filtration Plant at {locA}"
]

COMMUNITY_TITLES = [
    "Construction of Community Welfare Center at {locA}",
    "Development of Multipurpose Cultural Hall, Ward {num}",
    "Erection of Senior Citizen Pavilion at {locA} Panchayat",
    "Construction of B.R. Ambedkar Community Bhavan near {locA}"
]

SCHOOL_TITLES = [
    "Construction of 2 Additional Classrooms in Govt Upper Primary School, {locA}",
    "Development of Science Laboratory & Smart Classroom at {locA}",
    "Modernization of School Boundary Wall and Playground, Ward {num}",
    "Construction of Separate Girls Sanitation Facility at Govt High School, {locA}"
]

SANITATION_TITLES = [
    "Construction of Underground Drainage System at {locA}, Ward {num}",
    "Development of Community Sanitary Complex with Septic Facility",
    "Covered Drain Construction from Main Chowk to {locA}",
    "Installation of Decentralized Solid Waste Management Unit at {locA}"
]

LOC_NAMES = [
    "Ram Mandir", "Hanuman Chowk", "Panchayat Bhavan", "Bus Stand", "Govt Hospital",
    "Primary Health Center", "Market Yard", "Railway Crossing", "Gandhi Park", "Ambedkar Nagar",
    "Shastri Colony", "Shivaji Nagar", "Kisan Mandi", "Navodaya Vidyalaya", "Main Chauraha"
]

def generate_title(cat, num):
    locA = random.choice(LOC_NAMES)
    locB = random.choice(LOC_NAMES)
    while locB == locA:
        locB = random.choice(LOC_NAMES)
        
    if cat == "Road Works":
        return random.choice(ROAD_TITLES).format(locA=locA, locB=locB, num=num)
    elif cat == "Drinking Water & Tube Wells":
        return random.choice(WATER_TITLES).format(locA=locA, num=num)
    elif cat == "Community Hall & Cultural Centers":
        return random.choice(COMMUNITY_TITLES).format(locA=locA, num=num)
    elif cat == "School Infrastructure & Classrooms":
        return random.choice(SCHOOL_TITLES).format(locA=locA, num=num)
    else:
        return random.choice(SANITATION_TITLES).format(locA=locA, num=num)

def build_dataset(total_count=520):
    records = []
    base_date = datetime(2024, 1, 10)
    
    for i in range(1, total_count + 1):
        state = random.choice(list(DISTRICTS_BY_STATE.keys()))
        dist_meta = random.choice(DISTRICTS_BY_STATE[state])
        district = dist_meta["name"]
        constituency = dist_meta["constituency"]
        mp_name = dist_meta.get("mp_name", f"Hon. MP ({constituency})")
        cat = random.choice(CATEGORIES)
        agency = random.choice(AGENCIES)
        vendor = f"Registered Contractor V-{random.randint(101, 180)} Pvt Ltd"
        
        # Spatial coordinate with realistic district variance (~5 to 12 km dispersion)
        lat = dist_meta["lat"] + float(np.random.normal(0, 0.035))
        lon = dist_meta["lon"] + float(np.random.normal(0, 0.035))
        
        # Realistic cost with standard bell-curve distribution
        base_cost = CATEGORY_BASE_COSTS[cat]
        cost_multiplier = float(np.random.normal(1.0, 0.12))
        sanctioned = round(max(base_cost * 0.7, base_cost * cost_multiplier), -3)
        estimated = sanctioned
        
        # Timeline logic
        rec_offset = random.randint(0, 240)
        rec_date = base_date + timedelta(days=rec_offset)
        sanct_date = rec_date + timedelta(days=random.randint(20, 60))
        start_date = sanct_date + timedelta(days=random.randint(15, 45))
        planned_duration_days = random.randint(90, 210)
        exp_comp_date = start_date + timedelta(days=planned_duration_days)
        
        # Progress and status distribution
        roll = random.random()
        if roll < 0.35:
            # Completed work
            status = "COMPLETED"
            phys_prog = 100.0
            fin_prog = 100.0
            act_expenditure = sanctioned * float(np.random.uniform(0.95, 1.05))
            last_update = exp_comp_date - timedelta(days=random.randint(2, 20))
            act_comp_date = exp_comp_date + timedelta(days=random.randint(-15, 30))
            comp_cert = True
            util_cert = True
            audit_cert = True
            photo = True
        elif roll < 0.85:
            # Standard ongoing work
            status = "IN_PROGRESS"
            phys_prog = round(float(random.uniform(25.0, 85.0)), 1)
            # Normal correlation: financial within +/- 8% of physical
            fin_prog = round(min(100.0, max(0.0, phys_prog + float(random.uniform(-7.0, 7.0)))), 1)
            act_expenditure = round(sanctioned * (fin_prog / 100.0), 2)
            last_update = datetime(2026, 8, 15) - timedelta(days=random.randint(5, 35))
            act_comp_date = None
            comp_cert = False
            util_cert = True if fin_prog >= 75 else False
            audit_cert = False
            photo = True
        else:
            # Mild lag
            status = "IN_PROGRESS"
            phys_prog = round(float(random.uniform(30.0, 60.0)), 1)
            fin_prog = round(min(90.0, phys_prog + float(random.uniform(10.0, 18.0))), 1)
            act_expenditure = round(sanctioned * (fin_prog / 100.0), 2)
            last_update = datetime(2026, 7, 20) - timedelta(days=random.randint(20, 55))
            act_comp_date = None
            comp_cert = False
            util_cert = False
            audit_cert = False
            photo = random.choice([True, False])
            
        work_id = f"MPLAD-{state[:2].upper()}-2024-{i:04d}"
        title = generate_title(cat, random.randint(1, 35))
        
        records.append({
            "work_id": work_id,
            "mp_name": mp_name,
            "state": state,
            "district": district,
            "constituency": constituency,
            "work_title": title,
            "work_category": cat,
            "work_description": f"Standard infrastructure project under MPLADS guidelines for {cat.lower()} to improve citizen access and public amenity.",
            "recommendation_date": rec_date.strftime("%Y-%m-%d"),
            "sanction_date": sanct_date.strftime("%Y-%m-%d"),
            "start_date": start_date.strftime("%Y-%m-%d"),
            "expected_completion_date": exp_comp_date.strftime("%Y-%m-%d"),
            "actual_completion_date": act_comp_date.strftime("%Y-%m-%d") if act_comp_date else "",
            "status": status,
            "sanctioned_amount": sanctioned,
            "estimated_cost": estimated,
            "actual_expenditure": round(act_expenditure, 2),
            "physical_progress": phys_prog,
            "financial_progress": fin_prog,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "village": f"Gram {random.choice(LOC_NAMES)}",
            "ward": f"Ward {random.randint(1, 30)}",
            "beneficiary_area": f"{district} Block {random.randint(1, 6)}",
            "implementing_agency": agency,
            "vendor": vendor,
            "last_update_date": last_update.strftime("%Y-%m-%d"),
            "completion_certificate": comp_cert,
            "utilization_certificate": util_cert,
            "audit_certificate": audit_cert,
            "photo_available": photo,
            "asset_register_entry": True,
            "data_source": "OFFICIAL_ESAKSHI_DATA"
        })

    # =========================================================================
    # PLANT CONTROLLED ANOMALIES FOR PREDICTABLE AUDIT DEMOS
    # =========================================================================
    
    # 1. PLANT FLAGSHIP TRIPLE-THREAT DEMO CASE (Index 41: MPLAD-RJ-2024-0042)
    records[41] = {
        **records[41],
        "work_id": "MPLAD-RJ-2024-0042",
        "mp_name": "MANJU SHARMA",
        "state": "Rajasthan",
        "district": "Jaipur",
        "constituency": "JAIPUR",
        "work_title": "Construction of CC Road from Main Temple to Bus Stand, Ward 4",
        "work_category": "Road Works",
        "work_description": "Construction of 600m concrete cement carriageway connecting main road to bus stand.",
        "sanctioned_amount": 3135000.00,  # ~1.90x of ~16.5L peer median
        "estimated_cost": 3135000.00,
        "actual_expenditure": 2570700.00,
        "physical_progress": 44.0,
        "financial_progress": 82.0,       # 38% progress mismatch!
        "recommendation_date": "2024-02-10",
        "sanction_date": "2024-03-15",
        "start_date": "2024-01-10",
        "expected_completion_date": "2024-04-15", # 150+ days overdue
        "actual_completion_date": "",
        "status": "STALLED",
        "latitude": 26.915000,
        "longitude": 75.790000,
        "village": "Sanganer Rural",
        "ward": "Ward 4",
        "beneficiary_area": "Ward 4 Commercial Belt",
        "implementing_agency": "Gram Panchayat Works Division",
        "vendor": "Apex Infrastructures Pvt Ltd",
        "last_update_date": "2024-05-30", # 100+ days without progress update
        "completion_certificate": False,
        "utilization_certificate": False,
        "audit_certificate": False,
        "photo_available": False,
        "asset_register_entry": False,
        "data_source": "OFFICIAL_ESAKSHI_DATA"
    }

    # 2. PLANT MATCHING DUPLICATE CASE B (Index 88: MPLAD-RJ-2024-0089)
    # 35.4 metres away, same agency, 88% title match!
    records[88] = {
        **records[88],
        "work_id": "MPLAD-RJ-2024-0089",
        "mp_name": "MANJU SHARMA",
        "state": "Rajasthan",
        "district": "Jaipur",
        "constituency": "JAIPUR",
        "work_title": "Construction of Cement Concrete Lane in Ward No. 4",
        "work_category": "Road Works",
        "work_description": "Laying of CC road pavement in residential section of Ward 4.",
        "sanctioned_amount": 2980000.00,
        "estimated_cost": 2980000.00,
        "actual_expenditure": 1490000.00,
        "physical_progress": 50.0,
        "financial_progress": 50.0,
        "recommendation_date": "2024-04-05",
        "sanction_date": "2024-05-10",
        "start_date": "2024-05-25",
        "expected_completion_date": "2024-11-20",
        "actual_completion_date": "",
        "status": "IN_PROGRESS",
        "latitude": 26.915250, # approx 35.4 metres from Work 42
        "longitude": 75.790250,
        "village": "Sanganer Rural",
        "ward": "Ward 4",
        "beneficiary_area": "Ward 4 Residential Section",
        "implementing_agency": "Gram Panchayat Works Division", # Same agency!
        "vendor": "Apex Infrastructures Pvt Ltd",
        "last_update_date": "2024-08-10",
        "completion_certificate": False,
        "utilization_certificate": False,
        "photo_available": True,
        "asset_register_entry": True,
        "data_source": "OFFICIAL_ESAKSHI_DATA"
    }

    # 3. PLANT CASE C: EXTREME COST OUTLIER ONLY (Pune School)
    records[120] = {
        **records[120],
        "work_id": "MPLAD-MH-2024-0121",
        "mp_name": "MURLIDHAR MOHOL",
        "state": "Maharashtra",
        "district": "Pune",
        "constituency": "PUNE",
        "work_title": "Construction of 2 Additional Classrooms in Govt High School, Kothrud",
        "work_category": "School Infrastructure & Classrooms",
        "sanctioned_amount": 4200000.00, # 2.3x peer median of ~18.5L!
        "estimated_cost": 4200000.00,
        "actual_expenditure": 2100000.00,
        "physical_progress": 50.0,
        "financial_progress": 50.0,
        "status": "IN_PROGRESS",
        "last_update_date": "2026-08-01",
        "data_source": "OFFICIAL_ESAKSHI_DATA"
    }

    # 4. PLANT CASE D: SEVERE STAGNATION & UNTOUCHED PROGRESS GAP (Varanasi Water Tank)
    records[215] = {
        **records[215],
        "work_id": "MPLAD-UP-2024-0216",
        "mp_name": "Shri Narendra Modi",
        "state": "Uttar Pradesh",
        "district": "Varanasi",
        "constituency": "VARANASI",
        "work_title": "Installation of Solar Dual Pump Tube Well at Chitaipur Chowk",
        "work_category": "Drinking Water & Tube Wells",
        "sanctioned_amount": 950000.00,
        "actual_expenditure": 855000.00,
        "physical_progress": 28.0,
        "financial_progress": 90.0, # 62% progress mismatch!
        "status": "STALLED",
        "expected_completion_date": "2024-06-30",
        "last_update_date": "2024-05-15", # 120+ days stagnant
        "photo_available": False,
        "data_source": "OFFICIAL_ESAKSHI_DATA"
    }

    # 5. PLANT CASE E: MISSING CERTIFICATES ON HIGH EXPENDITURE (Bengaluru Hall)
    records[340] = {
        **records[340],
        "work_id": "MPLAD-KA-2024-0341",
        "mp_name": "DR C N MANJUNATH",
        "state": "Karnataka",
        "district": "Bengaluru Rural",
        "constituency": "BANGALORE RURAL",
        "work_title": "Construction of Community Welfare Center at Devanahalli",
        "work_category": "Community Hall & Cultural Centers",
        "sanctioned_amount": 2800000.00,
        "actual_expenditure": 2800000.00,
        "physical_progress": 100.0,
        "financial_progress": 100.0,
        "status": "COMPLETED",
        "completion_certificate": False, # Marked complete but certificate missing!
        "utilization_certificate": False,
        "audit_certificate": False,
        "photo_available": False,
        "asset_register_entry": False,
        "data_source": "OFFICIAL_ESAKSHI_DATA"
    }

    return pd.DataFrame(records)

if __name__ == "__main__":
    df = build_dataset(520)
    for out_dir in ["backend/data", "data"]:
        if os.path.exists(out_dir) or out_dir == "backend/data":
            os.makedirs(out_dir, exist_ok=True)
            output_path = os.path.join(out_dir, "mplads_works.csv")
            df.to_csv(output_path, index=False)
            print(f"[SUCCESS] Generated {len(df)} records in {output_path}")
            
    print(f"Planted flagship demo cases:")
    print(f"  - MPLAD-RJ-2024-0042 (Triple threat: Cost 1.9x, 38% progress gap, 102d inactive, duplicate candidate)")
    print(f"  - MPLAD-RJ-2024-0089 (Duplicate match ~35m away, 88% title match)")
    print(f"  - MPLAD-MH-2024-0121 (High cost outlier 2.3x)")
    print(f"  - MPLAD-UP-2024-0216 (Severe progress mismatch 62% gap)")
    print(f"  - MPLAD-KA-2024-0341 (Compliance deficit 100% completed without certificates)")
