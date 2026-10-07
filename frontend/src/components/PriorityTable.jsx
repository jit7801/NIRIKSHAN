import React, { useState } from 'react';
import RiskBadge from './RiskBadge';
import { ArrowRight, ChevronRight, Eye, ChevronDown, ChevronUp } from 'lucide-react';

export default function PriorityTable({ works, onSelectWork, onViewAll }) {
  const [showAllPriority, setShowAllPriority] = useState(false);

  // Filter high/critical priority works (score >= 60)
  const priorityWorks = works
    .filter((w) => w.overall_risk_score >= 60)
    .sort((a, b) => b.overall_risk_score - a.overall_risk_score);

  const displayedWorks = showAllPriority ? priorityWorks : priorityWorks.slice(0, 6);

  const getSignalBadge = (signal) => {
    let color = 'bg-[#F2F0EB] text-[#5E5E5D] border-[#E8E4DC]';
    if (signal === 'Cost Anomaly') color = 'bg-[#FEF8ED] text-[#B87D28] border-[#F8E5C4]';
    if (signal === 'Delay & Stagnation') color = 'bg-[#F7F2ED] text-[#916540] border-[#E8DFD5]';
    if (signal === 'Duplicate Overlap') color = 'bg-[#F5EFE9] text-[#AA896C] border-[#E5DAD0]';
    if (signal === 'Compliance Deficit') color = 'bg-[#FDF2F2] text-[#C94C4C] border-[#F8D2D2]';

    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium border whitespace-nowrap ${color}`}>
        {signal}
      </span>
    );
  };

  return (
    <div className="gov-card rounded-2xl overflow-hidden mb-6 border border-[#E8E4DC] shadow-xs">
      
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-[#E8E4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm sm:text-base font-bold text-[#050505] tracking-tight">
              Today's Priority Works
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF2F2] text-[#C94C4C] border border-[#F8D2D2]">
              {priorityWorks.length} Flagged
            </span>
          </div>
          <p className="text-xs text-[#5E5E5D] mt-0.5">
            Works with highest empirical divergence requiring immediate administrative verification.
          </p>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="btn-secondary text-xs font-medium text-[#4B3C32] hover:text-[#050505] flex items-center gap-1.5 transition-colors self-start sm:self-center py-1.5 px-3 rounded-xl hover:bg-[#F7F7F1]"
          >
            <span>Full Registry ({works.length})</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#8E8D8A]" />
          </button>
        )}
      </div>

      {/* Desktop & Tablet Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse gov-table min-w-[640px]">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Priority</th>
              <th>Work Title & ID</th>
              <th>Location</th>
              <th>Risk Score</th>
              <th>Primary Signal</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedWorks.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-[#5E5E5D] text-xs">
                  No high-risk works currently pending priority review.
                </td>
              </tr>
            ) : (
              displayedWorks.map((work) => (
                <tr
                  key={work.work_id}
                  onClick={() => onSelectWork(work.work_id)}
                  className="cursor-pointer hover:bg-[#FAF9F6] transition-colors"
                >
                  {/* Priority Level */}
                  <td>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      work.overall_risk_score >= 80 
                        ? 'bg-[#FDF2F2] text-[#C94C4C] border-[#F8D2D2]' 
                        : 'bg-[#FEF8ED] text-[#B87D28] border-[#F8E5C4]'
                    }`}>
                      {work.overall_risk_score >= 80 ? 'Critical' : 'High'}
                    </span>
                  </td>

                  {/* Work Title & ID */}
                  <td className="max-w-[280px]">
                    <div className="font-semibold text-[#050505] hover:text-[#4B3C32] transition-colors truncate">
                      {work.work_title}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-[#5E5E5D] font-mono mt-0.5 truncate">
                      {work.work_id} · {work.work_category}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="whitespace-nowrap">
                    <div className="text-[#050505] font-medium">{work.district}</div>
                    <div className="text-[10px] text-[#5E5E5D]">{work.state}</div>
                  </td>

                  {/* Risk Score */}
                  <td className="whitespace-nowrap">
                    <RiskBadge score={work.overall_risk_score} level={work.risk_level} />
                  </td>

                  {/* Primary Signal */}
                  <td className="whitespace-nowrap">
                    {getSignalBadge(work.primary_risk_factor)}
                  </td>

                  {/* Action */}
                  <td className="text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWork(work.work_id);
                      }}
                      className="btn-secondary py-1 px-3 text-xs font-medium rounded-xl inline-flex items-center gap-1.5 hover:bg-[#F7F7F1]"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8E8D8A]" />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Expand / View All Footer */}
      {priorityWorks.length > 6 && (
        <div className="p-3 bg-[#FAF9F5] border-t border-[#E8E4DC] text-center">
          <button
            onClick={() => setShowAllPriority(!showAllPriority)}
            className="text-xs font-medium text-[#4B3C32] hover:text-[#050505] inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl hover:bg-white transition-all shadow-2xs"
          >
            {showAllPriority ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Fewer ({displayedWorks.length} shown)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Show All {priorityWorks.length} Priority Works</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
