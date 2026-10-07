import React from 'react';
import { Copy, MapPin, ArrowRight, ShieldAlert, CheckCircle2, Eye } from 'lucide-react';

export default function DuplicateInspectorView({ pairs, onSelectPair }) {
  return (
    <div className="gov-card p-5 border border-[#E8E4DC]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#050505] tracking-tight">
              Candidate Duplicate & Overlapping Asset Inspector
            </h3>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-[#4B3C32]/10 text-[#4B3C32] border border-[#4B3C32]/20 rounded-full">
              {pairs.length} Detected Pairs
            </span>
          </div>
          <p className="text-xs text-[#5E5E5D] mt-0.5">
            Projects within 150m spatial bubble exhibiting high semantic title similarity and agency overlap.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pairs.map((pair) => {
          const { work_a, work_b, distance_meters, text_similarity, combined_score, same_agency } = pair;
          return (
            <div
              key={pair.pair_id}
              onClick={() => onSelectPair(pair)}
              className="p-4 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] hover:border-[#4B3C32]/40 hover:bg-[#FFFFFF] transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[#4B3C32]/10 text-[#4B3C32] rounded-lg border border-[#4B3C32]/20">
                  Distance: {distance_meters}m
                </span>
                <span className="text-xs font-bold text-[#C94C4C] font-mono">
                  Overlap Index: {combined_score}%
                </span>
              </div>

              {/* Work A vs Work B comparison cards */}
              <div className="space-y-2 mt-3 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-[#E8E4DC]">
                  <div className="flex justify-between text-[10px] text-[#5E5E5D] font-mono mb-0.5">
                    <span>{work_a.work_id}</span>
                    <span className="font-semibold text-[#050505]">₹{(work_a.sanctioned_amount / 100000).toFixed(2)}L</span>
                  </div>
                  <p className="font-semibold text-[#050505] truncate">{work_a.work_title}</p>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-[#E8E4DC]">
                  <div className="flex justify-between text-[10px] text-[#5E5E5D] font-mono mb-0.5">
                    <span>{work_b.work_id}</span>
                    <span className="font-semibold text-[#050505]">₹{(work_b.sanctioned_amount / 100000).toFixed(2)}L</span>
                  </div>
                  <p className="font-semibold text-[#050505] truncate">{work_b.work_title}</p>
                </div>
              </div>

              {/* Meta tags */}
              <div className="flex items-center justify-between text-[11px] text-[#5E5E5D] mt-3 pt-2 border-t border-[#E8E4DC]">
                <span className="truncate">
                  {same_agency ? "Same Agency: " + work_a.implementing_agency : "Different Agencies"}
                </span>
                <span className="flex items-center gap-1 text-[#4B3C32] font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>Inspect Diff</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
