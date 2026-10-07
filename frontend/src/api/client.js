const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function buildQuery(params = {}) {
  const clean = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "");
  return new URLSearchParams(clean).toString();
}

export async function fetchSummary(params = {}) {
  const query = buildQuery(params);
  const url = query ? `${API_BASE_URL}/summary?${query}` : `${API_BASE_URL}/summary`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch summary metrics");
  return res.json();
}

export async function fetchWorks(params = {}) {
  const query = buildQuery(params);
  const url = query ? `${API_BASE_URL}/works?${query}` : `${API_BASE_URL}/works`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch works queue");
  return res.json();
}

export async function fetchWorkExplanation(workId) {
  const res = await fetch(`${API_BASE_URL}/works/${encodeURIComponent(workId)}/explanation`);
  if (!res.ok) {
    let errorDetail = `Failed to fetch forensic dossier for ${workId} (${res.status})`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail?.message || errJson.detail || errorDetail;
    } catch {}
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchWorkById(workId) {
  const res = await fetch(`${API_BASE_URL}/works/${encodeURIComponent(workId)}`);
  if (!res.ok) {
    let errorDetail = `Failed to fetch work record for ${workId} (${res.status})`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail?.message || errJson.detail || errorDetail;
    } catch {}
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchDuplicateCandidates() {
  const res = await fetch(`${API_BASE_URL}/anomalies/duplicates`);
  if (!res.ok) throw new Error("Failed to fetch duplicate candidates");
  return res.json();
}

export async function recalculateRiskWeights(weights) {
  const res = await fetch(`${API_BASE_URL}/policy/recalculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(weights),
  });
  if (!res.ok) throw new Error("Failed to recalculate risk scores");
  return res.json();
}

export async function fetchMps(params = {}) {
  const query = buildQuery(params);
  const url = query ? `${API_BASE_URL}/mps?${query}` : `${API_BASE_URL}/mps`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch MP allocations");
  return res.json();
}

export async function fetchMpDetails(mpName) {
  const res = await fetch(`${API_BASE_URL}/mps/${encodeURIComponent(mpName)}`);
  if (!res.ok) throw new Error(`Failed to fetch details for MP ${mpName}`);
  return res.json();
}

export async function fetchStates() {
  const res = await fetch(`${API_BASE_URL}/states`);
  if (!res.ok) throw new Error("Failed to fetch state summaries");
  return res.json();
}

export async function submitFieldVerification(projectId, payload) {
  const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    let errorDetail = `Failed to submit field verification (${res.status})`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail?.message || errJson.detail || errorDetail;
    } catch {
      // fallback
    }
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchProjectVerifications(projectId) {
  const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/verifications`);
  if (!res.ok) throw new Error(`Failed to fetch verifications for ${projectId}`);
  return res.json();
}

export async function fetchOfflineProjectBundle(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}/projects/offline-bundle?${query}`);
  if (!res.ok) throw new Error("Failed to fetch offline project bundle");
  return res.json();
}

export async function fetchFilterOptions() {
  const res = await fetch(`${API_BASE_URL}/filters`);
  if (!res.ok) throw new Error("Failed to fetch filter options");
  return res.json();
}

export async function fetchMapLayers(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}/map/layers?${query}`);
  if (!res.ok) throw new Error("Failed to fetch map layers");
  return res.json();
}

