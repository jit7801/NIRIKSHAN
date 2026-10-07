import React from 'react';
import { ArrowRight, AlertTriangle, AlertCircle, FileSearch, Sparkles } from 'lucide-react';

export default function PriorityQueue({ works, onSelectWork }) {
  // Filter only high and critical risk works, sorted by score descending
  const priorityWorks = works
    .filter((w) => w.overall_risk_score >= 60)
    .slice(0, 10);

  const getRiskBadge = (score, level) => {
    if (level === "CRITICAL" || score >= 80) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-[#C94C4C]/10 text-[#C94C4C] border border-[#C94C4C]/25">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C94C4C] mr-1.5" />
          {score} • CRITICAL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-[#E6A23C]/10 text-[#916540] border border-[#E6A23C]/25">
        {score} • HIGH
      </span>
    );
  };

  const getPrimaryRiskBadge = (factor) => {
    const colorMap = {
      "Cost Anomaly": "text-[#916540] bg-[#916540]/10 border-[#916540]/25",
      "Delay & Stagnation": "text-[#AA896C] bg-[#AA896C]/10 border-[#AA896C]/25",
      "Duplicate Overlap": "text-[#4B3C32] bg-[#4B3C32]/10 border-[#4B3C32]/25",
      "Compliance Deficit": "text-[#C94C4C] bg-[#C94C4C]/10 border-[#C94C4C]/25",
    };
    const style = colorMap[factor] || "text-[#5E5E5D] bg-[#F7F7F1] border-[#E8E4DC]";
    return (
      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${style}`}>
        {factor}
      </span>
    );
  };

  return (
    <div className="gov-card p-5 mb-8 border border-[#E8E4DC]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#050505] tracking-tight">
              Today's High-Priority Verification Queue
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-[#C94C4C]/10 text-[#C94C4C] border border-[#C94C4C]/20 rounded-full">
              {priorityWorks.length} Flagged Works
            </span>
          </div>
          <p className="text-xs text-[#5E5E5D] mt-0.5">
            Ranked by multi-factor empirical risk score. Click any work to review forensic evidence and issue inquiry notices.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse gov-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Project Title & ID</th>
              <th>District / Category</th>
              <th>Risk Score</th>
              <th>Primary Risk Signal</th>
              <th>Key Evidence Summary</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {priorityWorks.map((work, idx) => (
              <tr
                key={work.work_id}
                onClick={() => onSelectWork(work.work_id)}
                className="hover:bg-[#F7F7F1]/50 cursor-pointer transition-colors group"
              >
                {/* Priority Rank */}
                <td className="font-bold text-[#5E5E5D]">
                  <span className="w-6 h-6 rounded-full bg-[#F7F7F1] border border-[#E8E4DC] flex items-center justify-center text-xs font-bold text-[#050505]">
                    #{idx + 1}
                  </span>
                </td>

                {/* Title & ID */}
                <td className="max-w-[280px]">
                  <div className="font-semibold text-[#050505] group-hover:text-[#4B3C32] transition-colors truncate">
                    {work.work_title}
                  </div>
                  <div className="text-[10px] text-[#5E5E5D] font-mono mt-0.5">
                    {work.work_id} • {work.implementing_agency}
                  </div>
                </td>

                {/* District & Category */}
                <td className="whitespace-nowrap">
                  <div className="text-[#050505] font-medium">{work.district}</div>
                  <div className="text-[10px] text-[#5E5E5D]">{work.work_category}</div>
                </td>

                {/* Score */}
                <td className="whitespace-nowrap">
                  {getRiskBadge(work.overall_risk_score, work.risk_level)}
                </td>

                {/* Primary Risk */}
                <td className="whitespace-nowrap">
                  {getPrimaryRiskBadge(work.primary_risk_factor)}
                </td>

                {/* Evidence Snippet */}
                <td className="max-w-[320px]">
                  <p className="text-[#5E5E5D] text-xs line-clamp-2">
                    {work.evidence_summary && work.evidence_summary[0]
                      ? work.evidence_summary[0]
                      : "Multi-parameter divergence detected."}
                  </p>
                </td>

                {/* Action Link */}
                <td className="text-right whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWork(work.work_id);
                    }}
                    className="btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                  >
                    <FileSearch className="w-3.5 h-3.5 text-[#5E5E5D]" />
                    <span>Dossier</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
