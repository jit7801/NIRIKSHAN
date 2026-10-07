# Architecture Decision Records & Engineering Log (`decisions.md`)
## Project: Explainable Risk Intelligence Layer for MPLADS

This document tracks all foundational, architectural, algorithmic, operational, and UX design decisions made during the conception and implementation of the project.

---

### Record 1: Non-Accusatory Terminology & Administrative Due Process
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Under Indian administrative law and public financial rules (GFR 2017), an automated system cannot legally declare an individual or agency guilty of "fraud" or "corruption" without due process, an audit committee, and an inquiry.
* **Decision**: 
  - Strictly prohibit words like "fraudster", "guilty", or "proven fraud" in automated system outputs.
  - Adopt official decision-support terminology:
    - *Risk Signal*
    - *Potential Irregularity*
    - *Cost Anomaly*
    - *Progress Mismatch Alert*
    - *Candidate Overlap Requiring Verification*
    - *Requires Field Inspection*
* **Consequence**: The system serves as an objective, audit-ready tool that assists District Collectors and Nodal Officers without creating legal liabilities.

---

### Record 2: Algorithmic Peer Grouping for Cost Baselines
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Comparing cost across diverse infrastructure categories (e.g. ₹40L for a hospital wing vs ₹40L for a tube well) causes extreme false positives.
* **Decision**: 
  - Partition works into fine-grained cohorts: $\text{Category} \times \text{District}$.
  - Fall back to $\text{Category} \times \text{State}$ if sample size $N < 5$, then national $\text{Category}$, and finally `INSUFFICIENT_PEER_DATA` if still $< 5$.
  - Use **Modified Z-Scores** with **Median Absolute Deviation (MAD)** instead of standard standard deviation, handling zero-MAD conditions gracefully.
  - Layer an unsupervised **Isolation Forest** to flag multi-dimensional rate abnormalities (e.g., cost per progress unit) as a transparent secondary analytical signal.
* **Consequence**: Minimizes false alerts and guarantees that road projects are only judged against comparable local road projects.

---

### Record 3: Two-Stage Geospatial Duplicate Filtering with BallTree Indexing
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: All-pairs comparison across thousands of works ($O(N^2)$) induces severe latency and computational bottlenecks.
* **Decision**: 
  - **Stage 1 (Spatial Indexing)**: Use Scikit-learn `BallTree(metric='haversine')` to prune candidate pairs in $O(N \log N)$ time based on geographic coordinates within `SPATIAL_RADIUS_METERS` (default 150m).
  - **Stage 2 (NLP & Metadata Match)**: Run sub-word character n-gram $(3, 5)$ TF-IDF cosine similarity exclusively on the pruned spatial candidates, corroborated with category, implementing agency, and budget ratio.
  - **Governance Label**: Designate matches strictly as **`POSSIBLE DUPLICATE / OVERLAP — VERIFY`**.
* **Consequence**: Scales candidate generation logarithmically, eliminates unnecessary string comparisons, and adheres to administrative verification standards.

---

### Record 4: Unsupervised Anomaly Detection over Supervised Deep Learning
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: There is no publicly available, verified, labeled dataset of "fraudulent MPLADS works".
* **Decision**: 
  - Do NOT attempt to train supervised classification models (e.g. deep neural nets or XGBoost with unverified artificial labels), which overfit and hallucinate.
  - Do NOT use opaque deep learning models or generative LLMs for risk scoring.
  - Use unsupervised anomaly detection (Modified Z-score, MAD, Isolation Forest, S-curve progress divergence, spatial TF-IDF matching).
* **Consequence**: 100% deterministic, mathematically explainable scores that an auditor can easily verify and cross-examine.

---

### Record 5: Pre-Computed In-Memory Cache with Isolated Repository Abstraction
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Microsecond response times are required during high-stakes SIH live demonstrations across 520 works and 543 Lok Sabha MP records.
* **Decision**: 
  - Load and run the analytical pipeline once during application startup in FastAPI's `lifespan` handler.
  - Store results in an in-memory dictionary cache (`_DATA_CACHE`) for $O(1)$ query retrieval.
  - Isolate data access logic from business logic to support a seamless drop-in transition to PostgreSQL / PostGIS in production.
* **Consequence**: Pre-computing analytical pipelines into memory eliminates redundant runtime recalculations for all standard queries during high-concurrency demonstrations.

---

### Record 6: Centralized Evaluation Date & Temporal Anchoring
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Hard-coding dates in individual engine methods causes temporal skew across different analytical runs.
* **Decision**:
  - Centralize `EVALUATION_DATE` in `Settings` with environment variable override (`MPLADS_EVALUATION_DATE`).
  - Support `"today"` / `"now"` for live production, and fixed historical dates for reproducible benchmark tests and hackathon demonstrations.
* **Consequence**: Consistent calculation of dormancy and overdue clocks across all services and tests.

---

### Record 7: Data Ingestion Validation Layer
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Raw public works data often contains corrupted coordinates, negative budget entries, or reversed milestone dates.
* **Decision**:
  - Introduce `data_validator.py` executing prior to risk scoring.
  - Validates work ID uniqueness, positive financial amounts, India geographic coordinates ($8.0^\circ\text{N} \le \text{lat} \le 37.5^\circ\text{N}$, $68.0^\circ\text{E} \le \text{lon} \le 97.5^\circ\text{E}$), chronological milestone sequences, and status consistency.
  - Attaches `data_quality_warnings` to each record without destructive modification of source records.
* **Consequence**: Corrupted or edge-case records are surfaced transparently to auditors rather than failing silently or causing crashes.

---

### Record 8: Disaggregated Statutory Compliance Signals
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Merged compliance scores obscure which exact certificates are missing.
* **Decision**:
  - Separate compliance into discrete boolean indicators: `missing_completion_certificate`, `missing_utilization_certificate`, `missing_audit_certificate`, `missing_photo`, and `missing_asset_register`.
  - Cap compliance risk score at 15 points.
* **Consequence**: Direct, actionable statutory citations that field officers can immediately fulfill.

---

### Record 9: Strict Policy Weight Validation ($\sum = 100$)
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Unconstrained slider inputs can produce arbitrary risk score totals exceeding 100.
* **Decision**:
  - Implement Pydantic `model_validator` enforcing $\sum \text{weights} = 100.0$.
  - Reject invalid configurations with HTTP 422 Unprocessable Entity.
  - Provide auto-normalization utility in frontend settings modal.
* **Consequence**: Mathematically guarantees that Unified Risk Scores remain strictly normalized between 0 and 100.

---

### Record 10: Advisory Action Recommendations
* **Date**: September 2026
* **Status**: ACCEPTED
* **Context**: Automated systems instructing punitive measures (e.g. "Freeze funds") violate statutory administrative guidelines.
* **Decision**:
  - Reframe all action directives as advisory recommendations: *"Review fund-release eligibility according to applicable rules and pending documentation."*
  - Include explicit administrative authority disclaimers on every dossier.
* **Consequence**: High ethical alignment, compliance with government norms, and protection against premature administrative overreach.
