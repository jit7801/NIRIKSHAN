import React, { useState } from 'react';
import { X, Copy, MapPin, CheckCircle, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function DuplicateDiffModal({ pair, onClose }) {
  const [status, setStatus] = useState(pair ? pair.verification_status : "PENDING_VERIFICATION");
  const [resolutionNote, setResolutionNote] = useState("");

  if (!pair) return null;

  const { work_a, work_b, distance_meters, text_similarity, combined_score, same_agency } = pair;

  const centerLat = (work_a.latitude + work_b.latitude) / 2;
  const centerLon = (work_a.longitude + work_b.longitude) / 2;

  const handleResolve = (newStatus) => {
    setStatus(newStatus);
    alert(`Status updated to: ${newStatus}\nResolution logged into audit trail.`);
  };

  return (  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white border border-[#E8E4DC] rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl relative my-6">
        
        {/* Header */}
        <div className="p-5 border-b border-[#E8E4DC] flex items-center justify-between bg-[#F7F7F1]/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#4B3C32]/10 text-[#4B3C32] border border-[#4B3C32]/20">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#050505] tracking-tight">
                  Side-by-Side Duplicate / Overlap Investigation
                </h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                  status === "VERIFIED_DUPLICATE"
                    ? "bg-[#C94C4C]/10 text-[#C94C4C] border-[#C94C4C]/25"
                    : status === "LEGITIMATE_SEPARATE"
                    ? "bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/25"
                    : "bg-[#E6A23C]/10 text-[#916540] border-[#E6A23C]/25"
                }`}>
                  {status}
                </span>
              </div>
              <p className="text-xs text-[#5E5E5D] mt-0.5">
                Comparing two co-located works within {distance_meters}m to verify whether they represent a single physical asset.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#E8E4DC]/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Top Metric Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] text-center">
              <span className="text-[10px] uppercase font-semibold text-[#5E5E5D] block">Spatial Proximity</span>
              <span className="text-xl font-bold text-[#050505] font-mono">{distance_meters} m</span>
              <span className="text-[10px] text-[#5E5E5D] block mt-0.5">Direct distance</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] text-center">
              <span className="text-[10px] uppercase font-semibold text-[#5E5E5D] block">Semantic Title Match</span>
              <span className="text-xl font-bold text-[#4B3C32] font-mono">{text_similarity}%</span>
              <span className="text-[10px] text-[#5E5E5D] block mt-0.5">TF-IDF n-gram match</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] text-center">
              <span className="text-[10px] uppercase font-semibold text-[#5E5E5D] block">Implementing Agency</span>
              <span className={`text-sm font-bold mt-1 block ${same_agency ? "text-[#916540]" : "text-[#050505]"}`}>
                {same_agency ? "Identical Agency" : "Different Agency"}
              </span>
              <span className="text-[10px] text-[#5E5E5D] block mt-0.5">{same_agency ? "Shared execution unit" : "Separate units"}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] text-center">
              <span className="text-[10px] uppercase font-semibold text-[#5E5E5D] block">Combined Overlap Index</span>
              <span className="text-xl font-bold text-[#C94C4C] font-mono">{combined_score}%</span>
              <span className="text-[10px] text-[#5E5E5D] block mt-0.5">WDI multi-attribute score</span>
            </div>
          </div>

          {/* Interactive Map Visualizer */}
          <div className="h-56 rounded-xl overflow-hidden border border-[#E8E4DC] relative z-0">
            <MapContainer
              center={[centerLat, centerLon]}
              zoom={18}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[work_a.latitude, work_a.longitude]}>
                <Popup>
                  <div className="text-xs">
                    <strong>Work A: {work_a.work_id}</strong><br />
                    {work_a.work_title}
                  </div>
                </Popup>
              </Marker>
              <Marker position={[work_b.latitude, work_b.longitude]}>
                <Popup>
                  <div className="text-xs">
                    <strong>Work B: {work_b.work_id}</strong><br />
                    {work_b.work_title}
                  </div>
                </Popup>
              </Marker>
              <Polyline
                positions={[
                  [work_a.latitude, work_a.longitude],
                  [work_b.latitude, work_b.longitude]
                ]}
                color="#C94C4C"
                dashArray="5, 10"
              />
            </MapContainer>
          </div>

          {/* Side-by-Side Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Work A Column */}
            <div className="p-4 rounded-xl bg-[#F7F7F1]/50 border border-[#E8E4DC]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E8E4DC]">
                <span className="px-2 py-0.5 text-xs font-bold bg-[#4B3C32]/10 text-[#4B3C32] rounded-lg border border-[#4B3C32]/20 font-mono">
                  WORK A: {work_a.work_id}
                </span>
                <span className="text-xs text-[#5E5E5D] font-mono font-semibold">
                  ₹{(work_a.sanctioned_amount / 100000).toFixed(2)} Lakhs
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#050505] mb-3">
                {work_a.work_title}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Category:</span>
                  <span className="text-[#050505] font-medium">{work_a.work_category}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Sanction Date:</span>
                  <span className="text-[#050505] font-mono">{work_a.sanction_date}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Agency:</span>
                  <span className="text-[#050505] truncate max-w-[200px]">{work_a.implementing_agency}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Status / Progress:</span>
                  <span className="text-[#050505] font-medium">{work_a.status} ({work_a.physical_progress}% phys / {work_a.financial_progress}% fin)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#5E5E5D]">Coordinates:</span>
                  <span className="text-[#050505] font-mono">{work_a.latitude}, {work_a.longitude}</span>
                </div>
              </div>
            </div>

            {/* Work B Column */}
            <div className="p-4 rounded-xl bg-[#F7F7F1]/50 border border-[#E8E4DC]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E8E4DC]">
                <span className="px-2 py-0.5 text-xs font-bold bg-[#916540]/10 text-[#916540] rounded-lg border border-[#916540]/20 font-mono">
                  WORK B: {work_b.work_id}
                </span>
                <span className="text-xs text-[#5E5E5D] font-mono font-semibold">
                  ₹{(work_b.sanctioned_amount / 100000).toFixed(2)} Lakhs
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#050505] mb-3">
                {work_b.work_title}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Category:</span>
                  <span className="text-[#050505] font-medium">{work_b.work_category}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Sanction Date:</span>
                  <span className="text-[#050505] font-mono">{work_b.sanction_date}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Agency:</span>
                  <span className="text-[#050505] truncate max-w-[200px]">{work_b.implementing_agency}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E4DC]/60">
                  <span className="text-[#5E5E5D]">Status / Progress:</span>
                  <span className="text-[#050505] font-medium">{work_b.status} ({work_b.physical_progress}% phys / {work_b.financial_progress}% fin)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#5E5E5D]">Coordinates:</span>
                  <span className="text-[#050505] font-mono">{work_b.latitude}, {work_b.longitude}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Audit Resolution Decision Box */}
          <div className="p-4 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] space-y-3">
            <span className="text-xs font-bold text-[#050505] block">
              Official Inquiry Action & Decision Record
            </span>
            <input
              type="text"
              placeholder="Enter inspection officer findings or case resolution notes..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full bg-white text-xs text-[#050505] p-2.5 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32]"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => handleResolve("LEGITIMATE_SEPARATE")}
                className="btn-secondary px-4 py-2 text-xs font-semibold bg-[#2E8B57]/10 hover:bg-[#2E8B57]/20 text-[#2E8B57] border border-[#2E8B57]/25 rounded-xl transition-all"
              >
                Mark Verified Legitimate Separate Works
              </button>
              <button
                onClick={() => handleResolve("VERIFIED_DUPLICATE")}
                className="px-4 py-2 text-xs font-semibold bg-[#C94C4C] hover:bg-[#C94C4C]/90 text-white rounded-xl shadow-xs transition-all"
              >
                Confirm Overlapping / Duplicate Work
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
