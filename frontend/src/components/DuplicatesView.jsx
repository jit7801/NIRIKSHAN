import React, { useState } from 'react';
import { 
  Copy, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldAlert, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Building2 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useToast } from './Toast';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function DuplicatesView({ pairs = [], onSelectWork }) {
  const { addToast } = useToast();
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [resolutionStatus, setResolutionStatus] = useState({});

  if (!pairs || pairs.length === 0) {
    return (
      <div className="gov-card p-12 text-center text-[#5E5E5D]">
        <Copy className="w-8 h-8 text-[#C8BFB3] mx-auto mb-2" />
        <div className="font-semibold text-sm text-[#050505]">No duplicate candidates detected</div>
        <p className="text-xs text-[#5E5E5D] mt-1 max-w-sm mx-auto">
          All projects evaluated within 150m spatial bubbles currently show distinct titles and independent physical assets.
        </p>
      </div>
    );
  }

  const activePair = pairs[selectedPairIndex] || pairs[0];
  if (!activePair || !activePair.work_a || !activePair.work_b) {
    return (
      <div className="gov-card p-12 text-center text-[#5E5E5D]">
        <Copy className="w-8 h-8 text-[#C8BFB3] mx-auto mb-2" />
        <div className="font-semibold text-sm text-[#050505]">No duplicate candidates detected</div>
        <p className="text-xs text-[#5E5E5D] mt-1 max-w-sm mx-auto">
          All projects evaluated within 150m spatial bubbles currently show distinct titles and independent physical assets.
        </p>
      </div>
    );
  }

  const { 
    work_a, 
    work_b, 
    distance_meters, 
    text_similarity, 
    combined_score, 
    same_agency, 
    same_category,
    pair_id
  } = activePair;

  const latA = Number(work_a?.latitude) || 26.9124;
  const lonA = Number(work_a?.longitude) || 75.7873;
  const latB = Number(work_b?.latitude) || latA;
  const lonB = Number(work_b?.longitude) || lonA;
  const centerLat = (latA + latB) / 2;
  const centerLon = (lonA + lonB) / 2;

  const currentStatus = resolutionStatus[pair_id] || activePair.verification_status || 'PENDING_VERIFICATION';

  const markStatus = (newStatus) => {
    setResolutionStatus((prev) => ({ ...prev, [pair_id]: newStatus }));
    if (newStatus === 'VERIFIED_DUPLICATE') {
      addToast(`Spot verification notice issued for Pair #${selectedPairIndex + 1}.`, 'warning');
    } else {
      addToast(`Pair #${selectedPairIndex + 1} marked as Legitimate Separate Assets.`, 'success');
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#050505] tracking-tight">
            Possible Duplicate & Overlapping Work Candidates
          </h2>
          <p className="text-xs text-[#5E5E5D]">
            Investigate co-located infrastructure works with high textual similarity to verify whether they represent a duplicate sanction.
          </p>
        </div>

        {/* Previous / Next Pair Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-[#5E5E5D]">
            Pair <strong className="text-[#050505]">{selectedPairIndex + 1}</strong> of <strong className="text-[#050505]">{pairs.length}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedPairIndex((i) => Math.max(0, i - 1))}
              disabled={selectedPairIndex === 0}
              className="btn-secondary p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous pair"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSelectedPairIndex((i) => Math.min(pairs.length - 1, i + 1))}
              disabled={selectedPairIndex === pairs.length - 1}
              className="btn-secondary p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next pair"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Candidate Pair Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {pairs.map((p, idx) => {
          const status = resolutionStatus[p.pair_id] || p.verification_status || 'PENDING_VERIFICATION';
          const isResolved = status !== 'PENDING_VERIFICATION';
          return (
            <button
              key={p.pair_id}
              onClick={() => setSelectedPairIndex(idx)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                selectedPairIndex === idx
                  ? 'bg-[#4B3C32] text-white border-[#4B3C32] shadow-xs'
                  : 'bg-white text-[#5E5E5D] border-[#E8E4DC] hover:bg-[#F7F7F1]'
              }`}
            >
              <span>Pair #{idx + 1}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                selectedPairIndex === idx ? 'bg-white/20 text-white' : 'bg-[#F7F7F1] text-[#5E5E5D]'
              }`}>
                {p.distance_meters}m · {p.text_similarity}%
              </span>
              {isResolved && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Comparison Dossier */}
      <div className="gov-card p-4 sm:p-6 space-y-5">
        
        {/* Verification Status Banner */}
        <div className="p-3 rounded-xl bg-[#E6A23C]/10 border border-[#E6A23C]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E6A23C] shrink-0" />
            <span className="text-xs font-semibold text-[#916540]">
              Possible Duplicate Sanction Candidate — Co-located within {distance_meters} meters
            </span>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border self-start sm:self-auto ${
            currentStatus === 'VERIFIED_DUPLICATE'
              ? 'bg-[#C94C4C]/10 text-[#C94C4C] border-[#C94C4C]/25'
              : currentStatus === 'LEGITIMATE_SEPARATE'
              ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/25'
              : 'bg-white text-[#5E5E5D] border-[#E8E4DC]'
          }`}>
            {currentStatus.replace('_', ' ')}
          </span>
        </div>

        {/* Side-by-Side Work Dossiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Work A */}
          <div className="p-4 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#4B3C32] uppercase tracking-wider text-[11px]">Primary Record (Work A)</span>
                <span className="font-mono text-[#5E5E5D] text-[10px]">{work_a.work_id}</span>
              </div>
              <h4 className="text-sm font-bold text-[#050505] leading-snug mb-2">
                {work_a.work_title}
              </h4>
              <div className="space-y-1.5 text-xs text-[#5E5E5D]">
                <div className="flex justify-between">
                  <span>Category:</span>
                  <strong className="text-[#050505]">{work_a.work_category}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Agency:</span>
                  <span className="text-[#050505] truncate max-w-[180px]">{work_a.implementing_agency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sanctioned:</span>
                  <strong className="text-[#050505]">₹{((work_a.sanctioned_amount || 0) / 100000).toFixed(2)}L</strong>
                </div>
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span className="font-semibold text-[#050505]">{work_a.physical_progress}% phys</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onSelectWork(work_a.work_id)}
              className="btn-secondary w-full py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1 mt-2"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Full Work A Dossier</span>
            </button>
          </div>

          {/* Work B */}
          <div className="p-4 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#916540] uppercase tracking-wider text-[11px]">Suspected Match (Work B)</span>
                <span className="font-mono text-[#5E5E5D] text-[10px]">{work_b.work_id}</span>
              </div>
              <h4 className="text-sm font-bold text-[#050505] leading-snug mb-2">
                {work_b.work_title}
              </h4>
              <div className="space-y-1.5 text-xs text-[#5E5E5D]">
                <div className="flex justify-between">
                  <span>Category:</span>
                  <strong className="text-[#050505]">{work_b.work_category}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Agency:</span>
                  <span className="text-[#050505] truncate max-w-[180px]">{work_b.implementing_agency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sanctioned:</span>
                  <strong className="text-[#050505]">₹{((work_b.sanctioned_amount || 0) / 100000).toFixed(2)}L</strong>
                </div>
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span className="font-semibold text-[#050505]">{work_b.physical_progress}% phys</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onSelectWork(work_b.work_id)}
              className="btn-secondary w-full py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1 mt-2"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Full Work B Dossier</span>
            </button>
          </div>

        </div>

        {/* Empirical Overlap Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-[#F7F7F1]/50 border border-[#E8E4DC] text-center">
            <span className="text-[10px] text-[#5E5E5D] block font-medium">Text Similarity</span>
            <strong className="text-sm text-[#050505] font-mono">{text_similarity}%</strong>
          </div>
          <div className="p-3 rounded-xl bg-[#F7F7F1]/50 border border-[#E8E4DC] text-center">
            <span className="text-[10px] text-[#5E5E5D] block font-medium">Spatial Distance</span>
            <strong className="text-sm text-[#050505] font-mono">{distance_meters} m</strong>
          </div>
          <div className="p-3 rounded-xl bg-[#F7F7F1]/50 border border-[#E8E4DC] text-center">
            <span className="text-[10px] text-[#5E5E5D] block font-medium">Implementing Agency</span>
            <strong className={`text-sm ${same_agency ? 'text-[#916540]' : 'text-[#5E5E5D]'}`}>
              {same_agency ? 'Identical' : 'Different'}
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-[#F7F7F1]/50 border border-[#E8E4DC] text-center">
            <span className="text-[10px] text-[#5E5E5D] block font-medium">Duplicate Index</span>
            <strong className="text-sm text-[#C94C4C] font-mono">{combined_score}%</strong>
          </div>
        </div>

        {/* Synchronized Spatial Map */}
        <div className="h-56 sm:h-64 rounded-xl overflow-hidden border border-[#E8E4DC] relative z-0">
          <MapContainer
            key={pair_id || selectedPairIndex}
            center={[centerLat, centerLon]}
            zoom={18}
            scrollWheelZoom={false}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[latA, lonA]}>
              <Popup>
                <div className="text-xs">
                  <strong>Work A: {work_a.work_id}</strong><br />
                  {work_a.work_title}
                </div>
              </Popup>
            </Marker>
            <Marker position={[latB, lonB]}>
              <Popup>
                <div className="text-xs">
                  <strong>Work B: {work_b.work_id}</strong><br />
                  {work_b.work_title}
                </div>
              </Popup>
            </Marker>
            <Polyline
              positions={[
                [latA, lonA],
                [latB, lonB]
              ]}
              color="#C94C4C"
              dashArray="4, 6"
            />
          </MapContainer>
        </div>

        {/* Verification Action Directives */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E8E4DC]">
          <span className="text-xs text-[#5E5E5D]">
            Administrative Determination for District Authority:
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => markStatus('LEGITIMATE_SEPARATE')}
              className={`btn-secondary text-xs py-1.5 px-3 rounded-xl ${
                currentStatus === 'LEGITIMATE_SEPARATE' ? 'bg-[#2E8B57]/10 border-[#2E8B57]/25 text-[#2E8B57] font-bold' : ''
              }`}
            >
              <Check className="w-3.5 h-3.5 inline mr-1" />
              Mark Legitimate Separate Asset
            </button>
            <button
              onClick={() => markStatus('VERIFIED_DUPLICATE')}
              className={`btn-primary text-xs py-1.5 px-3 rounded-xl ${
                currentStatus === 'VERIFIED_DUPLICATE' ? 'bg-[#C94C4C] hover:bg-[#C94C4C]/90 text-white' : ''
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
              Order Spot Verification
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
